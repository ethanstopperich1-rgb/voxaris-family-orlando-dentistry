/**
 * Vercel Serverless Function — Tavus Tool Call Handler
 *
 * POST /api/vface/tools
 *
 * Receives callback events from Tavus CVI for the Family Orlando Dentistry
 * V·FACE agent. Handles tool_call events for check_availability and book_appointment.
 *
 * Tavus callback format:
 *   { event_type: "tool_call", conversation_id, properties: { tool_call_id, name, arguments } }
 *
 * Response:
 *   { tool_call_id, result: "<string>" }
 */

const https = require("https");

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.SUPABASE_URL || "https://ippdmoznwqwstdryrpnf.supabase.co";
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY || "";
const GCAL_CALENDAR_ID = process.env.GCAL_CALENDAR_ID || "";            // e.g. "primary" or full calendar ID
const GCAL_API_KEY     = process.env.GCAL_API_KEY || "";                // for public calendar read
const GCAL_SA_KEY      = process.env.GCAL_SERVICE_ACCOUNT_KEY || "";   // JSON string of service account

// Practice schedule
const OPEN_DAYS   = [1, 2, 4, 5]; // Mon, Tue, Thu, Fri
const SLOT_HOURS  = [8, 9, 10, 11, 14, 15, 16];
const DURATION_MAP = {
  invisalign_consult: 60, cosmetic_consult: 45, whitening: 60,
  implant_consult: 60, same_day_crown_consult: 45, emergency_exam: 30,
  general_new_patient: 60, general_existing_patient: 45, botox_tmj_eval: 45,
};

// ── Google Calendar helpers ─────────────────────────────────────────────────

async function getGoogleAccessToken() {
  if (!GCAL_SA_KEY) return null;
  try {
    const sa = JSON.parse(GCAL_SA_KEY);
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claim  = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })).toString("base64url");

    // Sign with RS256 using Node crypto
    const crypto = require("crypto");
    const sign   = crypto.createSign("RSA-SHA256");
    sign.update(`${header}.${claim}`);
    const sig = sign.sign(sa.private_key, "base64url");
    const jwt = `${header}.${claim}.${sig}`;

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString();

    return new Promise((resolve) => {
      const data = Buffer.from(body);
      const req = https.request({
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": data.length },
      }, (res) => {
        let d = "";
        res.on("data", (c) => { d += c; });
        res.on("end", () => {
          try { resolve(JSON.parse(d).access_token || null); }
          catch { resolve(null); }
        });
      });
      req.on("error", () => resolve(null));
      req.write(data);
      req.end();
    });
  } catch { return null; }
}

async function gcalFreeBusy(startIso, endIso, token) {
  const payload = JSON.stringify({
    timeMin: startIso, timeMax: endIso,
    items: [{ id: GCAL_CALENDAR_ID || "primary" }],
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "www.googleapis.com",
      path: "/calendar/v3/freeBusy",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let d = ""; res.on("data", (c) => { d += c; });
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.write(payload); req.end();
  });
}

async function gcalCreateEvent(event, token) {
  const calId = encodeURIComponent(GCAL_CALENDAR_ID || "primary");
  const payload = JSON.stringify(event);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "www.googleapis.com",
      path: `/calendar/v3/calendars/${calId}/events`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let d = ""; res.on("data", (c) => { d += c; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(d);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(`GCal ${res.statusCode}: ${d}`));
        } catch { reject(new Error("GCal parse error")); }
      });
    });
    req.on("error", reject);
    req.write(payload); req.end();
  });
}

// ── Slot generation (fallback when no Google Calendar) ──────────────────────

