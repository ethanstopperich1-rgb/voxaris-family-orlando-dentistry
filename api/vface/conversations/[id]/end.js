/**
 * Vercel Serverless Function — End V·FACE Conversation
 *
 * POST /api/vface/conversations/:id/end
 *
 * Terminates a Tavus CVI conversation.
 */

const { isConfigured } = require("../../../../vface/config/tavus-config");
const { endConversation } = require("../../../../vface/server/tavus-client");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isConfigured()) {
    return res.status(503).json({ error: "tavus_not_configured" });
  }

  const { id } = req.query;

  try {
    await endConversation(id);
    return res.status(200).json({ status: "ended", conversation_id: id });
  } catch (err) {
    return res.status(err.status || 500).json({
      error: "end_failed",
      details: err.body || err.message,
    });
  }
};
