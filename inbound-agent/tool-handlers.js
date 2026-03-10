/**
 * V·SENSE Inbound — Tool Handlers
 * Family Orlando Dentistry
 *
 * Production webhook handlers for VAPI tool calls.
 * These receive POST requests from VAPI when the agent invokes a tool.
 *
 * Deploy as: Vercel serverless function, Express route, or standalone webhook endpoint.
 */

// ── Database Layer ─────────────────────────────────────
// Replace with your actual database client (Supabase, Airtable, Firebase, etc.)
// These are structured for Supabase but the interface is generic.

async function writeToDatabase(table, record) {
  // TODO: Replace with actual database client
  // Example for Supabase:
  //   const { data, error } = await supabase.from(table).insert(record);
  //   if (error) throw new Error(`DB write failed: ${error.message}`);
  //   return data;
  throw new Error('Database client not configured — see README for setup instructions');
}

// ── Notification Layer ─────────────────────────────────

async function sendUrgentNotification(channel, message) {
  // TODO: Replace with actual notification service (Twilio SMS, Slack webhook, email)
  // Example for Slack:
  //   await fetch(SLACK_WEBHOOK_URL, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ text: message })
  //   });
  throw new Error('Notification service not configured — see README for setup instructions');
}

// ── Tool Handlers ──────────────────────────────────────

const handlers = {

  /**
   * capture_lead
   * Writes a qualified Invisalign/cosmetic lead to the database.
   */
  async capture_lead(params) {
    const {
      caller_name,
      callback_phone,
      interest_type,
      intent_level,
      qualification_notes,
      time_preference,
      prior_orthodontic_history
    } = params;

    // Validate required fields
    if (!callback_phone) {
      return {
        success: false,
        error: 'Missing callback_phone — cannot store lead without contact info'
      };
    }

    const record = {
      caller_name: caller_name || 'Unknown',
      callback_phone,
      interest_type,
      intent_level,
      qualification_notes: qualification_notes || '',
      time_preference: time_preference || '',
      prior_orthodontic_history: prior_orthodontic_history ?? null,
      source: 'vsense_inbound',
      created_at: new Date().toISOString(),
      status: 'new'
    };

    await writeToDatabase('leads', record);

    // Notify team for hot leads
    if (intent_level === 'hot') {
      await sendUrgentNotification('leads',
        `🔥 HOT LEAD: ${caller_name || 'Unknown'} — ${interest_type} — wants to book within 30 days. Call back: ${callback_phone}`
      );
    }

    return { success: true, lead_id: record.created_at };
  },

  /**
   * request_appointment
   * Writes a scheduling request to the database.
   */
  async request_appointment(params) {
    const {
      caller_name,
      callback_phone,
      appointment_type,
      time_preference,
      notes,
      is_new_patient
    } = params;

    if (!callback_phone) {
      return {
        success: false,
        error: 'Missing callback_phone — cannot schedule without contact info'
      };
    }

    const record = {
      caller_name: caller_name || 'Unknown',
      callback_phone,
      appointment_type,
      time_preference: time_preference || '',
      notes: notes || '',
      is_new_patient: is_new_patient ?? null,
      source: 'vsense_inbound',
      created_at: new Date().toISOString(),
      status: 'pending_confirmation'
    };

    await writeToDatabase('appointment_requests', record);

    return { success: true, request_id: record.created_at };
  },

  /**
   * mark_emergency_priority
   * Writes an emergency case to the database and sends urgent notification.
   */
  async mark_emergency_priority(params) {
    const {
      caller_name,
      callback_phone,
      issue_description,
      pain_level,
      symptoms,
      onset,
      severity_tier,
      after_hours
    } = params;

    if (!callback_phone) {
      return {
        success: false,
        error: 'Missing callback_phone — cannot follow up on emergency without contact info'
      };
    }

    const record = {
      caller_name: caller_name || 'Unknown',
      callback_phone,
      issue_description,
      pain_level: pain_level ?? null,
      symptoms: symptoms || '',
      onset: onset || '',
      severity_tier,
      after_hours: after_hours ?? false,
      source: 'vsense_inbound',
      created_at: new Date().toISOString(),
      status: 'awaiting_triage'
    };

    await writeToDatabase('emergencies', record);

    // Always send urgent notification for emergencies
    const urgency = severity_tier === 'critical' ? '🚨 CRITICAL' : severity_tier === 'high' ? '⚠️ HIGH' : '📋 MODERATE';
    await sendUrgentNotification('emergencies',
      `${urgency} EMERGENCY: ${caller_name || 'Unknown'} — ${issue_description}. Pain: ${pain_level ?? 'not reported'}/10. Call back: ${callback_phone}. ${after_hours ? '(AFTER HOURS)' : ''}`
    );

    return { success: true, case_id: record.created_at };
  },

  /**
   * transfer_to_human
   * Signals VAPI to transfer the call to a live agent.
   */
  async transfer_to_human(params) {
    const { reason, context_summary } = params;

    // In VAPI, transfer is handled by returning a specific response format.
    // The actual transfer mechanism depends on your VAPI/telephony config.
    // This handler logs the transfer attempt and returns the signal.

    const record = {
      reason,
      context_summary: context_summary || '',
      source: 'vsense_inbound',
      created_at: new Date().toISOString()
    };

    // Best-effort log — don't block transfer on DB failure
    try {
      await writeToDatabase('transfer_log', record);
    } catch (_) {
      // Swallow — transfer takes priority over logging
    }

    return {
      success: true,
      action: 'transfer',
      destination: '+14078779003', // Office direct line
      context: context_summary
    };
  }
};

// ── Webhook Entry Point ────────────────────────────────

/**
 * Main webhook handler for VAPI tool calls.
 * Mount this at your webhook URL (e.g., /api/vapi-tools).
 *
 * For Vercel: export default as the handler.
 * For Express: app.post('/api/vapi-tools', handleToolCall).
 */
async function handleToolCall(req, res) {
  try {
    const { message } = req.body;

    // VAPI sends tool calls in message.tool_calls
    if (!message || !message.tool_calls || message.tool_calls.length === 0) {
      return res.status(400).json({ error: 'No tool calls in request' });
    }

    const results = [];

    for (const toolCall of message.tool_calls) {
      const { name, arguments: args } = toolCall.function;
      const handler = handlers[name];

      if (!handler) {
        results.push({
          tool_call_id: toolCall.id,
          result: JSON.stringify({ success: false, error: `Unknown tool: ${name}` })
        });
        continue;
      }

      try {
        const result = await handler(typeof args === 'string' ? JSON.parse(args) : args);
        results.push({
          tool_call_id: toolCall.id,
          result: JSON.stringify(result)
        });
      } catch (err) {
        console.error(`Tool ${name} failed:`, err.message);
        results.push({
          tool_call_id: toolCall.id,
          result: JSON.stringify({ success: false, error: err.message })
        });
      }
    }

    return res.status(200).json({ results });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal handler error' });
  }
}

// ── Exports ────────────────────────────────────────────

module.exports = { handleToolCall, handlers };

// For Vercel serverless:
// module.exports = handleToolCall;
