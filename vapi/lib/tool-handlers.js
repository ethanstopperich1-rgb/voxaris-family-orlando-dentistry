/**
 * Tool Call Handlers for Family Orlando Dentistry
 *
 * Each handler receives (callId, params) and returns a result object.
 * Results are JSON-stringified before being sent back to VAPI.
 *
 * Data is persisted to JSON files in /vapi/data/.
 * For production, swap appendToStore() with Supabase/Drizzle writes.
 */

const fs = require("fs");
const path = require("path");

// ─── Persistence Layer ───

const DATA_DIR = path.join(__dirname, "..", "data");

/**
 * Append a record to a JSON-lines file.
 * Creates the data directory and file if they don't exist.
 */
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

/**
 * Read all records from a store (for debugging/reporting).
 */
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

// ─── Tool Handlers ───

/**
 * capture_lead — Record a new lead with interest details
 */
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

/**
 * request_appointment — Submit an appointment request
 */
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

/**
 * mark_emergency_priority — Flag a call as dental emergency
 */
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

/**
 * log_reactivation_interest — Record outbound call disposition
 */
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

/**
 * Route a tool call to the correct handler.
 *
 * NOTE: transfer_to_human and endCall are VAPI native tools —
 * they do NOT route through this handler. VAPI executes them directly.
 */
async function handleToolCall(callId, toolName, params) {
  switch (toolName) {
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
  handleCaptureLead,
  handleRequestAppointment,
  handleMarkEmergency,
  handleLogReactivation,
  readStore,
};
