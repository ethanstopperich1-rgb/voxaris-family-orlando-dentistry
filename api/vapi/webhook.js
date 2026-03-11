/**
 * Vercel Serverless Function — VAPI Webhook
 *
 * POST /api/vapi/webhook
 *
 * Main webhook endpoint for all VAPI events (assistant-request,
 * tool-calls, status-update, end-of-call-report, transcript, hang).
 */

const { handleWebhook } = require("../../vapi/api/webhook");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await handleWebhook(req.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[api/vapi/webhook] Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
