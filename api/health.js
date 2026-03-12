/**
 * Vercel Serverless Function — Health Check
 *
 * GET /api/health (also rewritten from /health)
 */

module.exports = function handler(req, res) {
  res.status(200).json({
    status: "ok",
    service: "voxaris-family-orlando-dentistry",
    platform: "vercel",
    endpoints: [
      "POST /api/vapi/webhook",
      "POST /api/vapi/outbound",
      "POST /api/vapi/setup",
      "GET  /api/vface/status",
      "POST /api/vface/conversations",
      "POST /api/vface/tools",
      "GET  /api/health",
    ],
  });
};
