/**
 * VAPI Webhook Event Handler
 *
 * Processes status/event webhooks from VAPI:
 * - call started / ended
 * - transcript updates
 * - speech events
 * - hang events
 *
 * In production, these would persist to a database and trigger
 * downstream workflows (alerts, analytics, CRM updates).
 */

async function handleWebhookEvent(message) {
  if (!message) {
    console.warn('[webhook] Received empty message');
    return;
  }

  const type = message.type;
  const callId = message.call?.id || 'unknown';
  const timestamp = new Date().toISOString();

  switch (type) {
    case 'status-update': {
      const status = message.status;
      console.log(`[webhook:status] call=${callId} status=${status} at=${timestamp}`);

      if (status === 'ended') {
        const duration = message.call?.duration;
        const endReason = message.endedReason || 'unknown';
        console.log(`[webhook:call-ended] call=${callId} duration=${duration}s reason=${endReason}`);
        // TODO: Update call record in database
        // TODO: Trigger post-call analytics pipeline
      }
      break;
    }

    case 'transcript': {
      const role = message.role || 'unknown';
      const text = message.transcript || '';
      console.log(`[webhook:transcript] call=${callId} role=${role} text="${text.substring(0, 80)}..."`);
      // TODO: Append to call transcript in database
      break;
    }

    case 'speech-update': {
      const speechStatus = message.status;
      console.log(`[webhook:speech] call=${callId} status=${speechStatus}`);
      break;
    }

    case 'hang': {
      console.log(`[webhook:hang] call=${callId} — caller hung up`);
      // TODO: Log hang event for analytics
      break;
    }

    case 'tool-calls': {
      // Tool calls are handled separately via /api/tool-call
      console.log(`[webhook:tool-calls] call=${callId} — routed to tool-call handler`);
      break;
    }

    default:
      console.log(`[webhook:${type}] call=${callId} (unhandled event type)`);
  }
}

module.exports = { handleWebhookEvent };
