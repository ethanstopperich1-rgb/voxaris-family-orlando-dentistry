/**
 * Vapi Webhook Server — Family Orlando Dentistry
 *
 * Express server that handles:
 * 1. Tool call execution (function-call webhook)
 * 2. Status/event webhooks (call started, ended, transcript)
 * 3. Assistant config retrieval (for Squad setup)
 *
 * Start: node vapi/api/server.js
 * Requires: VAPI_API_KEY in .env
 */

const express = require('express');
const { handleToolCall } = require('../lib/tool-handlers');
const { handleWebhookEvent } = require('../handlers/webhook-handler');

const app = express();
app.use(express.json());

const PORT = process.env.VAPI_SERVER_PORT || 3200;

// ─── Health Check ───

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vapi-webhook-server', timestamp: new Date().toISOString() });
});

// ─── Tool Call Endpoint ───
// VAPI sends POST requests here when an assistant invokes a tool.
// The request body contains: { message: { type, call, ... } }

app.post('/api/tool-call', async (req, res) => {
  try {
    const { message } = req.body;

    if (message?.type !== 'function-call') {
      return res.status(400).json({ error: 'Expected function-call message type' });
    }

    const callId = message.call?.id || 'unknown';
    const toolName = message.functionCall?.name;
    const params = message.functionCall?.parameters || {};

    if (!toolName) {
      return res.status(400).json({ error: 'Missing functionCall.name' });
    }

    console.log(`[tool-call] ${toolName} for call ${callId}`);
    const result = await handleToolCall(callId, toolName, params);

    // VAPI expects { result: "stringified JSON" }
    res.json({ result: JSON.stringify(result) });
  } catch (err) {
    console.error('[tool-call] Error:', err);
    res.status(500).json({ result: JSON.stringify({ success: false, error: err.message }) });
  }
});

// ─── Status / Event Webhook ───
// VAPI sends status updates: call started, ended, transcript, etc.

app.post('/api/webhook', async (req, res) => {
  try {
    const { message } = req.body;
    await handleWebhookEvent(message);
    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Assistant Config Endpoint ───
// Returns assistant configuration for dynamic Squad setup.
// In production, this would pull from a database.

app.get('/api/assistant/:role', (req, res) => {
  const configs = {
    receptionist: {
      name: 'Family Orlando Dentistry — Receptionist',
      voice: { provider: 'rime', voiceId: 'marsh' },
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
    },
    'qualifier-invisalign': {
      name: 'Family Orlando Dentistry — Invisalign Qualifier',
      voice: { provider: 'rime', voiceId: 'marsh' },
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
    },
    'qualifier-emergency': {
      name: 'Family Orlando Dentistry — Emergency Triage',
      voice: { provider: 'rime', voiceId: 'marsh' },
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
    },
    'general-scheduler': {
      name: 'Family Orlando Dentistry — Scheduler',
      voice: { provider: 'rime', voiceId: 'marsh' },
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
    },
    'outbound-hygiene': {
      name: 'Family Orlando Dentistry — Hygiene Reactivation',
      voice: { provider: 'rime', voiceId: 'cove' },
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
    },
    'outbound-invisalign': {
      name: 'Family Orlando Dentistry — Invisalign Follow-Up',
      voice: { provider: 'rime', voiceId: 'cove' },
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
    },
    'outbound-dormant': {
      name: 'Family Orlando Dentistry — Dormant Revival',
      voice: { provider: 'rime', voiceId: 'cove' },
      model: { provider: 'openai', model: 'gpt-4o-mini' },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
    },
  };

  const config = configs[req.params.role];
  if (!config) {
    return res.status(404).json({ error: `Unknown assistant role: ${req.params.role}` });
  }

  res.json(config);
});

// ─── Start ───

app.listen(PORT, () => {
  console.log(`[vapi-server] Running on http://localhost:${PORT}`);
  console.log(`[vapi-server] Tool calls:  POST /api/tool-call`);
  console.log(`[vapi-server] Webhooks:    POST /api/webhook`);
  console.log(`[vapi-server] Assistants:  GET  /api/assistant/:role`);
});
