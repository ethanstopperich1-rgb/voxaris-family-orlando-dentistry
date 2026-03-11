/**
 * Vercel Serverless Function — Outbound Call Trigger
 *
 * POST /api/vapi/outbound
 *
 * Creates an outbound call via the VAPI API.
 * Body: { campaign, phone_number, patient_name?, months_overdue?, original_interest_date? }
 */

const { triggerOutboundCall } = require("../../vapi/api/outbound");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await triggerOutboundCall(req.body);
    const status = result.success ? 200 : 400;
    return res.status(status).json(result);
  } catch (err) {
    console.error("[api/vapi/outbound] Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
