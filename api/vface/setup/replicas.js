/**
 * Vercel Serverless Function — List Tavus Replicas
 *
 * GET /api/vface/setup/replicas
 *
 * Dev-only: Lists available Tavus replicas.
 */

const { config } = require("../../../vface/config/tavus-config");
const { listReplicas } = require("../../../vface/server/tavus-client");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!config.apiKey) {
    return res.status(503).json({ error: "TAVUS_API_KEY not set" });
  }

  try {
    const result = await listReplicas();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({
      error: "replica_list_failed",
      details: err.body || err.message,
    });
  }
};
