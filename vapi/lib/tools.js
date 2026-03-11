/**
 * VAPI Tool Definitions for Family Orlando Dentistry
 *
 * These are passed into assistant configs under model.tools[].
 * Each tool includes filler messages for natural conversation during execution.
 */

// ─── Calendar Tools (Google Calendar integration) ────────────────────

const TOOL_CHECK_AVAILABILITY = {
  type: "function",
  function: {
    name: "check_availability",
    description:
      "Check real-time availability on the practice calendar. Returns open appointment slots. Call this BEFORE offering any times to the caller. Always present available slots from the result — never invent times.",
    parameters: {
      type: "object",
      properties: {
        appointment_type: {
          type: "string",
          enum: [
            "invisalign_consult",
            "cosmetic_consult",
            "whitening",
            "implant_consult",
            "same_day_crown_consult",
            "emergency_exam",
            "general_new_patient",
            "general_existing_patient",
            "botox_tmj_eval",
          ],
          description: "Type of appointment to check slots for.",
        },
        service_line: {
          type: "string",
          enum: [
            "invisalign",
            "cosmetic",
            "whitening",
            "implants",
            "same_day_crowns",
            "emergency",
            "general",
            "botox_tmj",
          ],
          description: "Service line — determines which provider calendars to check.",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgency level. High = search next 3 days. Low = search next 14 days.",
        },
        provider_preference: {
          type: "string",
          enum: ["no_preference", "jonathan", "nadine"],
          description: "Caller's preferred provider. Default: no_preference.",
        },
        preferred_time_of_day: {
          type: "string",
          enum: ["no_preference", "morning", "afternoon"],
          description: "Caller's preferred time of day.",
        },
        preferred_days: {
          type: "array",
          items: {
            type: "string",
            enum: ["monday", "tuesday", "thursday", "friday"],
          },
          description: "Preferred days of the week. Office is open Mon, Tue, Thu, Fri.",
        },
      },
      required: ["appointment_type", "service_line"],
    },
  },
  messages: [
    { type: "request-start", content: "Let me check the schedule for you." },
    { type: "request-complete", content: "" },
    {
      type: "request-failed",
      content: "I'm having a little trouble checking the schedule. Let me connect you with the office.",
    },
  ],
  async: false,
};

const TOOL_BOOK_APPOINTMENT = {
  type: "function",
  function: {
    name: "book_appointment",
    description:
      "Book a confirmed appointment on the practice calendar. Only call this AFTER the caller has chosen a specific slot from check_availability results and provided their name and phone number.",
    parameters: {
      type: "object",
      properties: {
        appointment_type: {
          type: "string",
          enum: [
            "invisalign_consult",
            "cosmetic_consult",
            "whitening",
            "implant_consult",
            "same_day_crown_consult",
            "emergency_exam",
            "general_new_patient",
            "general_existing_patient",
            "botox_tmj_eval",
          ],
          description: "Type of appointment.",
        },
        service_line: {
          type: "string",
          enum: [
            "invisalign",
            "cosmetic",
            "whitening",
            "implants",
            "same_day_crowns",
            "emergency",
            "general",
            "botox_tmj",
          ],
          description: "Service line for the appointment.",
        },
        provider_key: {
          type: "string",
          enum: ["jonathan", "nadine", "main"],
          description: "Provider to book with. Use the provider_key from the slot the caller chose.",
        },
        slot_start_iso: {
          type: "string",
          description: "Start time in ISO 8601 format. Use the start_iso from the chosen slot.",
        },
        slot_end_iso: {
          type: "string",
          description: "End time in ISO 8601 format. Use the end_iso from the chosen slot.",
        },
        patient_first_name: {
          type: "string",
          description: "Caller's first name.",
        },
        patient_last_name: {
          type: "string",
          description: "Caller's last name.",
        },
        patient_phone: {
          type: "string",
          description: "Caller's phone number.",
        },
        patient_email: {
          type: "string",
          description: "Caller's email address (optional).",
        },
        patient_type: {
          type: "string",
          enum: ["new", "returning", "unknown"],
          description: "Whether the caller is a new or returning patient.",
        },
        notes: {
          type: "string",
          description: "Any additional notes about the appointment.",
        },
      },
      required: [
        "appointment_type",
        "service_line",
        "provider_key",
        "slot_start_iso",
        "slot_end_iso",
        "patient_first_name",
        "patient_last_name",
        "patient_phone",
      ],
    },
  },
  messages: [
    { type: "request-start", content: "I'm booking that for you now." },
    { type: "request-complete", content: "" },
    {
      type: "request-failed",
      content: "I had trouble completing the booking. Let me transfer you to the office so they can confirm.",
    },
  ],
  async: false,
};

// ─── Legacy Tools ────────────────────────────────────────────────────

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
      "Submit an appointment request for the caller. Captures visit type, time preference, and priority level. Use this as a fallback if check_availability is unavailable.",
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
  async: true,
};

/**
 * VAPI native transferCall — initiates a real SIP transfer.
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
 */
const TOOL_END_CALL = {
  type: "endCall",
  messages: [
    { type: "request-start", content: "Have a great day. Goodbye." },
    { type: "request-complete", content: "" },
    { type: "request-failed", content: "" },
  ],
};

// ─── Tool sets by agent type ─────────────────────────────────────────

const INBOUND_RECEPTIONIST_TOOLS = [
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_MARK_EMERGENCY,
  TOOL_TRANSFER_TO_HUMAN,
];

const INBOUND_QUALIFIER_TOOLS = [
  TOOL_CAPTURE_LEAD,
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_TRANSFER_TO_HUMAN,
];

const INBOUND_EMERGENCY_TOOLS = [
  TOOL_CAPTURE_LEAD,
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_MARK_EMERGENCY,
  TOOL_TRANSFER_TO_HUMAN,
];

const INBOUND_SCHEDULER_TOOLS = [
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_TRANSFER_TO_HUMAN,
];

const OUTBOUND_TOOLS = [
  TOOL_CAPTURE_LEAD,
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_LOG_REACTIVATION,
  TOOL_MARK_EMERGENCY,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
];

module.exports = {
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_CAPTURE_LEAD,
  TOOL_REQUEST_APPOINTMENT,
  TOOL_MARK_EMERGENCY,
  TOOL_LOG_REACTIVATION,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
  INBOUND_RECEPTIONIST_TOOLS,
  INBOUND_QUALIFIER_TOOLS,
  INBOUND_EMERGENCY_TOOLS,
  INBOUND_SCHEDULER_TOOLS,
  OUTBOUND_TOOLS,
};
