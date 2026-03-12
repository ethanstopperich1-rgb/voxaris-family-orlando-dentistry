/**
 * Vercel Serverless Function — Day-of-Appointment Reminders
 *
 * POST /api/reminders/today
 *
 * Reads today's appointments from Google Calendar, extracts patient
 * info from event descriptions, and triggers reminder calls via VAPI.
 *
 * Can be triggered manually or via a cron job.
 *
 * Optional body: { dry_run: true } — returns appointments without calling.
 */

const { google } = require("googleapis");
const { getVapiClient } = require("../../vapi/lib/vapi-client");
const {
  getAppointmentReminderConfig,
  getCallOverrides,
} = require("../../vapi/agents/outbound/assistant");

const OFFICE_TIMEZONE = "America/New_York";

const PROVIDER_LABELS = {
  jonathan: "Dr. Jonathan",
  nadine: "Dr. Nadine",
  main: "the team",
};

function getCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2 });
}

/**
 * Parse patient details from event description.
 * Format written by book_appointment:
 *   Patient: FirstName LastName
 *   Phone: +14075551234
 *   Email: ...
 */
function parseEventDescription(description) {
  if (!description) return null;

  const phoneMatch = description.match(/Phone:\s*(\+?[\d\-() ]+)/);
  const patientMatch = description.match(/Patient:\s*(.+)/);
  const serviceMatch = description.match(/Service:\s*(.+)/);

  if (!phoneMatch || !patientMatch) return null;

  const phone = phoneMatch[1].replace(/[^+\d]/g, "");
  if (phone.length < 10) return null;

  const fullName = patientMatch[1].trim();
  const nameParts = fullName.split(" ");

  return {
    phone: phone.startsWith("+") ? phone : `+1${phone}`,
    first_name: nameParts[0] || "there",
    last_name: nameParts.slice(1).join(" ") || "",
    full_name: fullName,
    service: serviceMatch ? serviceMatch[1].trim() : "your appointment",
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { dry_run = false } = req.body || {};

  const calendar = getCalendarClient();
  if (!calendar) {
    return res.status(500).json({
      success: false,
      error: "Google Calendar not configured.",
    });
  }

  // Get today's date range in office timezone
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: OFFICE_TIMEZONE });
  const timeMin = `${todayStr}T00:00:00-04:00`;
  const timeMax = `${todayStr}T23:59:59-04:00`;

  // Fetch events from all 3 calendars
  const calendarIds = {
    jonathan: process.env.GCAL_DR_JONATHAN_ID,
    nadine: process.env.GCAL_DR_NADINE_ID,
    main: process.env.GCAL_MAIN_ID,
  };

  const allAppointments = [];
  const calledNumbers = new Set(); // Deduplicate by phone

  for (const [providerKey, calId] of Object.entries(calendarIds)) {
    if (!calId) continue;

    try {
      const eventsRes = await calendar.events.list({
        calendarId: calId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 50,
      });

      const events = eventsRes.data.items || [];

      for (const event of events) {
        // Skip mirror events
        if (event.summary?.startsWith("[Mirror]")) continue;
        // Only process VAPI-booked events
        if (!event.description?.includes("Booked via VAPI")) continue;

        const patient = parseEventDescription(event.description);
        if (!patient) continue;
        if (calledNumbers.has(patient.phone)) continue;

        const startTime = new Date(event.start.dateTime || event.start.date);
        const timeStr = startTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: OFFICE_TIMEZONE,
        });

        allAppointments.push({
          provider_key: providerKey,
          provider_name: PROVIDER_LABELS[providerKey] || providerKey,
          patient_name: patient.full_name,
          patient_first_name: patient.first_name,
          patient_phone: patient.phone,
          appointment_type: patient.service,
          appointment_time: timeStr,
          event_id: event.id,
          start_iso: event.start.dateTime,
        });

        calledNumbers.add(patient.phone);
      }
    } catch (err) {
      console.error(`[reminders] Error reading ${providerKey} calendar:`, err.message);
    }
  }

  console.log(`[reminders] Found ${allAppointments.length} appointments for today`);

  if (dry_run) {
    return res.status(200).json({
      success: true,
      dry_run: true,
      date: todayStr,
      appointments: allAppointments,
      total: allAppointments.length,
    });
  }

  // Trigger reminder calls
  const phoneNumberId = process.env.VAPI_OUTBOUND_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    return res.status(500).json({
      success: false,
      error: "VAPI_OUTBOUND_PHONE_NUMBER_ID not configured.",
    });
  }

  const serverUrl =
    process.env.VAPI_WEBHOOK_URL ||
    `https://${process.env.VERCEL_URL || "localhost:3000"}/api/vapi/webhook`;

  const vapi = getVapiClient();
  const results = [];

  for (const appt of allAppointments) {
    try {
      const assistantConfig = getAppointmentReminderConfig(serverUrl);

      // Personalize the first message
      const firstMessage = `Hi ${appt.patient_first_name}, this is Ava with Family Orlando Dentistry. I'm calling to confirm your ${appt.appointment_type} today at ${appt.appointment_time} with ${appt.provider_name}. Will you be able to make it?`;

      const call = await vapi.createCall({
        assistant: assistantConfig,
        phoneNumberId,
        customer: {
          number: appt.patient_phone,
          name: appt.patient_name,
        },
        assistantOverrides: {
          firstMessage,
          ...getCallOverrides({
            patient_name: appt.patient_first_name,
            appointment_type: appt.appointment_type,
            appointment_time: appt.appointment_time,
            provider_name: appt.provider_name,
          }),
        },
        metadata: {
          campaign: "appointment_reminder",
          patient_name: appt.patient_name,
          event_id: appt.event_id,
          triggered_at: new Date().toISOString(),
        },
      });

      console.log(`[reminders] Call created: ${call.id} to=${appt.patient_phone}`);
      results.push({
        patient: appt.patient_name,
        phone: appt.patient_phone,
        call_id: call.id,
        status: "queued",
      });
    } catch (err) {
      console.error(`[reminders] Failed to call ${appt.patient_phone}:`, err.message);
      results.push({
        patient: appt.patient_name,
        phone: appt.patient_phone,
        error: err.message,
        status: "failed",
      });
    }
  }

  return res.status(200).json({
    success: true,
    date: todayStr,
    total: allAppointments.length,
    calls: results,
  });
};
