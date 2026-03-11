/**
 * Vercel Serverless Function — Tavus Conversation Webhook
 *
 * POST /api/vface/tools/webhook
 *
 * Receives callbacks from Tavus for conversation events including
 * tool calls, transcription, and system events.
 */

const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const event = req.body || {};
  const eventType = event.event_type || event.type || "unknown";

  console.log(`[vface/webhook] Event: ${eventType}`, JSON.stringify(event).slice(0, 500));

  // Log all events for debugging
  try {
    const logFile = path.join("/tmp", "tavus-events.jsonl");
    fs.appendFileSync(logFile, JSON.stringify({ ...event, received_at: new Date().toISOString() }) + "\n");
  } catch {}

  return res.status(200).json({ received: true, event_type: eventType });
};
