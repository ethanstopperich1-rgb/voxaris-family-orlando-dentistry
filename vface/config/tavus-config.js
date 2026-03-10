/**
 * Tavus CVI Configuration for Family Orlando Dentistry
 *
 * Centralizes all Tavus-related config, reads from environment,
 * and provides defaults and validation helpers.
 */

const fs = require('fs');
const path = require('path');

// Load persona prompt from markdown file
function loadPersonaPrompt() {
  const promptPath = path.join(__dirname, 'persona-prompt.md');
  try {
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    console.warn('[tavus-config] Could not load persona-prompt.md, using inline fallback');
    return 'You are a friendly dental concierge for Family Orlando Dentistry in Ocoee, FL. Help visitors with appointments, Invisalign consultations, emergency concerns, and general questions. Be warm, concise, and professional.';
  }
}

const config = {
  // API
  apiKey: process.env.TAVUS_API_KEY || '',
  apiBase: 'https://tavusapi.com/v2',

  // Persona
  personaId: process.env.TAVUS_PERSONA_ID || '',
  personaName: 'family-orlando-dentistry-concierge',
  systemPrompt: loadPersonaPrompt(),

  // Replica
  replicaId: process.env.TAVUS_REPLICA_ID || '',

  // Server
  port: parseInt(process.env.PORT, 10) || 3100,
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:3100',

  // Conversation defaults
  conversationDefaults: {
    conversation_name: 'Family Orlando Dentistry — V·FACE Session',
    properties: {
      max_call_duration: 600,    // 10 minutes
      enable_recording: false,
      enable_closed_captions: true,
      language: 'english',
      apply_greenscreen: false,
    },
  },

  // Persona creation payload (for initial setup)
  personaPayload: {
    persona_name: 'family-orlando-dentistry-concierge',
    pipeline_mode: 'full',
    layers: {
      llm: {
        model: 'tavus-gpt-oss',
        speculative_inference: true,
        tools: [],
      },
      stt: {
        stt_engine: 'tavus-advanced',
        participant_pause_sensitivity: 'medium',
        participant_interrupt_sensitivity: 'medium',
        smart_turn_detection: true,
      },
      tts: {
        tts_engine: 'cartesia',
        voice_settings: {
          speed: 1.05,
          stability: 0.75,
        },
      },
      conversational_flow: {
        turn_detection_model: 'sparrow-1',
        turn_taking_patience: 'medium',
        replica_interruptibility: 'low',
      },
    },
  },
};

/**
 * Check whether Tavus is fully configured
 */
function isConfigured() {
  return !!(config.apiKey && config.personaId && config.replicaId);
}

/**
 * Check partial configuration and return what's missing
 */
function getMissingCredentials() {
  const missing = [];
  if (!config.apiKey) missing.push('TAVUS_API_KEY');
  if (!config.personaId) missing.push('TAVUS_PERSONA_ID');
  if (!config.replicaId) missing.push('TAVUS_REPLICA_ID');
  return missing;
}

module.exports = { config, isConfigured, getMissingCredentials, loadPersonaPrompt };
