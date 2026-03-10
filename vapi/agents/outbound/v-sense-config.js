/**
 * V·SENSE Outbound Assistant Config
 *
 * Unified outbound voice agent for Family Orlando Dentistry.
 * Handles: hygiene reactivation, Invisalign follow-up, dormant-patient revival.
 *
 * Per-call personalization is injected via assistantOverrides at call time.
 * Campaign-specific prompts live in ./prompts/ for reference.
 *
 * Tools (6): capture_lead, request_appointment, log_reactivation_interest,
 *            mark_emergency_priority, transferCall (native), endCall (native)
 */

const {
  TOOL_CAPTURE_LEAD,
  TOOL_REQUEST_APPOINTMENT,
  TOOL_LOG_REACTIVATION,
  TOOL_MARK_EMERGENCY,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
} = require("../../lib/tools");

// ─── Full tool set for outbound ───

const OUTBOUND_TOOL_SET = [
  TOOL_CAPTURE_LEAD,
  TOOL_REQUEST_APPOINTMENT,
  TOOL_LOG_REACTIVATION,
  TOOL_MARK_EMERGENCY,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
];

// ─── System Prompt (voice-optimized, <500 tokens) ───

const SYSTEM_PROMPT = `You are Ava, calling from Family Orlando Dentistry. You place short, respectful outbound calls to re-engage patients.

[Style]
- Warm, brief, calm. Never aggressive or scripted.
- 1-2 sentences per turn. Keep opener under 15 seconds.
- One objection-handling attempt max, then exit politely.
- Respect hesitation immediately.
- Say phone numbers naturally: "four oh seven, eight seven seven, nine zero zero three."

[Flow]
1. Identify yourself: "Hi, this is Ava with Family Orlando Dentistry."
2. State reason for call in one sentence.
3. Ask one simple next-step question.
4. Capture interest or disposition silently using tools.
5. Close quickly and professionally. Use endCall after final goodbye.

[Campaign: Hygiene Reactivation]
- Position as friendly reminder, not guilt.
- "You're due for a hygiene visit and we wanted to make it easy to get back on the schedule."
- Capture timing preference if interested.

[Campaign: Invisalign Follow-Up]
- "I'm following up on your earlier Invisalign interest."
- Mention free consultation. Ask if researching or ready.
- Do not discuss pricing — say "the team covers that at the consultation."

[Campaign: General Revival]
- "It's been a while since your last visit, and we just wanted to check in."
- Ask if anything dental they've been putting off.
- Accept any answer gracefully.

[Objections]
- Busy → "I can follow up another time. When works better?"
- Not interested → "No problem at all. Have a great day."
- Unsure → Offer one simple next step, then close.
- "Take me off the list" → "Absolutely, I've removed you. Sorry for the inconvenience. Have a great day." Then endCall.

[Voicemail]
Leave a brief message with practice name, reason, and callback number four oh seven, eight seven seven, nine zero zero three. Then endCall.

[Rules]
- Never push after clear resistance.
- Never mention internal systems or tools.
- Never give long explanations.
- Always log disposition before ending.
- If patient mentions pain, swelling, or dental emergency, use mark_emergency_priority and suggest calling the office directly.
- If patient asks to speak with a person, use transferCall.
- After conversation is complete and disposition is logged, use endCall.`;

// ─── VAPI Assistant Config ───

const V_SENSE_OUTBOUND_CONFIG = {
  name: "V-SENSE Outbound Orlando Dental",
  firstMessage:
    "Hi, this is Ava with Family Orlando Dentistry. How are you doing today?",
  firstMessageMode: "assistant-speaks-first",
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: SYSTEM_PROMPT }],
    temperature: 0.35,
    maxTokens: 150,
    tools: OUTBOUND_TOOL_SET,
  },
  voice: {
    provider: "rime",
    voiceId: "cove",
    model: "arcana",
  },
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en",
  },
  silenceTimeoutSeconds: 30,
  maxDurationSeconds: 300,
  backgroundSound: "off",
  serverMessages: ["tool-calls", "status-update", "end-of-call-report"],
};

// ─── Per-campaign firstMessage overrides ───

const CAMPAIGN_OPENERS = {
  hygiene_reactivation: (name) =>
    name
      ? `Hi ${name}, this is Ava with Family Orlando Dentistry. I'm calling with a quick follow-up — it looks like you're due for a hygiene visit, and we wanted to make it easy to get back on the schedule.`
      : `Hi, this is Ava with Family Orlando Dentistry. I'm calling with a quick follow-up — it looks like you're due for a hygiene visit, and we wanted to make it easy to get back on the schedule.`,

  invisalign_followup: (name) =>
    name
      ? `Hi ${name}, this is Ava with Family Orlando Dentistry. I'm following up because you showed interest in Invisalign, and I wanted to see if you're still considering a consultation.`
      : `Hi, this is Ava with Family Orlando Dentistry. I'm following up because you showed interest in Invisalign, and I wanted to see if you're still considering a consultation.`,

  dormant_revival: (name) =>
    name
      ? `Hi ${name}, this is Ava with Family Orlando Dentistry. We noticed it's been a while since your last visit, and we just wanted to check in.`
      : `Hi, this is Ava with Family Orlando Dentistry. We noticed it's been a while since your last visit, and we just wanted to check in.`,
};

/**
 * Build assistantOverrides for a specific outbound call.
 *
 * IMPORTANT: This preserves the full system prompt AND tools array.
 * VAPI assistantOverrides.model replaces the entire model block,
 * so we must re-include everything.
 *
 * @param {string} campaignType — "hygiene_reactivation" | "invisalign_followup" | "dormant_revival"
 * @param {object} patient — { name, phone, lastVisit, interestDate, monthsOverdue }
 * @returns {object} VAPI assistantOverrides object
 */
function buildCallOverrides(campaignType, patient = {}) {
  const opener = CAMPAIGN_OPENERS[campaignType];
  if (!opener) {
    throw new Error(`Unknown campaign type: ${campaignType}`);
  }

  const contextLines = [`Campaign: ${campaignType}`];
  if (patient.name) contextLines.push(`Patient name: ${patient.name}`);
  if (patient.lastVisit)
    contextLines.push(`Last visit: ${patient.lastVisit}`);
  if (patient.monthsOverdue)
    contextLines.push(`Months overdue: ${patient.monthsOverdue}`);
  if (patient.interestDate)
    contextLines.push(`Original interest date: ${patient.interestDate}`);

  return {
    firstMessage: opener(patient.name),
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.35,
      maxTokens: 150,
      tools: OUTBOUND_TOOL_SET,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: `[Patient Context]\n${contextLines.join("\n")}`,
        },
      ],
    },
  };
}

module.exports = {
  V_SENSE_OUTBOUND_CONFIG,
  OUTBOUND_TOOL_SET,
  CAMPAIGN_OPENERS,
  buildCallOverrides,
  SYSTEM_PROMPT,
};
