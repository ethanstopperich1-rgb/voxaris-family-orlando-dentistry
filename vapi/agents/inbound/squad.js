/**
 * Inbound Squad Configuration
 *
 * Defines the V·TEAMS inbound routing squad:
 *   Receptionist → Invisalign Qualifier
 *   Receptionist → Emergency Qualifier
 *   Receptionist → General Scheduler
 *
 * Returned from the assistant-request webhook for inbound calls.
 */

const fs = require("fs");
const path = require("path");
const {
  INBOUND_RECEPTIONIST_TOOLS,
  INBOUND_QUALIFIER_TOOLS,
  INBOUND_EMERGENCY_TOOLS,
  INBOUND_SCHEDULER_TOOLS,
} = require("../../lib/tools");

// ─── Load prompts from disk ───

function loadPrompt(filename) {
  return fs.readFileSync(
    path.join(__dirname, "prompts", filename),
    "utf-8"
  );
}

// ─── Shared voice/transcriber config ───

const VOICE_CONFIG = {
  provider: "rime-ai",
  voiceId: "moraine",
  model: "mistv2",
};

const TRANSCRIBER_CONFIG = {
  provider: "deepgram",
  model: "nova-2",
  language: "en",
};

// ─── Assistant Configs ───

function getReceptionistConfig(serverUrl) {
  return {
    name: "FOD Receptionist",
    firstMessage:
      "Hi, thanks for calling Family Orlando Dentistry. How can I help you today?",
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: loadPrompt("receptionist.txt") }],
      temperature: 0.4,
      maxTokens: 200,
      tools: INBOUND_RECEPTIONIST_TOOLS,
    },
    voice: VOICE_CONFIG,
    transcriber: TRANSCRIBER_CONFIG,
    serverUrl,
    serverMessages: ["tool-calls", "status-update", "end-of-call-report"],
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
    backgroundSound: "office",
  };
}

function getInvisalignQualifierConfig(serverUrl) {
  return {
    name: "FOD Invisalign Qualifier",
    firstMessage:
      "Great, I can help with Invisalign questions. What's motivating you to look into teeth straightening?",
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: loadPrompt("qualifier-invisalign.txt") },
      ],
      temperature: 0.4,
      maxTokens: 200,
      tools: INBOUND_QUALIFIER_TOOLS,
    },
    voice: VOICE_CONFIG,
    transcriber: TRANSCRIBER_CONFIG,
    serverUrl,
    serverMessages: ["tool-calls", "status-update", "end-of-call-report"],
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
  };
}

function getEmergencyQualifierConfig(serverUrl) {
  return {
    name: "FOD Emergency Qualifier",
    firstMessage:
      "I understand you're dealing with something urgent. Let me get the details so we can help you as fast as possible.",
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: loadPrompt("qualifier-emergency.txt") },
      ],
      temperature: 0.3,
      maxTokens: 200,
      tools: INBOUND_EMERGENCY_TOOLS,
    },
    voice: VOICE_CONFIG,
    transcriber: TRANSCRIBER_CONFIG,
    serverUrl,
    serverMessages: ["tool-calls", "status-update", "end-of-call-report"],
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
  };
}

function getGeneralSchedulerConfig(serverUrl) {
  return {
    name: "FOD General Scheduler",
    firstMessage: "I can help get you on the schedule. What type of visit are you looking for?",
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: loadPrompt("general-scheduler.txt") },
      ],
      temperature: 0.4,
      maxTokens: 200,
      tools: INBOUND_SCHEDULER_TOOLS,
    },
    voice: VOICE_CONFIG,
    transcriber: TRANSCRIBER_CONFIG,
    serverUrl,
    serverMessages: ["tool-calls", "status-update", "end-of-call-report"],
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
  };
}

// ─── Squad Config ───

function getInboundSquad(serverUrl) {
  return {
    name: "Family Orlando Dentistry — Inbound V·TEAMS",
    members: [
      {
        assistant: getReceptionistConfig(serverUrl),
        assistantDestinations: [
          {
            type: "assistant",
            assistantName: "FOD Invisalign Qualifier",
            message:
              "Let me connect you with our Invisalign specialist — one moment.",
            description:
              "Transfer when the caller mentions Invisalign, teeth straightening, clear aligners, or smile improvement.",
          },
          {
            type: "assistant",
            assistantName: "FOD Emergency Qualifier",
            message:
              "I'm connecting you to our emergency line right away — hold on.",
            description:
              "Transfer when the caller reports pain, a cracked or knocked-out tooth, bleeding, swelling, fever, or any urgent dental issue.",
          },
          {
            type: "assistant",
            assistantName: "FOD General Scheduler",
            message: "Let me connect you to scheduling.",
            description:
              "Transfer when the caller wants to book a cleaning, checkup, follow-up, or general appointment.",
          },
        ],
      },
      {
        assistant: getInvisalignQualifierConfig(serverUrl),
        assistantDestinations: [
          {
            type: "assistant",
            assistantName: "FOD Receptionist",
            message: "Let me transfer you back to the main line.",
            description:
              "Transfer back if the caller changes topic or asks about something unrelated to Invisalign.",
          },
        ],
      },
      {
        assistant: getEmergencyQualifierConfig(serverUrl),
        assistantDestinations: [
          {
            type: "assistant",
            assistantName: "FOD Receptionist",
            message: "Let me transfer you back to the main line.",
            description:
              "Transfer back only if the caller clarifies this is not an emergency.",
          },
        ],
      },
      {
        assistant: getGeneralSchedulerConfig(serverUrl),
        assistantDestinations: [
          {
            type: "assistant",
            assistantName: "FOD Receptionist",
            message: "Let me transfer you back to the main line.",
            description:
              "Transfer back if the caller changes topic or needs something beyond scheduling.",
          },
        ],
      },
    ],
  };
}

module.exports = {
  getInboundSquad,
  getReceptionistConfig,
  getInvisalignQualifierConfig,
  getEmergencyQualifierConfig,
  getGeneralSchedulerConfig,
};
