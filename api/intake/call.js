/**
 * Vercel Serverless Function — Intake Form Call Back
 *
 * POST /api/intake/call
 *
 * Triggers an immediate outbound VAPI call to a patient
 * who just filled out the intake form on the website.
 *
 * Body: {
 *   patient_name: "John Smith",
 *   phone_number: "+14075551234",
 *   email: "john@example.com",
 *   service_type: "General Checkup & Cleaning"
 * }
 */

const { getVapiClient } = require("../../vapi/lib/vapi-client");

const VOICE_CONFIG = {
  provider: "rime",
  voiceId: "cove",
  model: "arcana",
};

const TRANSCRIBER_CONFIG = {
  provider: "deepgram",
  model: "nova-2",
  language: "en",
};

function buildIntakeAssistantConfig(params) {
  const { patient_name, service_type, email } = params;

  const serverUrl =
    process.env.VAPI_WEBHOOK_URL ||
    `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "https://localhost:3000"}/api/vapi/webhook`;

  const systemPrompt = `You are Ava, the AI dental concierge for Family Orlando Dentistry in Ocoee, Florida.

You are calling a patient who just filled out an intake form on the website requesting an immediate call back.

## Patient Context
- Name: ${patient_name}
- Email: ${email}
- Service Interest: ${service_type}

## Your Goal
1. Greet the patient warmly by name
2. Confirm they just requested a call from Family Orlando Dentistry's website
3. Confirm the service they're interested in (${service_type})
4. Help them schedule an appointment
5. Collect any additional info needed (insurance, preferred date/time, any urgency)

## Practice Details
- Practice: Family Orlando Dentistry
- Address: 2704 Rew Circle, Suite 103, Ocoee, FL 34761
- Phone: (407) 877-9003
- Doctors: Dr. Nadine Nitisusanta (DMD) and Dr. Jonathan Nitisusanta (DDS)
- Hours: Monday, Tuesday, Thursday, Friday: 9 AM - 5 PM. Wednesday, Saturday, Sunday: Closed.

## Tone
- Be warm, friendly, and professional
- Keep responses concise (1-2 sentences)
- If they want to schedule, suggest the next available day during office hours
- If they have questions about the service, provide brief helpful info
- End the call by confirming next steps

## Important Rules
- Never make up appointment availability — suggest they come in during office hours and the team will confirm
- If they ask about pricing, say the office will provide a detailed estimate at their visit
- If they want to cancel, be understanding and let them know they can call anytime
- Keep the call under 3 minutes`;

  return {
    name: "FOD Intake Callback",
    firstMessageMode: "assistant-speaks-first",
    firstMessage: `Hi ${patient_name}, this is Ava from Family Orlando Dentistry! I see you just requested a call from our website about ${service_type}. I'd love to help you get scheduled — is now a good time?`,
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.4,
      maxTokens: 200,
      messages: [{ role: "system", content: systemPrompt }],
    },
    voice: VOICE_CONFIG,
    transcriber: TRANSCRIBER_CONFIG,
    serverUrl,
    serverMessages: ["status-update", "end-of-call-report"],
    maxDurationSeconds: 180,
    silenceTimeoutSeconds: 15,
    endCallMessage:
      "Thanks so much for your time! We look forward to seeing you at Family Orlando Dentistry. Have a great day!",
  };
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { patient_name, phone_number, email, service_type } = req.body || {};

  // Validate required fields
  if (!patient_name || !phone_number || !service_type) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: patient_name, phone_number, service_type",
    });
  }

  const phoneNumberId = process.env.VAPI_OUTBOUND_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    console.error("[api/intake/call] VAPI_OUTBOUND_PHONE_NUMBER_ID not set");
    return res.status(500).json({
      success: false,
      error: "Outbound calling is not configured. Please call us at (407) 877-9003.",
    });
  }

  try {
    const vapi = getVapiClient();
    const assistantConfig = buildIntakeAssistantConfig({
      patient_name,
      service_type,
      email: email || "not provided",
    });

    const call = await vapi.createCall({
      assistant: assistantConfig,
      phoneNumberId,
      customer: {
        number: phone_number,
        name: patient_name,
      },
      metadata: {
        source: "website_intake_form",
        patient_name,
        email: email || null,
        service_type,
        triggered_at: new Date().toISOString(),
      },
    });

    console.log(
      `[intake/call] Call created: ${call.id} to=${phone_number} service=${service_type}`
    );

    return res.status(200).json({
      success: true,
      call_id: call.id,
      status: call.status || "queued",
    });
  } catch (err) {
    console.error("[intake/call] Error creating call:", err.message);
    return res.status(500).json({
      success: false,
      error: "We couldn't place the call right now. Please call us directly at (407) 877-9003.",
    });
  }
};
