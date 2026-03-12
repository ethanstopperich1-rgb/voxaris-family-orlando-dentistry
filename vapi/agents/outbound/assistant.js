/**
 * Outbound Assistant Configurations
 *
 * Three campaign types, each with a tailored prompt:
 *   1. Hygiene reactivation — overdue cleaning patients
 *   2. Invisalign follow-up — warm leads who didn't book
 *   3. Dormant revival — patients who haven't visited in 6+ months
 *
 * Each returns an assistant config with per-call overrides
 * for personalization (patient name, overdue months, etc.).
 */

const fs = require("fs");
const path = require("path");
// Tool calling disabled for demo stability.
// const { OUTBOUND_TOOLS } = require("../../lib/tools");

function loadPrompt(filename) {
  return fs.readFileSync(
    path.join(__dirname, "prompts", filename),
    "utf-8"
  );
}

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

// ─── Base outbound config ───

function baseOutbound(serverUrl) {
  return {
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.4,
      maxTokens: 200,
      // tools: OUTBOUND_TOOLS, // Disabled for demo
    },
    voice: VOICE_CONFIG,
    transcriber: TRANSCRIBER_CONFIG,
    serverUrl,
    serverMessages: ["status-update", "end-of-call-report"],
    maxDurationSeconds: 300, // 5 min cap for outbound
    silenceTimeoutSeconds: 15,
    endCallMessage: "Thanks for your time. Have a great day.",
  };
}

// ─── Campaign Configs ───

function getHygieneReactivationConfig(serverUrl) {
  const base = baseOutbound(serverUrl);
  return {
    ...base,
    name: "FOD Hygiene Reactivation",
    firstMessage:
      "Hi, this is Ava with Family Orlando Dentistry. I'm calling with a quick follow-up — it looks like you're due for a hygiene visit, and we wanted to make it easy to get back on the schedule.",
    model: {
      ...base.model,
      messages: [
        { role: "system", content: loadPrompt("hygiene-reactivation.txt") },
      ],
    },
  };
}

function getInvisalignFollowupConfig(serverUrl) {
  const base = baseOutbound(serverUrl);
  return {
    ...base,
    name: "FOD Invisalign Follow-up",
    firstMessage:
      "Hi, this is Ava with Family Orlando Dentistry. I'm following up because you showed interest in Invisalign, and I wanted to see if you're still considering a consultation.",
    model: {
      ...base.model,
      messages: [
        { role: "system", content: loadPrompt("invisalign-followup.txt") },
      ],
    },
  };
}

function getDormantRevivalConfig(serverUrl) {
  const base = baseOutbound(serverUrl);
  return {
    ...base,
    name: "FOD Dormant Revival",
    firstMessage:
      "Hi, this is Ava with Family Orlando Dentistry. We noticed it's been a while since your last visit, and we just wanted to check in and see if there's anything we can help with.",
    model: {
      ...base.model,
      messages: [
        { role: "system", content: loadPrompt("dormant-revival.txt") },
      ],
    },
  };
}

function getAppointmentReminderConfig(serverUrl) {
  const base = baseOutbound(serverUrl);
  return {
    ...base,
    name: "FOD Appointment Reminder",
    firstMessage:
      "Hi, this is Ava with Family Orlando Dentistry. I'm calling to confirm your appointment today. Will you be able to make it?",
    model: {
      ...base.model,
      messages: [
        { role: "system", content: loadPrompt("appointment-reminder.txt") },
      ],
    },
    maxDurationSeconds: 180,
  };
}

/**
 * Build per-call overrides for outbound personalization.
 *
 * Usage with VAPI createCall:
 *   assistantOverrides: getCallOverrides({ patient_name: "Sarah", months_overdue: "8" })
 */
function getCallOverrides(dynamicVars = {}) {
  const overrides = {};

  // Inject dynamic variables via variableValues (VAPI's built-in mechanism).
  // This avoids needing to pass a full model override.
  if (Object.keys(dynamicVars).length > 0) {
    overrides.variableValues = dynamicVars;
  }

  return overrides;
}

module.exports = {
  getHygieneReactivationConfig,
  getInvisalignFollowupConfig,
  getDormantRevivalConfig,
  getAppointmentReminderConfig,
  getCallOverrides,
};
