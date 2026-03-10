#!/usr/bin/env node
/**
 * Deploy V·SENSE Outbound Assistant to VAPI
 *
 * Usage:
 *   VAPI_API_KEY=<key> node deploy.js
 *
 * Creates the assistant if it doesn't exist, or updates it if
 * VAPI_OUTBOUND_ASSISTANT_ID is set in the environment.
 */

const { V_SENSE_OUTBOUND_CONFIG } = require("./v-sense-config");

const VAPI_API_KEY = process.env.VAPI_API_KEY || "0ecce228-c953-45f6-b16c-31c5477a8a41";
const VAPI_BASE = "https://api.vapi.ai";
const EXISTING_ID = process.env.VAPI_OUTBOUND_ASSISTANT_ID || "";

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VAPI_API_KEY}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${VAPI_BASE}${path}`, opts);
  const text = await res.text();

  if (!res.ok) {
    console.error(`VAPI ${method} ${path} → ${res.status}`);
    console.error(text);
    process.exit(1);
  }

  return JSON.parse(text);
}

async function main() {
  console.log("─── V·SENSE Outbound Deployment ───\n");

  // Add serverUrl placeholder — set to your actual webhook endpoint
  const config = {
    ...V_SENSE_OUTBOUND_CONFIG,
    serverUrl:
      process.env.VAPI_SERVER_URL ||
      "https://your-app.vercel.app/api/voice/webhooks/vapi",
  };

  if (EXISTING_ID) {
    console.log(`Updating existing assistant: ${EXISTING_ID}`);
    const result = await request("PATCH", `/assistant/${EXISTING_ID}`, config);
    console.log(`Updated: ${result.id}`);
    console.log(`Name: ${result.name}`);
  } else {
    console.log("Creating new assistant...");
    const result = await request("POST", "/assistant", config);
    console.log(`Created: ${result.id}`);
    console.log(`Name: ${result.name}`);
    console.log(`\nSet this in your env:`);
    console.log(`  VAPI_OUTBOUND_ASSISTANT_ID=${result.id}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
