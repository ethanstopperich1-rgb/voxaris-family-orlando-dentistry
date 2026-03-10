/**
 * Standalone Express Server
 *
 * Runs the VAPI webhook and outbound API as a simple Node.js server.
 * No Next.js or framework required — useful for local testing and ngrok.
 *
 * Usage:
 *   cp .env.example .env   # fill in values
 *   node server.js
 *
 * Then expose via ngrok:
 *   ngrok http 3000
 *   → Set VAPI phone number serverUrl to https://xxxx.ngrok.io/api/vapi/webhook
 */

require("dotenv").config();

const http = require("http");
const { handleWebhook } = require("./api/webhook");
const { triggerOutboundCall } = require("./api/outbound");
const { runSetup } = require("./api/setup");

const PORT = process.env.PORT || 3000;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers for development
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    // ─── Webhook ───
    if (url.pathname === "/api/vapi/webhook" && req.method === "POST") {
      const body = await parseBody(req);
      const result = await handleWebhook(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result));
    }

    // ─── Outbound ───
    if (url.pathname === "/api/vapi/outbound" && req.method === "POST") {
      const body = await parseBody(req);
      const result = await triggerOutboundCall(body);
      const status = result.success ? 200 : 400;
      res.writeHead(status, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result));
    }

    // ─── Setup ───
    if (url.pathname === "/api/vapi/setup" && req.method === "POST") {
      const secret = req.headers["x-setup-secret"];
      if (process.env.SETUP_SECRET && secret !== process.env.SETUP_SECRET) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Unauthorized" }));
      }
      const result = await runSetup();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true, created: result }));
    }

    // ─── Health ───
    if (url.pathname === "/health" || url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "ok",
          service: "voxaris-vapi-family-orlando-dentistry",
          endpoints: [
            "POST /api/vapi/webhook",
            "POST /api/vapi/outbound",
            "POST /api/vapi/setup",
          ],
        })
      );
    }

    // ─── 404 ───
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    console.error("[server] Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  Voxaris VAPI Server — Family Orlando Dentistry`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  Listening on http://localhost:${PORT}`);
  console.log(`  Webhook:  POST http://localhost:${PORT}/api/vapi/webhook`);
  console.log(`  Outbound: POST http://localhost:${PORT}/api/vapi/outbound`);
  console.log(`  Setup:    POST http://localhost:${PORT}/api/vapi/setup`);
  console.log(`  Health:   GET  http://localhost:${PORT}/health\n`);
});
