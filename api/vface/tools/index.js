/**
 * Vercel Serverless Function — V·FACE Tool Router v3
 *
 * POST /api/vface/tools
 *
 * Routes tool calls from the concierge frontend.
 * Body: { action: "check_availability" | "book_appointment" | "webhook", ...params }
 *
 * v3: Cal.com primary for availability + booking. Google Calendar mirror as bonus.
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

const CAL_COM_EVENT_TYPE_ID = 5019359;
const CAL_COM_API_VERSION = "2024-08-13";

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

// ── Cal.com API ─────────────────────────────────────────────────────

async function calcomFetch(method, endpoint, body = null) {
  const apiKey = process.env.CAL_COM_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.cal.com/v2${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "cal-api-version": CAL_COM_API_VERSION,
    },
    signal: AbortSignal.timeout(15000),
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();

  if (data.status !== "success") {
    const errMsg = data.error?.message || JSON.stringify(data);
    throw new Error(`Cal.com ${method} ${endpoint}: ${errMsg}`);
  }
  return data.data;
}

// ── Google Auth (Calendar + Sheets) ─────────────────────────────────

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

function getCalendarClient() {
  const auth = getOAuth2Client();
  return auth ? google.calendar({ version: "v3", auth }) : null;
}

function getSheetsClient() {
  const auth = getOAuth2Client();
  return auth ? google.sheets({ version: "v4", auth }) : null;
}

function getCalendarId(providerKey) {
  const map = {
    jonathan: process.env.GCAL_DR_JONATHAN_ID,
    nadine: process.env.GCAL_DR_NADINE_ID,
    main: process.env.GCAL_MAIN_ID,
  };
  return map[providerKey] || null;
}

// ── Google Sheets Logging ───────────────────────────────────────────

async function logToSheet(tab, row) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;

  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tab}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
    console.log(`[vface/sheets] Logged to ${tab} tab`);
  } catch (err) {
    console.error(`[vface/sheets] Failed to log to ${tab}:`, err.message);
  }
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
  } else if (action === "log_lead") {
    return handleLogLead(params, res);
  } else if (action === "log_emergency") {
    return handleLogEmergency(params, res);
  } else if (action === "webhook") {
    return handleWebhook(req.body, res);
  } else {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }
};

// ── Check Availability (v3 — Cal.com primary, GCal fallback) ────────

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

    // Resolve candidate providers for labeling
    let candidateProviders;
    if (provider_preference === "jonathan") candidateProviders = ["jonathan"];
    else if (provider_preference === "nadine") candidateProviders = ["nadine"];
    else candidateProviders = SERVICE_CALENDAR_ORDER[service_line] || ["main"];

    const primaryProvider = candidateProviders[0];

    const now = new Date();
    const defaultDays = urgency === "high" ? 3 : 14;
    const searchStart = start_date ? new Date(start_date + "T00:00:00") : now;
    const searchEnd = end_date
      ? new Date(end_date + "T23:59:59")
      : new Date(searchStart.getTime() + defaultDays * 86400000);

    // Preferred day filter
    const dayMap = { monday: 1, tuesday: 2, thursday: 4, friday: 5 };
    const preferredDayNums = new Set(
      (preferred_days || []).map((d) => dayMap[d]).filter(Boolean)
    );

    // ── Try Cal.com Slots API ──
    const calApiKey = process.env.CAL_COM_API_KEY;
    if (calApiKey) {
      try {
        const slotsData = await calcomFetch(
          "GET",
          `/slots/available?startTime=${searchStart.toISOString()}&endTime=${searchEnd.toISOString()}&eventTypeId=${CAL_COM_EVENT_TYPE_ID}`,
        );

        const allSlots = [];
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        for (const [dateKey, daySlots] of Object.entries(slotsData.slots || {})) {
          for (const slot of daySlots) {
            const slotTime = new Date(slot.time);
            const dayOfWeek = slotTime.getDay();
            const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

            // Filter: office open days only
            if (!OFFICE_OPEN_DAYS.has(isoDay)) continue;

            // Filter: preferred days
            if (preferredDayNums.size > 0 && !preferredDayNums.has(isoDay)) continue;

            // Filter: preferred time of day (convert to ET)
            const etHour = parseInt(
              slotTime.toLocaleTimeString("en-US", { hour: "numeric", hour12: false, timeZone: OFFICE_TIMEZONE })
            );
            if (preferred_time_of_day === "morning" && etHour >= 12) continue;
            if (preferred_time_of_day === "afternoon" && etHour < 12) continue;

            // Build end time
            const slotEnd = new Date(slotTime.getTime() + duration * 60000);

            const displayHour = etHour > 12 ? etHour - 12 : etHour === 0 ? 12 : etHour;
            const ampm = etHour >= 12 ? "PM" : "AM";
            const providerLabel = PROVIDER_LABELS[primaryProvider] || primaryProvider;

            allSlots.push({
              provider_key: primaryProvider,
              start_iso: slotTime.toISOString(),
              end_iso: slotEnd.toISOString(),
              provider: providerLabel,
              human_readable: `${dayNames[dayOfWeek]}, ${months[slotTime.getMonth()]} ${slotTime.getDate()} at ${displayHour}:00 ${ampm} ET with ${providerLabel}`,
            });
          }
        }

        // Spread slots out — pick up to 4
        const finalSlots = spreadSlots(allSlots, 4);

        console.log(`[tools/check-availability] Cal.com returned ${allSlots.length} raw slots, presenting ${finalSlots.length}`);

        return res.status(200).json({
          ok: true,
          source: "cal_com",
          appointment_type,
          duration_minutes: duration,
          slots: finalSlots,
          guidance: finalSlots.length > 0
            ? "Present these options to the patient. Once they pick one, call book_appointment with the slot details."
            : "No openings found. Ask the patient if they'd like to try different days or a callback.",
        });
      } catch (calErr) {
        console.error("[tools/check-availability] Cal.com error, falling back:", calErr.message);
      }
    }

    // ── Fallback: Google Calendar FreeBusy ──
    const calendar = getCalendarClient();
    if (calendar) {
      return handleCheckAvailabilityGCal(params, res, calendar, candidateProviders, duration, searchStart, searchEnd, preferredDayNums, preferred_time_of_day, appointment_type);
    }

    // ── Last resort: static slots ──
    return handleCheckAvailabilityStatic(params, res);
  } catch (err) {
    console.error("[tools/check-availability] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to check availability. Please try again or call (407) 877-9003.",
    });
  }
}

// Pick well-spaced slots from a list
function spreadSlots(slots, max) {
  if (slots.length <= max) return slots;
  const step = Math.floor(slots.length / max);
  const result = [];
  for (let i = 0; i < slots.length && result.length < max; i += step) {
    result.push(slots[i]);
  }
  return result;
}

// ── Google Calendar FreeBusy Fallback ────────────────────────────────

async function handleCheckAvailabilityGCal(params, res, calendar, candidateProviders, duration, searchStart, searchEnd, preferredDayNums, preferred_time_of_day, appointment_type) {
  const now = new Date();
  const allSlots = [];

  for (const providerKey of candidateProviders) {
    const calId = getCalendarId(providerKey);
    if (!calId) continue;

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
      continue;
    }

    const busyRanges = busyIntervals.map((b) => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
    }));

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

            const endHour = hour + Math.floor(duration / 60);
            const endMin = duration % 60;
            if (endHour > OFFICE_END_HOUR || (endHour === OFFICE_END_HOUR && endMin > 0)) continue;
            if (preferred_time_of_day === "morning" && hour >= 12) continue;
            if (preferred_time_of_day === "afternoon" && hour < 12) continue;

            const yyyy = cursor.getFullYear();
            const mm = String(cursor.getMonth() + 1).padStart(2, "0");
            const dd = String(cursor.getDate()).padStart(2, "0");
            const startStr = `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:00:00`;
            const endStr = `${yyyy}-${mm}-${dd}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`;

            const slotStartMs = new Date(startStr + "-04:00").getTime();
            const slotEndMs = new Date(endStr + "-04:00").getTime();
            if (slotStartMs <= now.getTime()) continue;

            const overlaps = busyRanges.some((b) => slotStartMs < b.end && slotEndMs > b.start);
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
    source: "google_calendar",
    appointment_type,
    duration_minutes: duration,
    slots: finalSlots,
    guidance: finalSlots.length > 0
      ? "Present these options to the patient. Once they pick one, call book_appointment with the slot details."
      : "No openings found. Ask the patient if they'd like to try different days or a callback.",
  });
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

            const endHour = hour + Math.floor(duration / 60);
            const endMin = duration % 60;
            if (endHour > OFFICE_END_HOUR || (endHour === OFFICE_END_HOUR && endMin > 0)) continue;
            if (preferred_time_of_day === "morning" && hour >= 12) continue;
            if (preferred_time_of_day === "afternoon" && hour < 12) continue;

            const slotDate = new Date(cursor);
            slotDate.setHours(hour, 0, 0, 0);
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
    source: "static",
    appointment_type,
    duration_minutes: duration,
    slots: finalSlots,
    guidance: finalSlots.length > 0
      ? "Present these options to the patient. Once they pick one, call book_appointment with the slot details."
      : "No openings found. Ask the patient if they'd like to try different days or a callback.",
  });
}

// ── Book Appointment (v3 — Cal.com primary, GCal mirror) ─────────────

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

    // ── 1. Cal.com Booking (primary) ──
    let calBookingId = null;
    let calBookingUid = null;
    const calApiKey = process.env.CAL_COM_API_KEY;

    if (calApiKey) {
      try {
        // Use patient email or generate a placeholder
        const attendeeEmail = patient_email || `${patient_phone.replace(/\D/g, "")}@placeholder.voxaris.io`;

        const serviceNote = [
          `Service: ${appointmentLabel}`,
          `Provider: ${providerLabel}`,
          `Phone: ${patient_phone}`,
          patient_type !== "unknown" ? `Patient type: ${patient_type}` : null,
          notes ? `Notes: ${notes}` : null,
        ].filter(Boolean).join("\n");

        const booking = await calcomFetch("POST", "/bookings", {
          eventTypeId: CAL_COM_EVENT_TYPE_ID,
          start: slotStart.toISOString(),
          attendee: {
            name: `${patient_first_name} ${patient_last_name}`,
            email: attendeeEmail,
            timeZone: OFFICE_TIMEZONE,
          },
          bookingFieldsResponses: {
            phone: patient_phone,
            notes: serviceNote,
          },
          metadata: {
            source: "tavus_vface_maria",
            appointment_type,
            provider_key,
            event_id: eventId,
          },
        });

        calBookingId = booking.id;
        calBookingUid = booking.uid;
        console.log(`[tools/book-appointment] Cal.com booking created: ${calBookingId} uid=${calBookingUid}`);
      } catch (calErr) {
        console.error("[tools/book-appointment] Cal.com booking failed:", calErr.message);
        // Fall through to Google Calendar
      }
    }

    // ── 2. Google Calendar Mirror (secondary) ──
    let googleEventId = null;
    let mirrorEvents = [];

    const calendar = getCalendarClient();
    const calId = getCalendarId(provider_key);

    const description = [
      `Service: ${appointmentLabel}`,
      `Patient: ${patient_first_name} ${patient_last_name}`,
      `Phone: ${patient_phone}`,
      patient_email ? `Email: ${patient_email}` : null,
      `Type: ${patient_type}`,
      notes ? `Notes: ${notes}` : null,
      `---`,
      calBookingUid ? `Cal.com booking: ${calBookingUid}` : null,
      `Booked via V·FACE Maria | ID: ${eventId}`,
    ].filter(Boolean).join("\n");

    if (calendar && calId) {
      try {
        const gcalEvent = await calendar.events.insert({
          calendarId: calId,
          requestBody: {
            summary,
            description,
            start: { dateTime: slot_start_iso, timeZone: OFFICE_TIMEZONE },
            end: { dateTime: slot_end_iso, timeZone: OFFICE_TIMEZONE },
            colorId: "9",
          },
        });
        googleEventId = gcalEvent.data.id;
        console.log(`[tools/book-appointment] Google Calendar mirror created: ${googleEventId}`);

        // Mirror to Main calendar if on a provider calendar
        const mainCalId = process.env.GCAL_MAIN_ID;
        if (provider_key !== "main" && mainCalId) {
          try {
            const mirrorEvent = await calendar.events.insert({
              calendarId: mainCalId,
              requestBody: {
                summary: `[Mirror] ${summary}`,
                description: `Mirrored from ${providerLabel}\n${description}`,
                start: { dateTime: slot_start_iso, timeZone: OFFICE_TIMEZONE },
                end: { dateTime: slot_end_iso, timeZone: OFFICE_TIMEZONE },
                colorId: "8",
                transparency: "transparent",
              },
            });
            mirrorEvents.push({ calendar: "main", event_id: mirrorEvent.data.id });
          } catch (mirrorErr) {
            console.error("[tools/book-appointment] Mirror failed:", mirrorErr.message);
          }
        }
      } catch (gcalErr) {
        console.error("[tools/book-appointment] Google Calendar mirror failed:", gcalErr.message);
      }
    }

    // ── 3. Must have at least one booking source ──
    if (!calBookingId && !googleEventId) {
      console.error("[tools/book-appointment] Both Cal.com and Google Calendar failed!");
      return res.status(500).json({
        ok: false,
        error: "Unable to confirm your booking right now. Please call us at (407) 877-9003.",
      });
    }

    // ── 4. Log locally ──
    const appointment = {
      id: eventId,
      cal_booking_id: calBookingId || null,
      cal_booking_uid: calBookingUid || null,
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

    try {
      const logFile = path.join("/tmp", "appointments.jsonl");
      fs.appendFileSync(logFile, JSON.stringify(appointment) + "\n");
    } catch {}

    // Log to Google Sheets — Appointments tab
    // Headers: Date/Time, Source, Patient Name, Phone, Email, Service, Provider, Notes
    const sheetRow = [
      new Date().toLocaleString("en-US", { timeZone: OFFICE_TIMEZONE }),
      "Virtual Concierge",
      `${patient_first_name} ${patient_last_name}`,
      patient_phone,
      patient_email || "",
      appointmentLabel,
      PROVIDER_LABELS[provider_key] || provider_key,
      `${humanReadable}${notes ? " | " + notes : ""}`,
    ];
    logToSheet("Appointments", sheetRow).catch(() => {});

    const bookingSource = calBookingId ? "cal_com" : "google_calendar";
    console.log(`[tools/book-appointment] Booked: ${eventId} — ${summary} on ${humanReadable} (source: ${bookingSource})`);

    return res.status(200).json({
      ok: true,
      source: bookingSource,
      appointment: {
        provider_key,
        human_readable: humanReadable,
        start_iso: slot_start_iso,
        end_iso: slot_end_iso,
        primary_event_id: calBookingUid || googleEventId || eventId,
        cal_booking_uid: calBookingUid || null,
        google_event_id: googleEventId || null,
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

// ── Log Lead ─────────────────────────────────────────────────────────

async function handleLogLead(params, res) {
  const {
    patient_name = "",
    patient_phone = "",
    patient_email = "",
    interest = "",
    notes = "",
  } = params;

  if (!patient_name && !patient_phone) {
    return res.status(400).json({ ok: false, error: "At least patient_name or patient_phone is required." });
  }

  // Headers: Date/Time, Source, Name, Phone, Email, Interest
  const row = [
    new Date().toLocaleString("en-US", { timeZone: OFFICE_TIMEZONE }),
    "Virtual Concierge",
    patient_name,
    patient_phone,
    patient_email,
    `${interest}${notes ? " | " + notes : ""}`,
  ];

  await logToSheet("Leads", row);

  console.log(`[vface/log-lead] Lead logged: ${patient_name} — ${interest}`);
  return res.status(200).json({ ok: true, logged: "leads" });
}

// ── Log Emergency ────────────────────────────────────────────────────

async function handleLogEmergency(params, res) {
  const {
    patient_name = "",
    patient_phone = "",
    issue = "",
    urgency = "unknown",
    notes = "",
  } = params;

  if (!patient_name && !patient_phone) {
    return res.status(400).json({ ok: false, error: "At least patient_name or patient_phone is required." });
  }

  // Headers: Date/Time, Source, Name, Phone, Issue, Urgency
  const row = [
    new Date().toLocaleString("en-US", { timeZone: OFFICE_TIMEZONE }),
    "Virtual Concierge",
    patient_name,
    patient_phone,
    issue,
    `${urgency}${notes ? " | " + notes : ""}`,
  ];

  await logToSheet("Emergencies", row);

  console.log(`[vface/log-emergency] Emergency logged: ${patient_name} — ${issue} (${urgency})`);
  return res.status(200).json({ ok: true, logged: "emergencies" });
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
