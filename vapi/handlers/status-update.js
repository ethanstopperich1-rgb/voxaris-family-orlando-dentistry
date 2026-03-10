/**
 * status-update Handler
 *
 * VAPI sends status updates as calls progress:
 *   ringing → in-progress → ended
 *
 * We log these events. In production, update a voiceCalls table.
 */

function handleStatusUpdate(body) {
  const call = body.message?.call || {};
  const status = body.message?.status || "unknown";
  const callId = call.id || "unknown";
  const callerNumber = call.customer?.number || "unknown";

  console.log(
    `[status-update] call=${callId} status=${status} caller=${callerNumber}`
  );

  // TODO: Upsert into voiceCalls table
  // await db.insert(voiceCalls).values({
  //   callId,
  //   callerNumber,
  //   status,
  //   direction: call.type === "inboundPhoneCall" ? "inbound" : "outbound",
  //   updatedAt: new Date(),
  // }).onConflictDoUpdate({
  //   target: voiceCalls.callId,
  //   set: { status, updatedAt: new Date() },
  // });

  return { ok: true };
}

module.exports = { handleStatusUpdate };
