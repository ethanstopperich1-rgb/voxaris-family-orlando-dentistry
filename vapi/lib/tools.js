/**
 * VAPI Tool Definitions for Family Orlando Dentistry
 *
 * These are passed into assistant configs under model.tools[].
 * Each tool includes filler messages for natural conversation during execution.
 */

const TOOL_CAPTURE_LEAD = {
  type: "function",
  function: {
    name: "capture_lead",
    description:
      "Record a new lead with their interest type, motivation, timeline, and any relevant details. Call this whenever a caller expresses interest in a service.",
    parameters: {
      type: "object",
      properties: {
        interest_type: {
          type: "string",
          enum: [
            "invisalign",
            "whitening",
            "implants",
            "emergency",
            "cleaning",
            "general",
            "same_day_crown",
          ],
          description: "Primary service the caller is interested in.",
        },
        motivation: {
          type: "string",
          description:
            "What is driving the caller. Examples: crowding, smile refresh, pain, overdue cleaning.",
        },
        timeline: {
          type: "string",
          enum: ["immediate", "30_days", "few_months", "researching"],
          description: "How soon the caller wants to proceed.",
        },
        prior_history: {
          type: "string",
          description:
            "Relevant dental history. Examples: no prior ortho, had braces as a teen, first visit.",
        },
        notes: {
          type: "string",
          description: "Any other relevant details from the conversation.",
        },
      },
      required: ["interest_type"],
    },
  },
  messages: [
    { type: "request-start", content: "Let me note that down." },
    { type: "request-complete", content: "Got it." },
    {
      type: "request-failed",
      content: "I had trouble saving that, but I'll make sure the team gets it.",
    },
  ],
  async: false,
};

const TOOL_REQUEST_APPOINTMENT = {
  type: "function",
  function: {
    name: "request_appointment",
    description:
      "Submit an appointment request for the caller. Captures visit type, time preference, and priority level.",
    parameters: {
      type: "object",
      properties: {
        visit_type: {
          type: "string",
          enum: [
            "invisalign_consultation",
            "emergency",
            "cleaning",
            "checkup",
            "whitening",
            "implant_consultation",
            "follow_up",
            "general",
          ],
          description: "Type of appointment requested.",
        },
        time_preference: {
          type: "string",
          enum: ["morning", "afternoon", "no_preference"],
          description: "Caller's preferred time of day.",
        },
        priority: {
          type: "string",
          enum: ["standard", "urgent", "emergency"],
          description:
            "Priority level. Use emergency for pain, trauma, or cracked teeth.",
        },
        patient_type: {
          type: "string",
          enum: ["new", "returning", "unknown"],
          description: "Whether the caller is a new or returning patient.",
        },
        notes: {
          type: "string",
          description: "Additional scheduling context.",
        },
      },
      required: ["visit_type"],
    },
  },
  messages: [
    { type: "request-start", content: "I'm logging that appointment request now." },
    { type: "request-complete", content: "Done." },
    {
      type: "request-failed",
      content: "I had a hiccup saving that, but the team will have your info.",
    },
  ],
  async: false,
};

const TOOL_MARK_EMERGENCY = {
  type: "function",
  function: {
    name: "mark_emergency_priority",
    description:
      "Flag the current call as a dental emergency. Use when the caller reports severe pain, trauma, cracked or knocked-out teeth, bleeding, swelling, or fever.",
    parameters: {
      type: "object",
      properties: {
        issue_type: {
          type: "string",
          description:
            "Type of emergency. Examples: cracked tooth, severe pain, knocked out tooth, swelling.",
        },
        pain_level: {
          type: "number",
          description: "Pain level from 1 to 10 as reported by the caller.",
        },
        symptoms: {
          type: "string",
          description:
            "Current symptoms. Examples: bleeding, swelling, fever, no bleeding.",
        },
        onset: {
          type: "string",
          description:
            "How the issue started. Examples: while eating, injury today, woke up with pain.",
        },
      },
      required: ["issue_type"],
    },
  },
  messages: [
    { type: "request-start", content: "I'm flagging this as urgent right now." },
    { type: "request-complete", content: "Done, this is marked as priority." },
    {
      type: "request-failed",
      content: "I had trouble flagging that, but I'll make sure it's noted.",
    },
  ],
  async: false,
};

