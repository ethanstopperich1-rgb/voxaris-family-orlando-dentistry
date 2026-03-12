/**
 * end-of-call-report Handler
 *
 * VAPI sends a full report after each call ends, including:
 *   - Full transcript
 *   - Individual messages (role + text)
 *   - Recording URL
 *   - Cost
 *   - Duration
 *   - Ended reason
 *   - Summary (if available)
 *
 * Logs call data to Google Sheets "Call Log" tab.
 */

const { google } = require("googleapis");

function getSheetsClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.sheets({ version: "v4", auth: oauth2 });
}

async function logCallToSheet(report) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;

  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    const row = [
      report.completedAt,
      report.callId,
      report.callType || "",
      report.assistantName || "",
      report.customerNumber || "",
      report.customerName || "",
      report.endedReason,
      report.duration,
      `$${(report.cost || 0).toFixed(4)}`,
      report.summary || "",
      report.transcript || "",
      report.recordingUrl || "",
      report.messageCount || 0,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Call Log!A:M",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    console.log(`[sheets] Logged call ${report.callId} to Call Log`);
  } catch (err) {
    console.error("[sheets] Failed to log call:", err.message);
  }
}

function handleEndOfCallReport(body) {
  const call = body.message?.call || {};
  const callId = call.id || "unknown";
  const endedReason = body.message?.endedReason || "unknown";
  const artifact = body.message?.artifact || {};

  // Extract summary from analysis if available
  const analysis = body.message?.analysis || {};
  const summary = analysis.summary || "";

  const report = {
    callId,
    callType: call.type || "",
    assistantName: call.assistant?.name || call.assistantId || "",
    customerNumber: call.customer?.number || "",
    customerName: call.customer?.name || "",
    endedReason,
    cost: call.cost || 0,
    duration: call.duration || 0,
    summary,
    transcript: artifact.transcript || "",
    recordingUrl: artifact.recordingUrl || null,
    messageCount: (artifact.messages || []).length,
    completedAt: new Date().toISOString(),
  };

  console.log(
    `[end-of-call-report] call=${callId} reason=${endedReason} ` +
      `duration=${report.duration}s cost=$${report.cost?.toFixed(4)} ` +
      `messages=${report.messageCount}`
  );

  // Log to Google Sheets (fire and forget)
  logCallToSheet(report).catch(() => {});

  return { ok: true };
}

module.exports = { handleEndOfCallReport };
