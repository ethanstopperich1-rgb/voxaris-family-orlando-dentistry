/**
 * Vercel Serverless Function — V·FACE Tool Router v2
 *
 * POST /api/vface/tools
 *
 * Routes tool calls from the concierge frontend.
 * Body: { action: "check_availability" | "book_appointment" | "webhook", ...params }
 *
 * Uses Google Calendar FreeBusy + Events API for real availability/booking.
 * Falls back to static slot generation when Google Calendar env vars are not set.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { google } = require("googleapis");

// ── Constants ─────────────────────────────────────────────────────────

const OFFICE_TIMEZONE = "America/New_York";
const OFFICE_OPEN_DAYS = new Set([1, 2, 4, 5]); // Mon, Tue, Thu, Fri
const OFFICE_START_HOUR = 9;
const OFFICE_END_HOUR = 17;

const DEFAULT_DURATION = {
  invisalign_consult: 45,
  cosmetic_consult: 45,
  whitening: 30,
  implant_consult: 60,
  same_day_crown_consult: 60,
  emergency_exam: 45,
  general_new_patient: 60,
  general_existing_patient: 45,
  botox_tmj_eval: 45,
};

const SERVICE_CALENDAR_ORDER = {
  invisalign: ["jonathan", "nadine"],
  cosmetic: ["jonathan", "nadine"],
  whitening: ["main", "jonathan", "nadine"],
  implants: ["jonathan", "nadine"],
  same_day_crowns: ["jonathan", "nadine"],
  emergency: ["jonathan", "nadine", "main"],
  general: ["main", "jonathan", "nadine"],
  botox_tmj: ["jonathan", "nadine"],
};

const PROVIDER_LABELS = {
  jonathan: "Dr. Jonathan",
  nadine: "Dr. Nadine",
  main: "Main schedule",
};

const APPOINTMENT_LABELS = {
  invisalign_consult: "Invisalign consult",
  cosmetic_consult: "Cosmetic consult",
  whitening: "Whitening visit",
  implant_consult: "Implant consult",
  same_day_crown_consult: "Same-day crown consult",
  emergency_exam: "Emergency exam",
  general_new_patient: "New patient visit",
  general_existing_patient: "Patient visit",
  botox_tmj_eval: "TMJ / Botox evaluation",
};

// ── Google Calendar Auth ──────────────────────────────────────────────

function getCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2 });
}

function getCalendarId(providerKey) {
  const map = {
    jonathan: process.env.GCAL_DR_JONATHAN_ID,
    nadine: process.env.GCAL_DR_NADINE_ID,
    main: process.env.GCAL_MAIN_ID,
  };
  return map[providerKey] || null;
}

// ── Handler ───────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, ...params } = req.body || {};

  if (action === "check_availability") {
    return handleCheckAvailability(params, res);
  } else if (action === "book_appointment") {
    return handleBookAppointment(params, res);
  } else if (action === "webhook") {
    return handleWebhook(req.body, res);
  } else {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }
};

// ── Check Availability (v2 — Google Calendar FreeBusy) ───────────────

async function handleCheckAvailability(params, res) {
  try {
    const {
      appointment_type = "general_new_patient",
      service_line = "general",
      patient_type = "unknown",
      urgency = "low",
      provider_preference = "no_preference",
      preferred_days = [],
      preferred_time_of_day = "no_preference",
      start_date,
      end_date,
      duration_minutes,
    } = params;

    const duration = duration_minutes || DEFAULT_DURATION[appointment_type] || 45;

    // Resolve candidate providers
    let candidateProviders;
    if (provider_preference === "jonathan") {
      candidateProviders = ["jonathan"];
    } else if (provider_preference === "nadine") {
      candidateProviders = ["nadine"];
    } else {
      candidateProviders = SERVICE_CALENDAR_ORDER[service_line] || ["main"];
    }

    // Build search window
    const now = new Date();
    const searchStart = start_date ? new Date(start_date + "T00:00:00") : now;
    const defaultDays = urgency === "high" ? 3 : 14;
    const searchEnd = end_date
      ? new Date(end_date + "T23:59:59")
      : new Date(searchStart.getTime() + defaultDays * 86400000);

    // Preferred day numbers (ISO: Mon=1 ... Fri=5)
    const dayMap = { monday: 1, tuesday: 2, thursday: 4, friday: 5 };
    const preferredDayNums = new Set(
      (preferred_days || []).map((d) => dayMap[d]).filter(Boolean)
    );

    const calendar = getCalendarClient();

    // Try Google Calendar FreeBusy API
    if (calendar) {
      const allSlots = [];

      for (const providerKey of candidateProviders) {
        const calId = getCalendarId(providerKey);
        if (!calId) {
          providerResults.push({ provider_key: providerKey, slots: [], errors: ["Calendar not configured"] });
          continue;
        }

        // Fetch busy intervals
        let busyIntervals = [];
        try {
          const freeBusyRes = await calendar.freebusy.query({
            requestBody: {
              timeMin: searchStart.toISOString(),
              timeMax: searchEnd.toISOString(),
              timeZone: OFFICE_TIMEZONE,
              items: [{ id: calId }],
            },
          });
          busyIntervals = (freeBusyRes.data.calendars[calId] || {}).busy || [];
        } catch (fbErr) {
          console.error(`[tools/check-availability] FreeBusy error for ${providerKey}:`, fbErr.message);
          providerResults.push({ provider_key: providerKey, slots: [], errors: [fbErr.message] });
          continue;
        }

        // Build set of busy windows (as epoch ranges)
        const busyRanges = busyIntervals.map((b) => ({
          start: new Date(b.start).getTime(),
          end: new Date(b.end).getTime(),
        }));

        // Scan office hours for open slots (one per hour to keep voice-friendly)
        const slots = [];
        const cursor = new Date(searchStart);
        const usedHours = new Set(); // track hours already offered

        while (cursor <= searchEnd && slots.length < 3) {
          const dayOfWeek = cursor.getDay();
          const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

          if (OFFICE_OPEN_DAYS.has(isoDay)) {
            const dayMatch = preferredDayNums.size === 0 || preferredDayNums.has(isoDay);

            if (dayMatch) {
              for (let hour = OFFICE_START_HOUR; hour < OFFICE_END_HOUR; hour++) {
                if (slots.length >= 3) break;

                // One slot per hour per day to keep results spread out
                const dayHourKey = `${cursor.toDateString()}-${hour}`;
                if (usedHours.has(dayHourKey)) continue;

                const min = 0; // top of hour only
                const endHour = hour + Math.floor((min + duration) / 60);
                const endMin = (min + duration) % 60;
                if (endHour > OFFICE_END_HOUR || (endHour === OFFICE_END_HOUR && endMin > 0)) continue;

                if (preferred_time_of_day === "morning" && hour >= 12) continue;
                if (preferred_time_of_day === "afternoon" && hour < 12) continue;

                // Build slot start/end in ET
                const yyyy = cursor.getFullYear();
                const mm = String(cursor.getMonth() + 1).padStart(2, "0");
                const dd = String(cursor.getDate()).padStart(2, "0");
                const startStr = `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
                const endStr = `${yyyy}-${mm}-${dd}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`;

                // Parse as ET for comparison
                const slotStartMs = new Date(startStr + "-04:00").getTime();
                const slotEndMs = new Date(endStr + "-04:00").getTime();

                // Skip past slots
                if (slotStartMs <= now.getTime()) continue;

                // Check against busy ranges
                const overlaps = busyRanges.some(
                  (b) => slotStartMs < b.end && slotEndMs > b.start
                );
                if (overlaps) continue;

                usedHours.add(dayHourKey);

                const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                const ampm = hour >= 12 ? "PM" : "AM";
                const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                slots.push({
                  provider_key: providerKey,
                  start_iso: startStr + "-04:00",
                  end_iso: endStr + "-04:00",
                  provider: PROVIDER_LABELS[providerKey] || providerKey,
                  human_readable: `${dayNames[dayOfWeek]}, ${months[cursor.getMonth()]} ${cursor.getDate()} at ${displayHour}:${String(min).padStart(2, "0")} ${ampm} ET with ${PROVIDER_LABELS[providerKey] || providerKey}`,
                });
              }
            }
          }

          cursor.setDate(cursor.getDate() + 1);
          cursor.setHours(0, 0, 0, 0);
        }

        allSlots.push(...slots);
      }

      // Limit to 4 well-spaced slots for voice-friendly output
      const finalSlots = allSlots.slice(0, 4);

      return res.status(200).json({
        ok: true,
        appointment_type,
        duration_minutes: duration,
        slots: finalSlots,
        guidance: finalSlots.length > 0
          ? "Present these options to the patient. Once they pick one, call book_appointment with the slot details."
          : "No openings found. Ask the patient if they'd like to try different days or a callback.",
      });
    }

    // ── Fallback: static slot generation ──────────────────────────────
    return handleCheckAvailabilityStatic(params, res);
  } catch (err) {
    console.error("[tools/check-availability] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to check availability. Please try again or call (407) 877-9003.",
    });
  }
}

// ── Static Fallback ──────────────────────────────────────────────────

function handleCheckAvailabilityStatic(params, res) {
  const {
    appointment_type = "general_new_patient",
    service_line = "general",
    urgency = "low",
    provider_preference = "no_preference",
    preferred_days = [],
    preferred_time_of_day = "no_preference",
    start_date,
    end_date,
    duration_minutes,
  } = params;

  const duration = duration_minutes || DEFAULT_DURATION[appointment_type] || 45;

  let candidateProviders;
  if (provider_preference === "jonathan") candidateProviders = ["jonathan"];
  else if (provider_preference === "nadine") candidateProviders = ["nadine"];
  else candidateProviders = SERVICE_CALENDAR_ORDER[service_line] || ["main"];

  const now = new Date();
  const searchStart = start_date ? new Date(start_date + "T00:00:00") : now;
  const defaultDays = urgency === "high" ? 3 : 14;
  const searchEnd = end_date
    ? new Date(end_date + "T23:59:59")
    : new Date(searchStart.getTime() + defaultDays * 86400000);

  const dayMap = { monday: 1, tuesday: 2, thursday: 4, friday: 5 };
  const preferredDayNums = new Set(
    (preferred_days || []).map((d) => dayMap[d]).filter(Boolean)
  );

  const allSlots = [];

  for (const providerKey of candidateProviders) {
    const slots = [];
    const cursor = new Date(searchStart);
    const usedHours = new Set();

    while (cursor <= searchEnd && slots.length < 3) {
      const dayOfWeek = cursor.getDay();
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

      if (OFFICE_OPEN_DAYS.has(isoDay)) {
        const dayMatch = preferredDayNums.size === 0 || preferredDayNums.has(isoDay);
        if (dayMatch) {
          for (let hour = OFFICE_START_HOUR; hour < OFFICE_END_HOUR; hour++) {
            if (slots.length >= 3) break;

            const dayHourKey = `${cursor.toDateString()}-${hour}`;
            if (usedHours.has(dayHourKey)) continue;

            const min = 0;
            const endHour = hour + Math.floor((min + duration) / 60);
            const endMin = (min + duration) % 60;
            if (endHour > OFFICE_END_HOUR || (endHour === OFFICE_END_HOUR && endMin > 0)) continue;
            if (preferred_time_of_day === "morning" && hour >= 12) continue;
            if (preferred_time_of_day === "afternoon" && hour < 12) continue;

            const slotDate = new Date(cursor);
            slotDate.setHours(hour, min, 0, 0);
            if (slotDate <= now) continue;

            usedHours.add(dayHourKey);

            const yyyy = cursor.getFullYear();
            const mm = String(cursor.getMonth() + 1).padStart(2, "0");
            const dd = String(cursor.getDate()).padStart(2, "0");
            const startIso = `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:00:00-04:00`;
            const endIso = `${yyyy}-${mm}-${dd}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00-04:00`;

            const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
            const ampm = hour >= 12 ? "PM" : "AM";
            const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            slots.push({
              provider_key: providerKey,
              start_iso: startIso,
              end_iso: endIso,
              provider: PROVIDER_LABELS[providerKey] || providerKey,
              human_readable: `${dayNames[dayOfWeek]}, ${months[cursor.getMonth()]} ${cursor.getDate()} at ${displayHour}:00 ${ampm} ET with ${PROVIDER_LABELS[providerKey] || providerKey}`,
            });
          }
        }
      }
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }

    allSlots.push(...slots);
  }

  const finalSlots = allSlots.slice(0, 4);

  return res.status(200).json({
    ok: true,
    appointment_type,
    duration_minutes: duration,
    slots: finalSlots,
    guidance: finalSlots.length > 0
      ? "Present these options to the patient. Once they pick one, call book_appointment with the slot details."
      : "No openings found. Ask the patient if they'd like to try different days or a callback.",
  });
}

// ── Book Appointment (v2 — Google Calendar Events) ───────────────────

async function handleBookAppointment(params, res) {
  const {
    appointment_type,
    service_line,
    provider_key = "main",
    slot_start_iso,
    slot_end_iso,
    patient_first_name,
    patient_last_name,
    patient_phone,
    patient_email = "",
    patient_type = "unknown",
    notes = "",
    request_id = "",
  } = params;

  if (!appointment_type || !service_line || !slot_start_iso || !slot_end_iso || !patient_first_name || !patient_last_name || !patient_phone) {
    return res.status(400).json({
      ok: false,
      error: "Missing required fields: appointment_type, service_line, slot_start_iso, slot_end_iso, patient_first_name, patient_last_name, patient_phone",
    });
  }

  try {
    const slotStart = new Date(slot_start_iso);
    const slotEnd = new Date(slot_end_iso);

    if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
      return res.status(400).json({ ok: false, error: "Invalid slot time format." });
    }

    const dayOfWeek = slotStart.getDay();
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    if (!OFFICE_OPEN_DAYS.has(isoDay)) {
      return res.status(400).json({
        ok: false,
        error: "The office is closed on that day. We are open Monday, Tuesday, Thursday, and Friday.",
      });
    }

    const lastInitial = patient_last_name.trim().charAt(0).toUpperCase();
    const safeName = `${patient_first_name.trim()} ${lastInitial}.`;
    const appointmentLabel = APPOINTMENT_LABELS[appointment_type] || appointment_type;
    const summary = `${appointmentLabel} — ${safeName}`;

    const eventIdSeed = request_id || `${provider_key}|${slot_start_iso}|${patient_first_name}|${patient_last_name}|${patient_phone}`;
    const eventId = `vx${crypto.createHash("sha256").update(eventIdSeed).digest("hex").slice(0, 24)}`;

    const description = [
      `Service: ${appointmentLabel}`,
      `Patient: ${patient_first_name} ${patient_last_name}`,
      `Phone: ${patient_phone}`,
      patient_email ? `Email: ${patient_email}` : null,
      `Type: ${patient_type}`,
      notes ? `Notes: ${notes}` : null,
      `---`,
      `Booked via V·FACE Maria | ID: ${eventId}`,
    ]
      .filter(Boolean)
      .join("\n");

    const calendar = getCalendarClient();
    const calId = getCalendarId(provider_key);
    let googleEventId = null;
    let mirrorEvents = [];

    // Create event on Google Calendar if available
    if (calendar && calId) {
      try {
        const gcalEvent = await calendar.events.insert({
          calendarId: calId,
          requestBody: {
            summary,
            description,
            start: { dateTime: slot_start_iso, timeZone: OFFICE_TIMEZONE },
            end: { dateTime: slot_end_iso, timeZone: OFFICE_TIMEZONE },
            colorId: "9", // Blueberry
          },
        });
        googleEventId = gcalEvent.data.id;
        console.log(`[tools/book-appointment] Google Calendar event created: ${googleEventId}`);

        // Mirror to Main calendar if booking was on a provider calendar
        const mainCalId = process.env.GCAL_MAIN_ID;
        if (provider_key !== "main" && mainCalId) {
          try {
            const mirrorEvent = await calendar.events.insert({
              calendarId: mainCalId,
              requestBody: {
                summary: `[Mirror] ${summary}`,
                description: `Mirrored from ${PROVIDER_LABELS[provider_key] || provider_key}\n${description}`,
                start: { dateTime: slot_start_iso, timeZone: OFFICE_TIMEZONE },
                end: { dateTime: slot_end_iso, timeZone: OFFICE_TIMEZONE },
                colorId: "8", // Graphite
                transparency: "transparent",
              },
            });
            mirrorEvents.push({ calendar: "main", event_id: mirrorEvent.data.id });
          } catch (mirrorErr) {
            console.error("[tools/book-appointment] Mirror failed:", mirrorErr.message);
          }
        }
      } catch (gcalErr) {
        console.error("[tools/book-appointment] Google Calendar insert failed:", gcalErr.message);
        // Continue with local booking even if GCal fails
      }
    }

    // Log appointment locally
    const appointment = {
      id: eventId,
      google_event_id: googleEventId,
      summary,
      appointment_type,
      service_line,
      provider_key,
      slot_start_iso,
      slot_end_iso,
      patient_first_name,
      patient_last_name,
      patient_phone,
      patient_email: patient_email || null,
      patient_type,
      notes,
      request_id: request_id || eventId,
      status: "confirmed",
      booked_at: new Date().toISOString(),
      source: "tavus_vface_maria",
    };

    const logFile = path.join("/tmp", "appointments.jsonl");
    fs.appendFileSync(logFile, JSON.stringify(appointment) + "\n");

    const providerLabel = PROVIDER_LABELS[provider_key] || provider_key;
    const startDate = slotStart.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: OFFICE_TIMEZONE,
    });
    const startTime = slotStart.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: OFFICE_TIMEZONE,
    });
    const humanReadable = `${startDate} at ${startTime} ET with ${providerLabel}`;

    console.log(`[tools/book-appointment] Booked: ${eventId} — ${summary} on ${humanReadable} (gcal: ${googleEventId || "none"})`);

    return res.status(200).json({
      ok: true,
      source: googleEventId ? "google_calendar" : "local_only",
      appointment: {
        provider_key,
        human_readable: humanReadable,
        start_iso: slot_start_iso,
        end_iso: slot_end_iso,
        primary_event_id: googleEventId || eventId,
        mirror_events: mirrorEvents,
      },
      confirmation_text: `Booked for ${humanReadable}.`,
    });
  } catch (err) {
    console.error("[tools/book-appointment] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to book appointment. Please call us at (407) 877-9003.",
    });
  }
}

// ── Webhook ───────────────────────────────────────────────────────────

function handleWebhook(event, res) {
  const eventType = event.event_type || event.type || "unknown";
  console.log(`[vface/webhook] Event: ${eventType}`, JSON.stringify(event).slice(0, 500));

  try {
    const logFile = path.join("/tmp", "tavus-events.jsonl");
    fs.appendFileSync(logFile, JSON.stringify({ ...event, received_at: new Date().toISOString() }) + "\n");
  } catch {}

  return res.status(200).json({ received: true, event_type: eventType });
}