const TOOL_LOG_REACTIVATION = {
  type: "function",
  function: {
    name: "log_reactivation_interest",
    description:
      "Record the patient's response to a reactivation or follow-up call. Use at the end of every outbound call.",
    parameters: {
      type: "object",
      properties: {
        disposition: {
          type: "string",
          enum: [
            "interested",
            "maybe_later",
            "not_interested",
            "already_scheduled",
            "wrong_number",
            "voicemail",
            "no_answer",
          ],
          description: "Outcome of the reactivation call.",
        },
        interest_type: {
          type: "string",
          description:
            "What they showed interest in, if any. Examples: hygiene, Invisalign, general checkup.",
        },
        follow_up_needed: {
          type: "boolean",
          description: "Whether a follow-up call or action is needed.",
        },
        notes: {
          type: "string",
          description: "Any relevant details from the conversation.",
        },
      },
      required: ["disposition"],
    },
  },
  messages: [
    { type: "request-start", content: "Let me note that." },
    { type: "request-complete", content: "Got it, thanks." },
    { type: "request-failed", content: "I'll make sure that's recorded." },
  ],
  async: true, // fire-and-forget — don't block conversation
};

/**
 * VAPI native transferCall — initiates a real SIP transfer.
 * This replaces the old custom function that only returned JSON.
 */
const TOOL_TRANSFER_TO_HUMAN = {
  type: "transferCall",
  destinations: [
    {
      type: "number",
      number: "+14078779003",
      message: "I'm connecting you with the team at Orlando Family Dentistry now. One moment please.",
      description: "Transfer to Family Orlando Dentistry office line for live staff.",
    },
  ],
  messages: [
    {
      type: "request-start",
      content: "Let me connect you with someone on the team.",
    },
    { type: "request-complete", content: "Connecting you now." },
    {
      type: "request-failed",
      content:
        "I'm having trouble connecting you right now. Please call the office directly at four oh seven, eight seven seven, nine zero zero three.",
    },
  ],
};

/**
 * VAPI native endCall — cleanly terminates the call.
 * Use after disposition is logged, or for voicemail/wrong-number/DNC exits.
 */
const TOOL_END_CALL = {
  type: "endCall",
  messages: [
    { type: "request-start", content: "Have a great day. Goodbye." },
    { type: "request-complete", content: "" },
    { type: "request-failed", content: "" },
  ],
};

// ─── Tool sets by agent type ───

const INBOUND_RECEPTIONIST_TOOLS = [
  TOOL_REQUEST_APPOINTMENT,
  TOOL_MARK_EMERGENCY,
  TOOL_TRANSFER_TO_HUMAN,
];

const INBOUND_QUALIFIER_TOOLS = [
  TOOL_CAPTURE_LEAD,
  TOOL_REQUEST_APPOINTMENT,
  TOOL_TRANSFER_TO_HUMAN,
];

const INBOUND_EMERGENCY_TOOLS = [
  TOOL_CAPTURE_LEAD,
  TOOL_REQUEST_APPOINTMENT,
  TOOL_MARK_EMERGENCY,
  TOOL_TRANSFER_TO_HUMAN,
];

const OUTBOUND_TOOLS = [
  TOOL_CAPTURE_LEAD,
  TOOL_REQUEST_APPOINTMENT,
  TOOL_LOG_REACTIVATION,
  TOOL_MARK_EMERGENCY,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
];

module.exports = {
  TOOL_CAPTURE_LEAD,
  TOOL_REQUEST_APPOINTMENT,
  TOOL_MARK_EMERGENCY,
  TOOL_LOG_REACTIVATION,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
  INBOUND_RECEPTIONIST_TOOLS,
  INBOUND_QUALIFIER_TOOLS,
  INBOUND_EMERGENCY_TOOLS,
  OUTBOUND_TOOLS,
};
