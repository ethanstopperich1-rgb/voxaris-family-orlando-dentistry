/**
 * Vercel Serverless Function — Create Tavus Persona
 *
 * POST /api/vface/setup/persona
 *
 * Dev-only: Creates a new Tavus persona for V·FACE.
 */

const { config } = require("../../../vface/config/tavus-config");
const { createPersona } = require("../../../vface/server/tavus-client");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!config.apiKey) {
    return res.status(503).json({ error: "TAVUS_API_KEY not set" });
  }

  try {
    const result = await createPersona();
    return res.status(200).json({
      message: "Persona created. Set TAVUS_PERSONA_ID in your environment.",
      persona_id: result.persona_id,
      persona_name: result.persona_name,
    });
  } catch (err) {
    console.error("[api/vface/setup/persona] Error:", err);
    return res.status(err.status || 500).json({
      error: "persona_creation_failed",
      details: err.body || err.message,
    });
  }
};
