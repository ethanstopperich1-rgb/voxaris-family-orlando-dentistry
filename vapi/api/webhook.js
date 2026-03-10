/**
 * VAPI Webhook Handler
 *
 * Main entry point for all VAPI webhook events.
 * This is the serverUrl configured on all assistants.
 *
 * Endpoint: POST /api/vapi/webhook
 *
 * Handles:
 *   - assistant-request  → Returns inbound squad config
 *   - tool-calls         → Executes tools and returns results
 *   - status-update      → Logs call lifecycle events
 *   - end-of-call-report → Stores transcript, cost, recording
 *   - transcript         → Real-time partial transcript (logged)
 *   - hang               → Agent timeout (logged)
 *
 * For Next.js App Router, copy this into:
 *   app/api/vapi/webhook/route.js
 *
 * For Express/standalone, use the handleWebhook function directly.
 */

const { handleAssistantRequest } = require("../handlers/assistant-request");
const { handleToolCalls } = require("../handlers/tool-calls");
const { handleStatusUpdate } = require("../handlers/status-update");
const { handleEndOfCallReport } = require("../handlers/end-of-call-report");

/**
 * Core webhook router.
 * Accepts parsed JSON body, returns response object.
 */
async function handleWebhook(body) {
  const messageType = body.message?.type || "unknown";
  const callId = body.message?.call?.id || "unknown";

  console.log(`[webhook] event=${messageType} call=${callId}`);

  switch (messageType) {
    case "assistant-request":
      return handleAssistantRequest(body);

    case "tool-calls":
      return handleToolCalls(body);

    case "status-update":
      return handleStatusUpdate(body);

    case "end-of-call-report":
      return handleEndOfCallReport(body);

    case "transcript": {
      const transcript = body.message?.transcript || {};
      console.log(
        `[transcript] call=${callId} role=${transcript.role || "?"} ` +
          `text="${(transcript.text || "").substring(0, 80)}"`
      );
      return { ok: true };
    }

    case "hang":
      console.warn(`[hang] call=${callId} — agent timed out`);
      return { ok: true };

    default:
      console.log(`[webhook] Unhandled event type: ${messageType}`);
      return { ok: true };
  }
}

// ─── Next.js App Router Export ───
// Uncomment if using as app/api/vapi/webhook/route.js:
//
// import { NextRequest, NextResponse } from "next/server";
// export const runtime = "nodejs";
// export const maxDuration = 30;
//
// export async function POST(request) {
//   const body = await request.json();
//   const result = await handleWebhook(body);
//   return NextResponse.json(result);
// }

// ─── Express Export ───

module.exports = { handleWebhook };
