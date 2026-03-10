/**
 * assistant-request Handler
 *
 * When a VAPI phone number receives an inbound call, VAPI sends an
 * assistant-request event asking which assistant (or squad) to use.
 *
 * We return the full inbound squad config so that calls are routed
 * through the V·TEAMS flow: Receptionist → Qualifier → Specialist.
 */

const { getInboundSquad } = require("../agents/inbound/squad");

function handleAssistantRequest(body) {
  const call = body.message?.call || {};
  const callerNumber = call.customer?.number || "unknown";

  console.log(
    `[assistant-request] Inbound call from ${callerNumber}, call_id: ${call.id || "unknown"}`
  );

  const serverUrl =
    process.env.VAPI_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/vapi/webhook`
      : "https://localhost:3000/api/vapi/webhook";

  return {
    squad: getInboundSquad(serverUrl),
  };
}

module.exports = { handleAssistantRequest };
