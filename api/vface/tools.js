/**
 * Vercel Serverless Function — Tavus V·FACE Tool Call Handler
 *
 * POST /api/vface/tools
 *
 * Receives tool_call events from Tavus CVI (via callback_url set on each
 * conversation) for the Family Orlando Dentistry V·FACE agent.
 *
 * Delegates to the same check_availability / book_appointment handlers
 * used by the VAPI voice agent — same Google Calendar, same data store.
 *
 * Tavus callback body:
 *   { event_type: "tool_call", conversation_id, properties: { tool_call_id, name, arguments } }
 *
 * Response:
 *   { tool_call_id, result: "<string>" }
 */

const { handleCheckAvailability, handleBookAppointment } = require("../../vapi/lib/tool-handlers");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert the VAPI handler's result object into a natural spoken string
 * that the Tavus LLM can use directly in conversation.
 */
function toSpokenResult(toolName, result) {
  if (toolName === "check_availability") {
    if (!result.success || !result.slots || result.slots.length === 0) {
      return "I wasn't able to find any open slots in that window. The office is open Monday, Tuesday, Thursday, and Friday. Would you like to try a different time, or would you prefer to leave your contact info for the team to reach you?";
    }
    const top = result.slots.slice(0, 3);
    const lines = top.map(s => `• ${s.human_readable}`).join("\n");
    return `Here are some available openings:\n${lines}\n\nWhich of those works best for you?`;
  }

  if (toolName === "book_appointment") {
    if (!result.success) {
      return result.error || "I had trouble completing that booking. Let me get your contact info and have someone from the team follow up directly.";
    }
    return result.confirmation_text || `Your appointment is confirmed. Is there anything else I can help you with?`;
  }

  return JSON.stringify(result);
}

// ── Main handler ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const eventType = body.event_type || body.type || null;

    // Pass through non-tool-call Tavus events (conversation_started, ended, etc.)
    if (eventType && eventType !== "tool_call") {
      console.log(`[vface/tools] event=${eventType} convo=${body.conversation_id}`);
      return res.status(200).json({ received: true });
    }

    // Unwrap Tavus callback — two possible formats:
    // Format A: { event_type: "tool_call", properties: { tool_call_id, name, arguments }, conversation_id }
    // Format B: { tool_call_id, name, arguments }  (flat)
    const props      = (body.properties && typeof body.properties === "object") ? body.properties : body;
    const toolCallId = props.tool_call_id || props.id || null;
    const toolName   = props.name || props.function_name || null;
    const rawArgs    = props.arguments ?? props.input ?? {};
    const args       = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
    const convId     = body.conversation_id || "vface";

    console.log(`[vface/tools] tool=${toolName} id=${toolCallId} convo=${convId}`);
    console.log(`[vface/tools] args=${JSON.stringify(args)}`);

    if (!toolName) {
      console.warn("[vface/tools] No tool name — likely a non-tool callback, ignoring");
      return res.status(200).json({ received: true });
    }

    let result;

    if (toolName === "check_availability") {
      result = await handleCheckAvailability(convId, args);
    } else if (toolName === "book_appointment") {
      result = await handleBookAppointment(convId, args);
    } else {
      console.warn(`[vface/tools] Unknown tool: ${toolName}`);
      result = { success: false, error: "Unknown tool" };
    }

    const spoken = toSpokenResult(toolName, result);
    console.log(`[vface/tools] result: ${spoken.slice(0, 120)}...`);

    return res.status(200).json({ tool_call_id: toolCallId, result: spoken });

  } catch (err) {
    console.error("[vface/tools] Unhandled error:", err);
    return res.status(200).json({
      result: "I ran into a brief technical issue. Let me get your contact information and have someone follow up with you directly.",
    });
  }
};
