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
 *
 * We log and store this data. In production, write to voiceCalls + voiceUtterances.
 */

function handleEndOfCallReport(body) {
  const call = body.message?.call || {};
  const callId = call.id || "unknown";
  const endedReason = body.message?.endedReason || "unknown";
  const artifact = body.message?.artifact || {};

  const report = {
    callId,
    endedReason,
    cost: call.cost || 0,
    duration: call.duration || 0,
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

  // TODO: Update voiceCalls row with final data
  // await db.update(voiceCalls).set({
  //   status: "completed",
  //   endedReason,
  //   transcript: report.transcript,
  //   recordingUrl: report.recordingUrl,
  //   costUsd: report.cost,
  //   durationSeconds: report.duration,
  //   completedAt: new Date(),
  // }).where(eq(voiceCalls.callId, callId));

  // TODO: Insert individual utterances
  // for (const [i, msg] of (artifact.messages || []).entries()) {
  //   await db.insert(voiceUtterances).values({
  //     callId,
  //     role: msg.role,
  //     text: msg.message,
  //     sequence: i,
  //   });
  // }

  return { ok: true };
}

module.exports = { handleEndOfCallReport };
