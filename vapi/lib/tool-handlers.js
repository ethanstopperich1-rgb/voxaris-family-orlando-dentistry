/**
 * Tool Call Handlers for Family Orlando Dentistry
 *
 * Each handler receives (callId, params) and returns a result object.
 * Results are JSON-stringified before being sent back to VAPI.
 *
 * check_availability + book_appointment — Google Calendar integration
 * capture_lead, request_appointment, mark_emergency_priority,
 * log_reactivation_interest — persisted to JSONL stores.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { google } = require("googleapis");

// ─── Constants ───────────────────────────────────────────────────────

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

// ─── Google Calendar Auth ────────────────────────────────────────────

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

// ─── Persistence Layer ───────────────────────────────────────────────

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "vapi-data")
  : path.join(__dirname, "..", "data");

function appendToStore(storeName, record) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const filePath = path.join(DATA_DIR, `${storeName}.jsonl`);
    const line = JSON.stringify(record) + "\n";
    fs.appendFileSync(filePath, line, "utf-8");
    console.log(`[store:${storeName}] persisted`, record.call_id || "");
    return true;
  } catch (err) {
    console.error(`[store:${storeName}] write failed:`, err.message);
    return false;
  }
}

function readStore(storeName) {
  const filePath = path.join(DATA_DIR, `${storeName}.jsonl`);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// ─── check_availability — Google Calendar FreeBusy ───────────────────

async function handleCheckAvailability(callId, params) {
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
    (Array.isArray(preferred_days) ? preferred_days : [])
      .map((d) => dayMap[d])
      .filter(Boolean)
  );

  const calendar = getCalendarClient();

  if (calendar) {
    try {
      const providerResults = [];

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
          console.error(`[vapi/check-availability] FreeBusy error for ${providerKey}:`, fbErr.message);
          providerResults.push({ provider_key: providerKey, slots: [], errors: [fbErr.message] });
          continue;
        }

        const busyRanges = busyIntervals.map((b) => ({
          start: new Date(b.start).getTime(),
          end: new Date(b.end).getTime(),
        }));

        // Scan office hours for open slots
        const slots = [];
        const cursor = new Date(searchStart);

        while (cursor <= searchEnd && slots.length < 6) {
          const dayOfWeek = cursor.getDay();
          const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

          if (OFFICE_OPEN_DAYS.has(isoDay)) {
            const dayMatch = preferredDayNums.size === 0 || preferredDayNums.has(isoDay);

            if (dayMatch) {
              for (let hour = OFFICE_START_HOUR; hour < OFFICE_END_HOUR; hour++) {
                for (let min = 0; min < 60; min += 15) {
                  if (slots.length >= 6) break;

                  const endHour = hour + Math.floor((min + duration) / 60);
                  const endMin = (min + duration) % 60;
                  if (endHour > OFFICE_END_HOUR || (endHour === OFFICE_END_HOUR && endMin > 0)) continue;

                  if (preferred_time_of_day === "morning" && hour >= 12) continue;
                  if (preferred_time_of_day === "afternoon" && hour < 12) continue;

                  const yyyy = cursor.getFullYear();
                  const mm = String(cursor.getMonth() + 1).padStart(2, "0");
                  const dd = String(cursor.getDate()).padStart(2, "0");
                  const startStr = `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
                  const endStr = `${yyyy}-${mm}-${dd}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`;

                  const slotStartMs = new Date(startStr + "-04:00").getTime();
                  const slotEndMs = new Date(endStr + "-04:00").getTime();

                  if (slotStartMs <= now.getTime()) continue;

                  const overlaps = busyRanges.some(
                    (b) => slotStartMs < b.end && slotEndMs > b.start
                  );
                  if (overlaps) continue;

                  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                  const ampm = hour >= 12 ? "PM" : "AM";
                  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                  slots.push({
                    start_iso: startStr + "-04:00",
                    end_iso: endStr + "-04:00",
                    human_readable: `${dayNames[dayOfWeek]}, ${months[cursor.getMonth()]} ${cursor.getDate()} at ${displayHour}:${String(min).padStart(2, "0")} ${ampm} ET with ${PROVIDER_LABELS[providerKey] || providerKey}`,
                    provider_key: providerKey,
                  });
                }
              }
            }
          }

          cursor.setDate(cursor.getDate() + 1);
          cursor.setHours(0, 0, 0, 0);
        }

        providerResults.push({
          provider_key: providerKey,
          slots: slots.slice(0, 6),
          errors: [],
        });
      }

      // Flatten and limit to best 8 slots
      const flattened = providerResults
        .flatMap((p) => p.slots)
        .slice(0, 8);

      console.log(`[vapi/check-availability] call=${callId} found ${flattened.length} slots via Google Calendar`);

      return {
        success: true,
        source: "google_calendar",
        appointment_type,
        service_line,
        duration_minutes: duration,
        slots: flattened,
        guidance: flattened.length > 0
          ? "Present these available times to the caller. Read up to 3 options and ask which works best. Once they choose, collect their name and phone number, then call book_appointment."
          : "No openings found in the search window. Ask if they'd like to try different days or times, or offer to transfer to the office.",
      };
    } catch (err) {
      console.error("[vapi/check-availability] Error:", err.message);
      return {
        success: false,
        error: "I'm having trouble checking the schedule right now. Let me transfer you to the office.",
      };
    }
  }

  // Fallback — no Google Calendar configured
  console.warn("[vapi/check-availability] Google Calendar not configured, using fallback");
  return {
    success: false,
    error: "Calendar system unavailable. Please transfer to the office for scheduling.",
  };
}

// ─── book_appointment — Google Calendar Events ───────────────────────

async function handleBookAppointment(callId, params) {
  const {
    appointment_type = "general_new_patient",
    service_line = "general",
    provider_key = "main",
    slot_start_iso,
    slot_end_iso,
    patient_first_name,
    patient_last_name,
    patient_phone,
    patient_email = "",
    patient_type = "unknown",
    notes = "",
  } = params;

  // Validate required fields
  if (!slot_start_iso || !slot_end_iso || !patient_first_name || !patient_last_name || !patient_phone) {
    return {
      success: false,
      error: "Missing required booking details. Need: slot time, patient name, and phone number.",
    };
  }

  try {
    const slotStart = new Date(slot_start_iso);
    const slotEnd = new Date(slot_end_iso);

    if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
      return { success: false, error: "Invalid appointment time." };
    }

    const dayOfWeek = slotStart.getDay();
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    if (!OFFICE_OPEN_DAYS.has(isoDay)) {
      return {
        success: false,
        error: "The office is closed on that day. We're open Monday, Tuesday, Thursday, and Friday.",
      };
    }

    // HIPAA-safe naming
    const lastInitial = patient_last_name.trim().charAt(0).toUpperCase();
    const safeName = `${patient_first_name.trim()} ${lastInitial}.`;
    const appointmentLabel = APPOINTMENT_LABELS[appointment_type] || appointment_type;
    const summary = `${appointmentLabel} — ${safeName}`;

    const eventIdSeed = `${callId}|${provider_key}|${slot_start_iso}|${patient_first_name}|${patient_last_name}|${patient_phone}`;
    const eventId = `vx${crypto.createHash("sha256").update(eventIdSeed).digest("hex").slice(0, 24)}`;

    const description = [
      `Service: ${appointmentLabel}`,
      `Patient: ${patient_first_name} ${patient_last_name}`,
      `Phone: ${patient_phone}`,
      patient_email ? `Email: ${patient_email}` : null,
      `Type: ${patient_type}`,
      notes ? `Notes: ${notes}` : null,
      `---`,
      `Booked via VAPI Voice Agent | Call: ${callId} | ID: ${eventId}`,
    ]
      .filter(Boolean)
      .join("\n");

    const calendar = getCalendarClient();
    const calId = getCalendarId(provider_key);
    let googleEventId = null;
    let mirrorEvents = [];

    // Create event on Google Calendar
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
        console.log(`[vapi/book-appointment] Google Calendar event created: ${googleEventId}`);

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
            console.error("[vapi/book-appointment] Mirror failed:", mirrorErr.message);
          }
        }
      } catch (gcalErr) {
        console.error("[vapi/book-appointment] Google Calendar insert failed:", gcalErr.message);
      }
    }

    // Log appointment locally
    const appointment = {
      id: eventId,
      call_id: callId,
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
      status: "confirmed",
      booked_at: new Date().toISOString(),
      source: "vapi_voice_agent",
    };

    appendToStore("appointments", appointment);

    // Build human-readable confirmation
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

    console.log(`[vapi/book-appointment] Booked: ${eventId} — ${summary} on ${humanReadable} (gcal: ${googleEventId || "none"})`);

    return {
      success: true,
      source: googleEventId ? "google_calendar" : "local_only",
      confirmation_text: `Your appointment is confirmed for ${humanReadable}.`,
      appointment: {
        provider_key,
        human_readable: humanReadable,
        start_iso: slot_start_iso,
        end_iso: slot_end_iso,
        event_id: googleEventId || eventId,
      },
    };
  } catch (err) {
    console.error("[vapi/book-appointment] Error:", err.message);
    return {
      success: false,
      error: "I had trouble booking that appointment. Let me transfer you to the office.",
    };
  }
}

// ─── Legacy Tool Handlers ────────────────────────────────────────────

async function handleCaptureLead(callId, params) {
  const lead = {
    call_id: callId,
    interest_type: params.interest_type || "general",
    motivation: params.motivation || "",
    timeline: params.timeline || "unknown",
    prior_history: params.prior_history || "",
    notes: params.notes || "",
    captured_at: new Date().toISOString(),
  };

  const persisted = appendToStore("leads", lead);

  return {
    success: persisted,
    message: `Lead captured: ${lead.interest_type} interest, timeline ${lead.timeline}.`,
    lead_id: `lead_${Date.now()}`,
  };
}

async function handleRequestAppointment(callId, params) {
  const appointment = {
    call_id: callId,
    visit_type: params.visit_type || "general",
    time_preference: params.time_preference || "no_preference",
    priority: params.priority || "standard",
    patient_type: params.patient_type || "unknown",
    notes: params.notes || "",
    requested_at: new Date().toISOString(),
  };

  const persisted = appendToStore("appointments", appointment);

  const priorityLabel =
    appointment.priority === "emergency"
      ? "This has been marked as emergency priority."
      : "The scheduling team will follow up.";

  return {
    success: persisted,
    message: `Appointment request logged: ${appointment.visit_type}, ${appointment.time_preference} preferred. ${priorityLabel}`,
    request_id: `apt_${Date.now()}`,
  };
}

async function handleMarkEmergency(callId, params) {
  const emergency = {
    call_id: callId,
    issue_type: params.issue_type || "unknown",
    pain_level: params.pain_level || null,
    symptoms: params.symptoms || "",
    onset: params.onset || "",
    flagged_at: new Date().toISOString(),
  };

  const persisted = appendToStore("emergencies", emergency);

  return {
    success: persisted,
    message: `Emergency flagged: ${emergency.issue_type}, pain level ${emergency.pain_level || "not reported"}. This call is marked as priority.`,
    emergency_id: `emg_${Date.now()}`,
  };
}

async function handleLogReactivation(callId, params) {
  const reactivation = {
    call_id: callId,
    disposition: params.disposition || "unknown",
    interest_type: params.interest_type || "",
    follow_up_needed: params.follow_up_needed || false,
    notes: params.notes || "",
    logged_at: new Date().toISOString(),
  };

  const persisted = appendToStore("reactivations", reactivation);

  return {
    success: persisted,
    message: `Reactivation logged: ${reactivation.disposition}.`,
  };
}

// ─── Tool Router ─────────────────────────────────────────────────────

async function handleToolCall(callId, toolName, params) {
  switch (toolName) {
    case "check_availability":
      return handleCheckAvailability(callId, params);
    case "book_appointment":
      return handleBookAppointment(callId, params);
    case "capture_lead":
      return handleCaptureLead(callId, params);
    case "request_appointment":
      return handleRequestAppointment(callId, params);
    case "mark_emergency_priority":
      return handleMarkEmergency(callId, params);
    case "log_reactivation_interest":
      return handleLogReactivation(callId, params);
    default:
      console.warn(`[tool-handlers] Unknown tool: ${toolName}`);
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

module.exports = {
  handleToolCall,
  handleCheckAvailability,
  handleBookAppointment,
  handleCaptureLead,
  handleRequestAppointment,
  handleMarkEmergency,
  handleLogReactivation,
  readStore,
};
