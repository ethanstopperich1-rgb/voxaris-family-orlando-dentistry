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
        tools: [
          {
            type: 'function',
            function: {
              name: 'check_availability',
              description: 'Check live appointment availability across one or more Family Orlando Dentistry calendars. Always use this before offering appointment times or booking anything.',
              parameters: {
                type: 'object',
                properties: {
                  appointment_type: { type: 'string', enum: ['invisalign_consult','cosmetic_consult','whitening','implant_consult','same_day_crown_consult','emergency_exam','general_new_patient','general_existing_patient','botox_tmj_eval'], description: 'The appointment type the visitor wants.' },
                  service_line: { type: 'string', enum: ['invisalign','cosmetic','whitening','implants','same_day_crowns','emergency','general','botox_tmj'], description: 'High-level service bucket used for routing and calendar mapping.' },
                  patient_type: { type: 'string', enum: ['new','existing','unknown'], description: 'Whether the visitor is a new or existing patient, if known.' },
                  urgency: { type: 'string', enum: ['low','medium','high'], description: 'Use high for urgent same-day dental concerns.' },
                  provider_preference: { type: 'string', enum: ['jonathan','nadine','no_preference'], description: 'Preferred provider if the visitor gave one.' },
                  preferred_days: { type: 'array', items: { type: 'string', enum: ['monday','tuesday','thursday','friday'] }, description: 'Preferred office days if the visitor gave them.' },
                  preferred_time_of_day: { type: 'string', enum: ['morning','afternoon','no_preference'], description: 'Time-of-day preference if known.' },
                  start_date: { type: 'string', description: 'Optional ISO date to start searching from.' },
                  end_date: { type: 'string', description: 'Optional ISO date to stop searching.' },
                  duration_minutes: { type: 'number', description: 'Optional duration override in minutes.' },
                },
                required: ['appointment_type','service_line','patient_type','urgency','provider_preference','preferred_days','preferred_time_of_day','start_date','end_date','duration_minutes'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'book_appointment',
              description: 'Book a confirmed appointment into the correct Family Orlando Dentistry calendar after availability has already been checked and the visitor has chosen a specific offered slot.',
              parameters: {
                type: 'object',
                properties: {
                  appointment_type: { type: 'string', enum: ['invisalign_consult','cosmetic_consult','whitening','implant_consult','same_day_crown_consult','emergency_exam','general_new_patient','general_existing_patient','botox_tmj_eval'], description: 'The appointment type being booked.' },
                  service_line: { type: 'string', enum: ['invisalign','cosmetic','whitening','implants','same_day_crowns','emergency','general','botox_tmj'], description: 'High-level service bucket used for calendar mapping.' },
                  provider_key: { type: 'string', enum: ['jonathan','nadine','main'], description: 'The provider or calendar target selected from the availability response.' },
                  slot_start_iso: { type: 'string', description: 'The confirmed appointment start time in ISO 8601 format.' },
                  slot_end_iso: { type: 'string', description: 'The confirmed appointment end time in ISO 8601 format.' },
                  patient_first_name: { type: 'string', description: 'Patient first name.' },
                  patient_last_name: { type: 'string', description: 'Patient last name.' },
                  patient_phone: { type: 'string', description: 'Best callback phone number.' },
                  patient_email: { type: 'string', description: 'Optional email address for follow-up if provided.' },
                  patient_type: { type: 'string', enum: ['new','existing','unknown'], description: 'Whether the patient is new or existing, if known.' },
                  notes: { type: 'string', description: 'Short operational note only. Keep this concise and non-diagnostic.' },
                  request_id: { type: 'string', description: 'Optional idempotency key for duplicate-safe booking.' },
                },
                required: ['appointment_type','service_line','provider_key','slot_start_iso','slot_end_iso','patient_first_name','patient_last_name','patient_phone','patient_email','patient_type','notes','request_id'],
              },
            },
          },
        ],
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
