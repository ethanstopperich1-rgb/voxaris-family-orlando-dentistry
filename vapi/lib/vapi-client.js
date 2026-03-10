/**
 * VAPI REST API Client
 *
 * Lightweight client for the VAPI platform API.
 * Uses direct fetch — no SDK dependency.
 *
 * Auth: Authorization: Bearer <VAPI_API_KEY>
 * Base: https://api.vapi.ai
 */

class VapiApiError extends Error {
  constructor(statusCode, body) {
    super(`VAPI API error ${statusCode}: ${body}`);
    this.name = "VapiApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

class VapiClient {
  constructor() {
    this.apiKey = process.env.VAPI_API_KEY || "";
    this.baseUrl = "https://api.vapi.ai";
    if (!this.apiKey) {
      console.warn("[vapi-client] VAPI_API_KEY not set — API calls will fail");
    }
  }

  async _request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(15000),
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (!res.ok) {
      const text = await res.text();
      throw new VapiApiError(res.status, text);
    }
    return res.json();
  }

  // ─── Assistants ───

  async createAssistant(config) {
    return this._request("POST", "/assistant", config);
  }

  async getAssistant(id) {
    return this._request("GET", `/assistant/${id}`);
  }

  async updateAssistant(id, patch) {
    return this._request("PATCH", `/assistant/${id}`, patch);
  }

  async listAssistants() {
    return this._request("GET", "/assistant");
  }

  // ─── Squads ───

  async createSquad(config) {
    return this._request("POST", "/squad", config);
  }

  // ─── Calls ───

  async createCall(config) {
    return this._request("POST", "/call", config);
  }

  async getCall(id) {
    return this._request("GET", `/call/${id}`);
  }

  // ─── Phone Numbers ───

  async listPhoneNumbers() {
    return this._request("GET", "/phone-number");
  }
}

// Singleton
let _client;
function getVapiClient() {
  if (!_client) _client = new VapiClient();
  return _client;
}

module.exports = { VapiClient, VapiApiError, getVapiClient };