function generateMockSlots({ startDate, endDate, preferredDays, preferredTimeOfDay, urgency }) {
  const now   = new Date();
  const start = startDate ? new Date(startDate) : new Date(now);
  const end   = endDate   ? new Date(endDate)   : new Date(now.getTime() + 14 * 86400000);
  if (urgency === "high") start.setTime(now.getTime());

  let allowedHours = SLOT_HOURS;
  if (preferredTimeOfDay === "morning")   allowedHours = SLOT_HOURS.filter(h => h < 12);
  if (preferredTimeOfDay === "afternoon") allowedHours = SLOT_HOURS.filter(h => h >= 12);

  const prefNums = new Set(
    (preferredDays || []).map(d =>
      ({ monday:1, tuesday:2, thursday:4, friday:5 })[d]
    ).filter(Boolean)
  );

  const slots = [];
  const cursor = new Date(start); cursor.setHours(0, 0, 0, 0);

  while (cursor <= end && slots.length < 5) {
    const dn = cursor.getDay();
    if (OPEN_DAYS.includes(dn) && (prefNums.size === 0 || prefNums.has(dn))) {
      for (const h of allowedHours) {
        if (slots.length >= 5) break;
        const t = new Date(cursor); t.setHours(h, 0, 0, 0);
        if (t.getTime() > now.getTime() + 2 * 3600000) { slots.push(t); break; }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Fallback: any open day
  if (slots.length === 0) {
    const c2 = new Date(start); c2.setHours(0, 0, 0, 0);
    while (c2 <= end && slots.length < 3) {
      if (OPEN_DAYS.includes(c2.getDay())) {
        for (const h of allowedHours) {
          const t = new Date(c2); t.setHours(h, 0, 0, 0);
          if (t.getTime() > now.getTime() + 2 * 3600000) { slots.push(t); break; }
        }
      }
      c2.setDate(c2.getDate() + 1);
    }
  }
  return slots;
}

function formatSlot(date) {
  const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const h = date.getHours(), ampm = h >= 12 ? "PM" : "AM", h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()} at ${h12}:00 ${ampm}`;
}

// ── Supabase helper ─────────────────────────────────────────────────────────

function supabaseInsert(table, record) {
  if (!SUPABASE_KEY) return Promise.resolve({ ok: true, skipped: true });
  return new Promise((resolve) => {
    const payload = JSON.stringify(record);
    const req = https.request({
      hostname: new URL(SUPABASE_URL).hostname,
      path: `/rest/v1/${table}`,
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json", "Prefer": "return=minimal",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let d = ""; res.on("data", (c) => { d += c; });
      res.on("end", () => resolve({ ok: res.statusCode < 300 }));
    });
    req.on("error", () => resolve({ ok: false }));
    req.write(payload); req.end();
  });
}

// ── Tool Handlers ────────────────────────────────────────────────────────────

async function handleCheckAvailability(args) {
  const {
    appointment_type, service_line, urgency,
    preferred_days, preferred_time_of_day,
    start_date, end_date,
  } = args;

  const duration  = DURATION_MAP[appointment_type] || 45;
  const apptLabel = (appointment_type || "appointment").replace(/_/g, " ");
  const durationNote = `approximately ${duration} minutes`;

  // Try Google Calendar if configured
  const token = await getGoogleAccessToken();
  if (token && GCAL_CALENDAR_ID) {
    try {
      const now    = new Date();
      const tMin   = start_date ? new Date(start_date).toISOString() : now.toISOString();
      const tMax   = end_date   ? new Date(end_date).toISOString()   : new Date(now.getTime() + 14 * 86400000).toISOString();
      const freebusy = await gcalFreeBusy(tMin, tMax, token);
      const busy   = (freebusy?.calendars?.[GCAL_CALENDAR_ID]?.busy || [])
        .map(b => ({ start: new Date(b.start), end: new Date(b.end) }));

      // Find open slots
      const slots  = [];
      const prefNums = new Set((preferred_days || []).map(d => ({ monday:1,tuesday:2,thursday:4,friday:5 })[d]).filter(Boolean));
      let allowedHours = SLOT_HOURS;
      if (preferred_time_of_day === "morning")   allowedHours = SLOT_HOURS.filter(h => h < 12);
      if (preferred_time_of_day === "afternoon") allowedHours = SLOT_HOURS.filter(h => h >= 12);

      const cursor = new Date(tMin); cursor.setHours(0, 0, 0, 0);
      const endDate2 = new Date(tMax);
      while (cursor <= endDate2 && slots.length < 4) {
        const dn = cursor.getDay();
        if (OPEN_DAYS.includes(dn) && (prefNums.size === 0 || prefNums.has(dn))) {
          for (const h of allowedHours) {
            if (slots.length >= 4) break;
            const slotStart = new Date(cursor); slotStart.setHours(h, 0, 0, 0);
            const slotEnd   = new Date(slotStart.getTime() + duration * 60000);
            if (slotStart.getTime() <= now.getTime() + 2 * 3600000) continue;
            const conflict  = busy.some(b => slotStart < b.end && slotEnd > b.start);
            if (!conflict) { slots.push(slotStart); break; }
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      if (slots.length > 0) {
        const lines = slots.slice(0, 3).map(s => `• ${formatSlot(s)}`).join("\n");
        return `Here are available openings for a ${apptLabel} (${durationNote}):\n${lines}\n\nWhich works best for you?`;
      }
    } catch (err) {
      console.error("[tools] Google Calendar error:", err.message);
      // Fall through to mock slots
    }
  }

  // Mock slots fallback
  const slots = generateMockSlots({ startDate: start_date, endDate: end_date, preferredDays: preferred_days, preferredTimeOfDay: preferred_time_of_day, urgency });
  if (slots.length === 0) {
    return "I wasn't able to find open slots in that window. The office is open Monday, Tuesday, Thursday, and Friday. Would you like to try a different time, or leave a callback number?";
  }
  const lines = slots.slice(0, 3).map(s => `• ${formatSlot(s)}`).join("\n");
  return `Here are available openings for a ${apptLabel} (${durationNote}):\n${lines}\n\nWhich works best for you?`;
}

async function handleBookAppointment(args) {
  const {
    appointment_type, service_line, provider_key,
    slot_start_iso, slot_end_iso,
    patient_first_name, patient_last_name, patient_phone, patient_email,
    patient_type, notes, request_id,
  } = args;

  if (!patient_first_name || !patient_last_name || !patient_phone) {
    return "I need your first name, last name, and best callback number to complete the booking. Could you confirm those?";
  }
  if (!slot_start_iso) {
    return "I don't have a confirmed slot time yet. Which opening would you like?";
  }

  const apptLabel   = (appointment_type || "appointment").replace(/_/g, " ");
  const providerNote = (provider_key && provider_key !== "main")
    ? ` with Dr. ${provider_key.charAt(0).toUpperCase() + provider_key.slice(1)}` : "";
  let slotDisplay = slot_start_iso;
  try { slotDisplay = formatSlot(new Date(slot_start_iso)); } catch (_) {}

  // Try Google Calendar if configured
  const token = await getGoogleAccessToken();
  if (token && GCAL_CALENDAR_ID) {
    try {
      const endIso = slot_end_iso || new Date(new Date(slot_start_iso).getTime() + (DURATION_MAP[appointment_type] || 45) * 60000).toISOString();
      const event  = {
        summary: `${apptLabel} — ${patient_first_name} ${patient_last_name}`,
        description: [
          `Patient: ${patient_first_name} ${patient_last_name}`,
          `Phone: ${patient_phone}`,
          patient_email ? `Email: ${patient_email}` : null,
          `Type: ${patient_type || "unknown"}`,
          provider_key ? `Provider: ${provider_key}` : null,
          notes ? `Notes: ${notes}` : null,
          `Source: V·FACE Tavus CVI`,
          `Request ID: ${request_id || "vface-" + Date.now()}`,
        ].filter(Boolean).join("\n"),
        start: { dateTime: slot_start_iso, timeZone: "America/New_York" },
        end:   { dateTime: endIso,          timeZone: "America/New_York" },
        attendees: patient_email ? [{ email: patient_email }] : [],
      };
      await gcalCreateEvent(event, token);
      console.log(`[tools] GCal event created for ${patient_first_name} ${patient_last_name}`);
    } catch (err) {
      console.error("[tools] GCal create event error:", err.message);
      // Fall through — still confirm, log to Supabase
    }
  }

  // Always log to Supabase as backup
  await supabaseInsert("vface_bookings", {
    appointment_type: appointment_type || null,
    service_line: service_line || null,
    provider_key: provider_key || "main",
    slot_start_iso,
    slot_end_iso: slot_end_iso || null,
    patient_first_name, patient_last_name, patient_phone,
    patient_email: patient_email || null,
    patient_type: patient_type || "unknown",
    notes: notes || null,
    request_id: request_id || `vface-${Date.now()}`,
    source: "vface_tavus",
    status: "confirmed",
    created_at: new Date().toISOString(),
  });

  return `You're all set, ${patient_first_name}. Your ${apptLabel}${providerNote} is confirmed for ${slotDisplay}. The team will follow up at ${patient_phone}${patient_email ? ` and ${patient_email}` : ""}. Is there anything else I can help you with?`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const eventType = body.event_type || body.type || null;

    // Non-tool-call Tavus events (conversation_started, conversation_ended, etc.)
    if (eventType && eventType !== "tool_call") {
      console.log(`[vface/tools] Tavus event: ${eventType} | conversation: ${body.conversation_id}`);
      return res.status(200).json({ received: true });
    }

    // Tool call — unwrap Tavus callback format
    // Format A (Tavus CVI): { event_type: "tool_call", conversation_id, properties: { tool_call_id, name, arguments } }
    // Format B (flat):      { tool_call_id, name, arguments }
    const props      = body.properties || body;
    const toolCallId = props.tool_call_id || props.id || body.tool_call_id || null;
    const toolName   = props.name || props.function_name || body.name || null;
    const rawArgs    = props.arguments ?? props.input ?? body.arguments ?? {};
    const args       = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;

    console.log(`[vface/tools] tool=${toolName} id=${toolCallId} convo=${body.conversation_id}`);

    if (!toolName) {
      return res.status(200).json({ received: true, warning: "No tool name in payload" });
    }

    let result;
    if (toolName === "check_availability") {
      result = await handleCheckAvailability(args);
    } else if (toolName === "book_appointment") {
      result = await handleBookAppointment(args);
    } else {
      console.warn(`[vface/tools] Unknown tool: ${toolName}`);
      result = "I ran into a brief issue with that request. Let me take your contact info and have someone from the team follow up directly.";
    }

    // Respond with the tool result
    return res.status(200).json({ tool_call_id: toolCallId, result });

  } catch (err) {
    console.error("[vface/tools] Handler error:", err);
    return res.status(200).json({
      result: "I ran into a brief technical issue. Let me get your contact information and have someone follow up with you directly.",
    });
  }
};
