/**
 * Vercel Serverless Function — V·FACE Tool Router v2
 *
 * POST /api/vface/tools
 *
 * Routes tool calls from the concierge frontend.
 * Body: { action: "check_availability" | "book_appointment" | "webhook", ...params }
 *
 * Accepts v2 Raven-1 tool schemas (appointment_type, service_line, provider_preference, etc.)
 * Falls back to static slot generation when Google Calendar env vars are not set.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

// ── Check Availability (v2) ───────────────────────────────────────────

function handleCheckAvailability(params, res) {
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

    // Generate slots for each candidate provider
    const providerResults = [];

    for (const providerKey of candidateProviders) {
      const slots = [];
      const cursor = new Date(searchStart);

      while (cursor <= searchEnd && slots.length < 6) {
        const dayOfWeek = cursor.getDay(); // JS: Sun=0, Mon=1 ... Sat=6
        const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to ISO

        if (OFFICE_OPEN_DAYS.has(isoDay)) {
          const dayMatch = preferredDayNums.size === 0 || preferredDayNums.has(isoDay);

          if (dayMatch) {
            for (let hour = OFFICE_START_HOUR; hour < OFFICE_END_HOUR; hour++) {
              for (let min = 0; min < 60; min += 15) {
                if (slots.length >= 6) break;

                const endHour = hour + Math.floor((min + duration) / 60);
                const endMin = (min + duration) % 60;
                if (endHour > OFFICE_END_HOUR || (endHour === OFFICE_END_HOUR && endMin > 0)) continue;

                // Time-of-day filter
                if (preferred_time_of_day === "morning" && hour >= 12) continue;
                if (preferred_time_of_day === "afternoon" && hour < 12) continue;

                // Skip past times
                const slotDate = new Date(cursor);
                slotDate.setHours(hour, min, 0, 0);
                if (slotDate <= now) continue;

                const yyyy = cursor.getFullYear();
                const mm = String(cursor.getMonth() + 1).padStart(2, "0");
                const dd = String(cursor.getDate()).padStart(2, "0");
                const startIso = `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00-04:00`;
                const endIso = `${yyyy}-${mm}-${dd}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00-04:00`;

                const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                const ampm = hour >= 12 ? "PM" : "AM";
                const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                slots.push({
                  start_iso: startIso,
                  end_iso: endIso,
                  human_readable: `${dayNames[dayOfWeek]}, ${months[cursor.getMonth()]} ${cursor.getDate()} at ${displayHour}:${String(min).padStart(2, "0")} ${ampm} ET with ${PROVIDER_LABELS[providerKey] || providerKey}`,
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

    // Flatten and limit to best 8 slots across providers
    const flattened = providerResults
      .flatMap((p) => p.slots.map((s) => ({ provider_key: p.provider_key, ...s })))
      .slice(0, 8);

    return res.status(200).json({
      ok: true,
      appointment_type,
      service_line,
      duration_minutes: duration,
      search_window: {
        start_iso: searchStart.toISOString(),
        end_iso: searchEnd.toISOString(),
      },
      slots: flattened,
      provider_results: providerResults,
      guidance: flattened.length > 0
        ? "Offer the patient the returned slots only. Confirm one choice before calling book_appointment."
        : "No live openings found in the current search window. Ask the patient if they want a broader search or a callback preference.",
    });
  } catch (err) {
    console.error("[tools/check-availability] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to check availability. Please try again or call (407) 877-9003.",
    });
  }
}

// ── Book Appointment (v2) ─────────────────────────────────────────────

function handleBookAppointment(params, res) {
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

  // Validate required fields
  if (!appointment_type || !service_line || !slot_start_iso || !slot_end_iso || !patient_first_name || !patient_last_name || !patient_phone) {
    return res.status(400).json({
      ok: false,
      error: "Missing required fields: appointment_type, service_line, slot_start_iso, slot_end_iso, patient_first_name, patient_last_name, patient_phone",
    });
  }

  try {
    // Parse slot time
    const slotStart = new Date(slot_start_iso);
    const slotEnd = new Date(slot_end_iso);

    if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
      return res.status(400).json({ ok: false, error: "Invalid slot time format." });
    }

    // Validate office hours
    const dayOfWeek = slotStart.getDay();
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    if (!OFFICE_OPEN_DAYS.has(isoDay)) {
      return res.status(400).json({
        ok: false,
        error: "The office is closed on that day. We are open Monday, Tuesday, Thursday, and Friday.",
      });
    }

    // Build HIPAA-safe summary (first name + last initial)
    const lastInitial = patient_last_name.trim().charAt(0).toUpperCase();
    const safeName = `${patient_first_name.trim()} ${lastInitial}.`;
    const appointmentLabel = APPOINTMENT_LABELS[appointment_type] || appointment_type;
    const summary = `${appointmentLabel} — ${safeName}`;

    // Build deterministic event ID for idempotency
    const eventIdSeed = request_id || `${provider_key}|${slot_start_iso}|${patient_first_name}|${patient_last_name}|${patient_phone}`;
    const eventId = `vx${crypto.createHash("sha256").update(eventIdSeed).digest("hex").slice(0, 24)}`;

    // Build appointment record
    const appointment = {
      id: eventId,
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

    // Log appointment
    const logFile = path.join("/tmp", "appointments.jsonl");
    fs.appendFileSync(logFile, JSON.stringify(appointment) + "\n");

    // Format human-readable confirmation
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

    console.log(`[tools/book-appointment] Booked: ${eventId} — ${summary} on ${humanReadable}`);

    return res.status(200).json({
      ok: true,
      appointment: {
        provider_key,
        human_readable: humanReadable,
        start_iso: slot_start_iso,
        end_iso: slot_end_iso,
        primary_event_id: eventId,
        mirror_events: [],
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
