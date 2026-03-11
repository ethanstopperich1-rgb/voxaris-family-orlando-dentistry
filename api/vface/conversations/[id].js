/**
 * Vercel Serverless Function — Get V·FACE Conversation
 *
 * GET /api/vface/conversations/:id
 *
 * Retrieves details about a Tavus CVI conversation.
 */

const { isConfigured } = require("../../../vface/config/tavus-config");
const { getConversation } = require("../../../vface/server/tavus-client");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isConfigured()) {
    return res.status(503).json({ error: "tavus_not_configured" });
  }

  const { id } = req.query;

  try {
    const result = await getConversation(id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({
      error: "fetch_failed",
      details: err.body || err.message,
    });
  }
};
