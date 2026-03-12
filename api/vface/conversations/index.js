/**
 * Vercel Serverless Function — Create V·FACE Conversation
 *
 * POST /api/vface/conversations
 *
 * Creates a new Tavus CVI session with contextual greeting.
 * Body: { visitor_name?, concern?, urgency? }
 */

const { isConfigured, getMissingCredentials } = require("../../../vface/config/tavus-config");
const { createConversation } = require("../../../vface/server/tavus-client");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      error: "tavus_not_configured",
      message: "Tavus credentials are not configured.",
      missing: getMissingCredentials(),
    });
  }

  try {
    const { visitor_name, concern, urgency } = req.body || {};

    let greeting =
      "Hi, welcome to Family Orlando Dentistry. I can help with appointments, Invisalign consultations, emergency concerns, or any questions about the practice. What brings you in today?";

    if (visitor_name) {
      greeting = `Hi ${visitor_name}, welcome to Family Orlando Dentistry. I can help with appointments, Invisalign consultations, emergency concerns, or any questions. What can I do for you today?`;
    }

    let context = "";
    if (concern) {
      context += `The visitor has indicated interest in: ${concern}. `;
    }
    if (urgency === "emergency") {
      context += "The visitor has flagged this as urgent. Prioritize triage questions. ";
    }

    const baseUrl = process.env.VFACE_BASE_URL
      || process.env.NEXT_PUBLIC_BASE_URL
      || "https://voxaris-family-orlando-dentistry.vercel.app";
    const callbackUrl = `${baseUrl}/api/vface/tools`;

    const result = await createConversation({
      greeting,
      context: context || undefined,
      callbackUrl,
    });

    return res.status(200).json({
      conversation_id: result.conversation_id,
      conversation_url: result.conversation_url,
      status: result.status || "active",
    });
  } catch (err) {
    console.error("[api/vface/conversations] Error:", err);
    const status = err.status || 500;
    return res.status(status).json({
      error: "conversation_creation_failed",
      message: "Failed to create Tavus conversation session.",
      details: err.body || err.message || "Unknown error",
    });
  }
};
