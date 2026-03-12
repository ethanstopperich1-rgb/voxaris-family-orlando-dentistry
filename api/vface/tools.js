/**
 * Vercel Serverless Function — Tavus Tool Call Handler
 *
 * POST /api/vface/tools
 *
 * Handles tool calls from the Family Orlando Dentistry V·FACE Tavus CVI agent.
 * Tools: check_availability, book_appointment
 *
 * Tavus POSTs here when the LLM decides to invoke a tool.
 * Body: { tool_call_id, name, arguments (or input), conversation_id }
 * Response: { result: "<string result for the LLM>" }
 */

const https = require("https");

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ippdmoznwqwstdryrpnf.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

// Practice schedule: Mon, Tue, Thu, Fri — 8am–5pm ET
const OPEN_DAYS = [1, 2, 4, 5]; // JS day: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const OPEN_DAYS_LABELS = { 1: "Monday", 2: "Tuesday", 4: "Thursday", 5: "Friday" };
const SLOT_HOURS = [8, 9, 10, 11, 14, 15, 16]; // AM and PM slots (skip lunch)

// Appointment duration defaults by type (minutes)
const DURATION_MAP = {
  invisalign_consult:        60,
  cosmetic_consult:          45,
  whitening:                 60,
  implant_consult:           60,
  same_day_crown_consult:    45,
  emergency_exam:            30,
  general_new_patient:       60,
  general_existing_patient:  45,
  botox_tmj_eval:            45,
};

// ── Supabase helper ─────────────────────────────────────────────────────────

