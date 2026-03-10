/**
 * V·FACE Server — Tavus CVI Backend for Family Orlando Dentistry
 *
 * Lightweight Express server that:
 *  1. Serves the static front-end test page
 *  2. Provides /api/conversations endpoint for session creation
 *  3. Provides /api/status for health/config checks
 *  4. Provides /api/conversations/:id/end for session teardown
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const path = require('path');
const { config, isConfigured, getMissingCredentials } = require('../config/tavus-config');
const { createConversation, endConversation, getConversation, createPersona, listReplicas } = require('./tavus-client');

const app = express();
app.use(express.json());

// Serve static files from vface root (index.html, public/)
app.use(express.static(path.join(__dirname, '..')));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', config.allowedOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ─── Health / Config Status ─── */

app.get('/api/status', (req, res) => {
  const configured = isConfigured();
  const missing = getMissingCredentials();
  res.json({
    status: configured ? 'ready' : 'not_configured',
    tavus_configured: configured,
    missing_credentials: missing,
    practice: 'Family Orlando Dentistry',
    server_time: new Date().toISOString(),
  });
});

/* ─── Create Conversation ─── */

app.post('/api/conversations', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      error: 'tavus_not_configured',
      message: 'Tavus credentials are not configured. Set TAVUS_API_KEY, TAVUS_PERSONA_ID, and TAVUS_REPLICA_ID in .env',
      missing: getMissingCredentials(),
    });
  }

  try {
    const { visitor_name, concern, urgency } = req.body;

    // Build contextual greeting
    let greeting = 'Hi, welcome to Orlando Family Dentistry. I can help with appointments, Invisalign consultations, emergency concerns, or any questions about the practice. What brings you in today?';

    if (visitor_name) {
      greeting = `Hi ${visitor_name}, welcome to Orlando Family Dentistry. I can help with appointments, Invisalign consultations, emergency concerns, or any questions. What can I do for you today?`;
    }

    // Build conversational context from visitor data
    let context = '';
    if (concern) {
      context += `The visitor has indicated interest in: ${concern}. `;
    }
    if (urgency === 'emergency') {
      context += 'The visitor has flagged this as urgent. Prioritize triage questions. ';
    }

    const result = await createConversation({ greeting, context: context || undefined });

    res.json({
      conversation_id: result.conversation_id,
      conversation_url: result.conversation_url,
      status: result.status || 'active',
    });
  } catch (err) {
    console.error('[conversations] Tavus API error:', err);
    const status = err.status || 500;
    res.status(status).json({
      error: 'conversation_creation_failed',
      message: 'Failed to create Tavus conversation session.',
      details: err.body || err.message || 'Unknown error',
    });
  }
});

/* ─── End Conversation ─── */

app.post('/api/conversations/:id/end', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'tavus_not_configured' });
  }

  try {
    await endConversation(req.params.id);
    res.json({ status: 'ended', conversation_id: req.params.id });
  } catch (err) {
    console.error('[conversations] End error:', err);
    res.status(err.status || 500).json({
      error: 'end_failed',
      details: err.body || err.message,
    });
  }
});

/* ─── Get Conversation Details ─── */

app.get('/api/conversations/:id', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'tavus_not_configured' });
  }

  try {
    const result = await getConversation(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      error: 'fetch_failed',
      details: err.body || err.message,
    });
  }
});

/* ─── Setup Helpers (dev only) ─── */

app.post('/api/setup/persona', async (req, res) => {
  if (!config.apiKey) {
    return res.status(503).json({ error: 'TAVUS_API_KEY not set' });
  }

  try {
    const result = await createPersona();
    res.json({
      message: 'Persona created. Add this ID to your .env as TAVUS_PERSONA_ID',
      persona_id: result.persona_id,
      persona_name: result.persona_name,
    });
  } catch (err) {
    console.error('[setup] Persona creation error:', err);
    res.status(err.status || 500).json({
      error: 'persona_creation_failed',
      details: err.body || err.message,
    });
  }
});

app.get('/api/setup/replicas', async (req, res) => {
  if (!config.apiKey) {
    return res.status(503).json({ error: 'TAVUS_API_KEY not set' });
  }

  try {
    const result = await listReplicas();
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      error: 'replica_list_failed',
      details: err.body || err.message,
    });
  }
});

/* ─── Start ─── */

app.listen(config.port, () => {
  const configured = isConfigured();
  console.log(`\n  V·FACE Server running on http://localhost:${config.port}`);
  console.log(`  Tavus status: ${configured ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  if (!configured) {
    console.log(`  Missing: ${getMissingCredentials().join(', ')}`);
    console.log('  The front-end will show a graceful fallback.\n');
  } else {
    console.log('  Ready to create live Tavus CVI sessions.\n');
  }
});
