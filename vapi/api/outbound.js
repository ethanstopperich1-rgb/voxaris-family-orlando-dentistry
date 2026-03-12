/**
 * Outbound Call Trigger
 *
 * Endpoint: POST /api/vapi/outbound
 *
 * Creates an outbound call via the VAPI API.
 * Accepts a campaign type, patient phone number, and optional personalization.
 *
 * Request body:
 * {
 *   campaign: "hygiene_reactivation" | "invisalign_followup" | "dormant_revival",
 *   phone_number: "+14075551234",
 *   patient_name: "Sarah",           // optional
 *   months_overdue: "8",             // optional
 *   original_interest_date: "Jan 2026" // optional
 * }
 *
 * For Next.js App Router, copy this into:
 *   app/api/vapi/outbound/route.js
 */

const { getVapiClient } = require("../lib/vapi-client");
const {
  getHygieneReactivationConfig,
  getInvisalignFollowupConfig,
  getDormantRevivalConfig,
  getAppointmentReminderConfig,
  getCallOverrides,
} = require("../agents/outbound/assistant");

const CAMPAIGN_CONFIGS = {
  hygiene_reactivation: getHygieneReactivationConfig,
  invisalign_followup: getInvisalignFollowupConfig,
  dormant_revival: getDormantRevivalConfig,
  appointment_reminder: getAppointmentReminderConfig,
};

async function triggerOutboundCall(params) {
  const {
    campaign,
    phone_number,
    patient_name,
    months_overdue,
    original_interest_date,
  } = params;

  // Validate
  if (!campaign || !CAMPAIGN_CONFIGS[campaign]) {
    return {
      success: false,
      error: `Invalid campaign. Use: ${Object.keys(CAMPAIGN_CONFIGS).join(", ")}`,
    };
  }
  if (!phone_number) {
    return { success: false, error: "phone_number is required." };
  }

  const phoneNumberId = (process.env.VAPI_OUTBOUND_PHONE_NUMBER_ID || "").trim();
  if (!phoneNumberId) {
    return {
      success: false,
      error: "VAPI_OUTBOUND_PHONE_NUMBER_ID not configured.",
    };
  }

  const serverUrl = (
    process.env.VAPI_WEBHOOK_URL ||
    `${process.env.NEXT_PUBLIC_BASE_URL || "https://localhost:3000"}/api/vapi/webhook`
  ).trim();

  // Get assistant config for this campaign
  const getConfig = CAMPAIGN_CONFIGS[campaign];
  const assistantConfig = getConfig(serverUrl);

  // Build personalization overrides
  const dynamicVars = {};
  if (patient_name) dynamicVars.patient_name = patient_name;
  if (months_overdue) dynamicVars.months_overdue = months_overdue;
  if (original_interest_date)
    dynamicVars.original_interest_date = original_interest_date;

  // Personalize first message if patient name is available
  let firstMessage = assistantConfig.firstMessage;
  if (patient_name) {
    firstMessage = firstMessage.replace(
      "Hi, this is Ava",
      `Hi ${patient_name}, this is Ava`
    );
  }

  // Create the call via VAPI API
  const vapi = getVapiClient();

  try {
    const call = await vapi.createCall({
      assistant: assistantConfig,
      phoneNumberId,
      customer: {
        number: phone_number,
        name: patient_name || undefined,
      },
      assistantOverrides: {
        firstMessage,
        ...getCallOverrides(dynamicVars),
      },
      metadata: {
        campaign,
        patient_name: patient_name || null,
        triggered_at: new Date().toISOString(),
      },
    });

    console.log(
      `[outbound] Call created: ${call.id} campaign=${campaign} to=${phone_number}`
    );

    return {
      success: true,
      call_id: call.id,
      campaign,
      phone_number,
      status: call.status || "queued",
    };
  } catch (err) {
    console.error(`[outbound] Failed to create call:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Next.js App Router Export ───
// Uncomment if using as app/api/vapi/outbound/route.js:
//
// import { NextRequest, NextResponse } from "next/server";
// export const runtime = "nodejs";
//
// export async function POST(request) {
//   const body = await request.json();
//   const result = await triggerOutboundCall(body);
//   return NextResponse.json(result, { status: result.success ? 200 : 400 });
// }

module.exports = { triggerOutboundCall, CAMPAIGN_CONFIGS };
