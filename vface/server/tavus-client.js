/**
 * Tavus API Client
 *
 * Handles all Tavus API calls: persona CRUD, conversation lifecycle,
 * and document management. Uses Node https module to avoid dependency bloat.
 */

const https = require('https');
const { config } = require('../config/tavus-config');

/**
 * Make an authenticated request to the Tavus API
 */
function tavusRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(`${config.apiBase}${path}`);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ status: res.statusCode, body: parsed });
          }
        } catch {
          reject({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Create a new conversation session
 */
async function createConversation({ greeting, context, conversationName } = {}) {
  const payload = {
    persona_id: config.personaId,
    replica_id: config.replicaId,
    conversation_name: conversationName || config.conversationDefaults.conversation_name,
    properties: { ...config.conversationDefaults.properties },
  };

  if (greeting) {
    payload.custom_greeting = greeting;
  }

  if (context) {
    payload.conversational_context = context;
  }

  return tavusRequest('POST', '/conversations', payload);
}

/**
 * End an active conversation
 */
async function endConversation(conversationId) {
  return tavusRequest('POST', `/conversations/${conversationId}/end`);
}

/**
 * Get conversation details
 */
async function getConversation(conversationId) {
  return tavusRequest('GET', `/conversations/${conversationId}`);
}

/**
 * Create a persona (one-time setup)
 */
async function createPersona() {
  const payload = {
    ...config.personaPayload,
    system_prompt: config.systemPrompt,
    default_replica_id: config.replicaId || undefined,
  };
  return tavusRequest('POST', '/personas', payload);
}

/**
 * Update a persona's system prompt (JSON Patch RFC 6902)
 */
async function updatePersonaPrompt(personaId, newPrompt) {
  const patchOps = [
    { op: 'replace', path: '/system_prompt', value: newPrompt },
  ];
  return tavusRequest('PATCH', `/personas/${personaId}`, patchOps);
}

/**
 * Get persona details
 */
async function getPersona(personaId) {
  return tavusRequest('GET', `/personas/${personaId}`);
}

/**
 * List available replicas
 */
async function listReplicas() {
  return tavusRequest('GET', '/replicas');
}

/**
 * Send tool results back to an active conversation
 */
async function sendToolResults(conversationId, toolCallId, result) {
  return tavusRequest('POST', `/conversations/${conversationId}/tool-results`, {
    tool_call_id: toolCallId,
    result,
  });
}

module.exports = {
  tavusRequest,
  createConversation,
  endConversation,
  getConversation,
  createPersona,
  updatePersonaPrompt,
  getPersona,
  listReplicas,
  sendToolResults,
};
