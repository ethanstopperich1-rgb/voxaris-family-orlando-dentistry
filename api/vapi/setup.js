/**
 * Vercel Serverless Function — Agent Setup/Provisioning
 *
 * POST /api/vapi/setup
 *
 * Creates outbound assistants and inbound squad in VAPI.
 * Protected by SETUP_SECRET header.
 */

const { runSetup } = require("../../vapi/api/setup");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth check
  const secret = req.headers["x-setup-secret"];
  if (process.env.SETUP_SECRET && secret !== process.env.SETUP_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await runSetup();
    return res.status(200).json({ success: true, created: result });
  } catch (err) {
    console.error("[api/vapi/setup] Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
