/**
 * Tool Call Handlers for Family Orlando Dentistry
 *
 * Each handler receives (callId, params) and returns a result object.
 * Results are JSON-stringified before being sent back to VAPI.
 *
 * In production, these would write to a database (Drizzle/Postgres).
 * Currently they log to console and return confirmation objects.
 */

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

  console.log("[tool:capture_lead]", JSON.stringify(lead));

  // TODO: Insert into leads table
  // await db.insert(leads).values(lead);

  return {
    success: true,
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

  console.log("[tool:request_appointment]", JSON.stringify(appointment));

  // TODO: Insert into appointment_requests table
  // await db.insert(appointmentRequests).values(appointment);

  const priorityLabel =
    appointment.priority === "emergency"
      ? "This has been marked as emergency priority."
      : "The scheduling team will follow up.";

  return {
    success: true,
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

  console.log("[tool:mark_emergency_priority]", JSON.stringify(emergency));

  // TODO: Insert into emergency_flags table + send alert
  // await db.insert(emergencyFlags).values(emergency);
  // await sendEmergencyAlert(emergency);

  return {
    success: true,
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

  console.log("[tool:log_reactivation_interest]", JSON.stringify(reactivation));

  // TODO: Update patient record with reactivation status
  // await db.insert(reactivationLogs).values(reactivation);

  return {
    success: true,
    message: `Reactivation logged: ${reactivation.disposition}.`,
  };
}

/**
 * transfer_to_human — Transfer caller to live staff
 */
async function handleTransferToHuman(callId, params) {
  const transfer = {
    call_id: callId,
    reason: params.reason || "caller requested",
    context_summary: params.context_summary || "",
    requested_at: new Date().toISOString(),
  };

  console.log("[tool:transfer_to_human]", JSON.stringify(transfer));

  // TODO: Trigger actual transfer via VAPI's transferCall or SIP
  // The transfer destination number is set in env: PRACTICE_TRANSFER_NUMBER

  return {
    success: true,
    message: "Transferring to the practice team now.",
    transfer_number: process.env.PRACTICE_TRANSFER_NUMBER || "+14078779003",
  };
}

/**
 * Route a tool call to the correct handler
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
    case "transfer_to_human":
      return handleTransferToHuman(callId, params);
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
  handleTransferToHuman,
};