function supabaseInsert(table, record) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(record);
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true });
        } else {
          reject(new Error(`Supabase ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── Availability generator ───────────────────────────────────────────────────

/**
 * Generates realistic available slots for the next N open days.
 * Does not hit a real calendar — returns structured mock availability
 * that sounds natural when spoken by the AI.
 */
function generateSlots({ startDate, endDate, preferredDays, preferredTimeOfDay, appointmentType, urgency }) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now);
  const end   = endDate   ? new Date(endDate)   : new Date(now.getTime() + 14 * 86400000); // 2 weeks

  // For high urgency (emergency), push start to today/tomorrow
  if (urgency === "high") {
    start.setTime(now.getTime());
  }

  // Map preferred_time_of_day to hour ranges
  let allowedHours = SLOT_HOURS;
  if (preferredTimeOfDay === "morning")   allowedHours = SLOT_HOURS.filter(h => h < 12);
  if (preferredTimeOfDay === "afternoon") allowedHours = SLOT_HOURS.filter(h => h >= 12);

  // Map preferred_days strings to JS day numbers
  const preferredDayNums = new Set();
  if (preferredDays && preferredDays.length > 0) {
    for (const d of preferredDays) {
      if (d === "monday")   preferredDayNums.add(1);
      if (d === "tuesday")  preferredDayNums.add(2);
      if (d === "thursday") preferredDayNums.add(4);
      if (d === "friday")   preferredDayNums.add(5);
    }
  }

  const slots = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= end && slots.length < 5) {
    const dayNum = cursor.getDay();
    if (OPEN_DAYS.includes(dayNum)) {
      // Prefer requested days if specified
      if (preferredDayNums.size === 0 || preferredDayNums.has(dayNum)) {
        for (const hour of allowedHours) {
          if (slots.length >= 5) break;
          const slotTime = new Date(cursor);
          slotTime.setHours(hour, 0, 0, 0);
          // Don't show slots in the past + buffer 2 hours
          if (slotTime.getTime() > now.getTime() + 2 * 3600000) {
            slots.push(slotTime);
            if (slots.length >= 3) break; // max 2-3 per day for natural feel
          }
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // If no preferred-day slots found, fall back to any open day
  if (slots.length === 0) {
    const cursor2 = new Date(start);
    cursor2.setHours(0, 0, 0, 0);
    while (cursor2 <= end && slots.length < 4) {
      const dayNum = cursor2.getDay();
      if (OPEN_DAYS.includes(dayNum)) {
        for (const hour of allowedHours) {
          if (slots.length >= 4) break;
          const slotTime = new Date(cursor2);
          slotTime.setHours(hour, 0, 0, 0);
          if (slotTime.getTime() > now.getTime() + 2 * 3600000) {
            slots.push(slotTime);
            break;
          }
        }
      }
      cursor2.setDate(cursor2.getDate() + 1);
    }
  }

  return slots;
}

function formatSlotFriendly(date) {
  const days  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const h = date.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()} at ${hour12}:00 ${ampm}`;
}

// ── Tool Handlers ────────────────────────────────────────────────────────────

async function handleCheckAvailability(args) {
  const {
    appointment_type,
    service_line,
    patient_type,
    urgency,
    preferred_days,
    preferred_time_of_day,
    start_date,
    end_date,
  } = args;

  const duration = DURATION_MAP[appointment_type] || 45;

  const slots = generateSlots({
    startDate: start_date,
    endDate: end_date,
    preferredDays: preferred_days || [],
    preferredTimeOfDay: preferred_time_of_day || "no_preference",
    appointmentType: appointment_type,
    urgency: urgency || "low",
  });

  if (slots.length === 0) {
    return "I wasn't able to find open slots in that window. The office is open Monday, Tuesday, Thursday, and Friday. Would you like me to check a different time range, or would you prefer to leave a callback number so the team can reach you directly?";
  }

  const slotLines = slots.slice(0, 3).map(s => `• ${formatSlotFriendly(s)}`).join("\n");
  const apptLabel = appointment_type ? appointment_type.replace(/_/g, " ") : "appointment";
  const durationNote = duration ? ` (approximately ${duration} minutes)` : "";

  return `Here are available openings for a ${apptLabel}${durationNote}:\n${slotLines}\n\nWhich of these works best for you, or would you prefer a different day or time?`;
}

async function handleBookAppointment(args) {
  const {
    appointment_type,
    service_line,
    provider_key,
    slot_start_iso,
    slot_end_iso,
    patient_first_name,
    patient_last_name,
    patient_phone,
    patient_email,
    patient_type,
    notes,
    request_id,
  } = args;

  // Validate required fields
  if (!patient_first_name || !patient_last_name || !patient_phone) {
    return "I need a first name, last name, and callback phone number to complete the booking. Could you confirm those for me?";
  }

  if (!slot_start_iso) {
    return "I don't have a confirmed slot time. Could you confirm which opening you'd like?";
  }

  const record = {
    appointment_type: appointment_type || null,
    service_line: service_line || null,
    provider_key: provider_key || "main",
    slot_start_iso,
    slot_end_iso: slot_end_iso || null,
    patient_first_name,
    patient_last_name,
    patient_phone,
    patient_email: patient_email || null,
    patient_type: patient_type || "unknown",
    notes: notes || null,
    request_id: request_id || `vface-${Date.now()}`,
    source: "vface_tavus",
    status: "pending_confirmation",
    created_at: new Date().toISOString(),
  };

  // Write to Supabase — best effort, don't block the conversation on failure
  try {
    await supabaseInsert("vface_bookings", record);
  } catch (err) {
    console.error("[tools] Supabase write failed:", err.message);
    // Still confirm to the patient — staff will follow up
  }

  // Format the slot time for the confirmation message
  let slotDisplay = slot_start_iso;
  try {
    const slotDate = new Date(slot_start_iso);
    slotDisplay = formatSlotFriendly(slotDate);
  } catch (_) {}

  const apptLabel = appointment_type ? appointment_type.replace(/_/g, " ") : "appointment";
  const providerNote = provider_key && provider_key !== "main"
    ? ` with Dr. ${provider_key.charAt(0).toUpperCase() + provider_key.slice(1)}`
    : "";

  return `You're all set, ${patient_first_name}. Your ${apptLabel}${providerNote} is confirmed for ${slotDisplay}. The team will send a confirmation to ${patient_phone}${patient_email ? ` and ${patient_email}` : ""}. Is there anything else I can help you with before you go?`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    // Tavus sends: { tool_call_id, name, arguments or input, conversation_id }
    const toolCallId = body.tool_call_id || body.id || null;
    const toolName   = body.name || body.function_name || body.tool_name || null;
    const rawArgs    = body.arguments ?? body.input ?? body.args ?? {};
    const args       = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;

    console.log(`[vface/tools] tool=${toolName} call_id=${toolCallId}`);
    console.log(`[vface/tools] args=`, JSON.stringify(args));

    if (!toolName) {
      return res.status(400).json({ error: "Missing tool name" });
    }

    let result;

    if (toolName === "check_availability") {
      result = await handleCheckAvailability(args);
    } else if (toolName === "book_appointment") {
      result = await handleBookAppointment(args);
    } else {
      console.warn(`[vface/tools] Unknown tool: ${toolName}`);
      result = `I'm sorry, I ran into an issue with that request. Let me help you another way — would you like to leave your contact information so the team can follow up directly?`;
    }

    return res.status(200).json({ result });

  } catch (err) {
    console.error("[vface/tools] Handler error:", err);
    return res.status(200).json({
      result: "I ran into a brief technical issue. Let me take your information and have someone from the team follow up with you directly.",
    });
  }
};
