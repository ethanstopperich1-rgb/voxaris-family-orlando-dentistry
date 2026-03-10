/**
 * Setup / Provisioning Script
 *
 * Creates the outbound assistants in VAPI via API.
 * Run once during initial deployment, or after prompt changes.
 *
 * Usage:
 *   VAPI_API_KEY=xxx node vapi/api/setup.js
 *
 * For Next.js, this can also be exposed as a protected endpoint:
 *   POST /api/vapi/setup  (requires SETUP_SECRET header)
 */

const { getVapiClient } = require("../lib/vapi-client");
const {
  getHygieneReactivationConfig,
  getInvisalignFollowupConfig,
  getDormantRevivalConfig,
} = require("../agents/outbound/assistant");
const { getInboundSquad } = require("../agents/inbound/squad");

async function runSetup() {
  const vapi = getVapiClient();

  const serverUrl =
    process.env.VAPI_WEBHOOK_URL ||
    `${process.env.NEXT_PUBLIC_BASE_URL || "https://localhost:3000"}/api/vapi/webhook`;

  console.log(`[setup] Using webhook URL: ${serverUrl}`);
  console.log("[setup] Creating outbound assistants...\n");

  const configs = [
    { label: "Hygiene Reactivation", config: getHygieneReactivationConfig(serverUrl) },
    { label: "Invisalign Follow-up", config: getInvisalignFollowupConfig(serverUrl) },
    { label: "Dormant Revival", config: getDormantRevivalConfig(serverUrl) },
  ];

  const created = [];

  for (const { label, config } of configs) {
    try {
      const result = await vapi.createAssistant(config);
      console.log(`  [OK] ${label}: ${result.id}`);
      created.push({ label, id: result.id, name: config.name });
    } catch (err) {
      console.error(`  [FAIL] ${label}: ${err.message}`);
    }
  }

  console.log("\n[setup] Creating inbound squad...\n");

  try {
    const squad = getInboundSquad(serverUrl);
    const result = await vapi.createSquad(squad);
    console.log(`  [OK] Inbound Squad: ${result.id}`);
    created.push({ label: "Inbound Squad", id: result.id });
  } catch (err) {
    console.error(`  [FAIL] Inbound Squad: ${err.message}`);
  }

  console.log("\n[setup] Done. Created resources:");
  console.log(JSON.stringify(created, null, 2));
  console.log("\nAdd outbound assistant IDs to your .env as needed.");

  return created;
}

// Run directly if called from CLI
if (require.main === module) {
  runSetup().catch((err) => {
    console.error("[setup] Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { runSetup };
