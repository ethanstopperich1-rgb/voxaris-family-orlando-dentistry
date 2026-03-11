/**
 * Vercel Serverless Function — V·FACE Status
 *
 * GET /api/vface/status
 *
 * Returns Tavus configuration status and missing credentials.
 */

const { isConfigured, getMissingCredentials } = require("../../vface/config/tavus-config");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const configured = isConfigured();
  const missing = getMissingCredentials();

  res.status(200).json({
    status: configured ? "ready" : "not_configured",
    tavus_configured: configured,
    missing_credentials: missing,
    practice: "Family Orlando Dentistry",
    server_time: new Date().toISOString(),
  });
};
