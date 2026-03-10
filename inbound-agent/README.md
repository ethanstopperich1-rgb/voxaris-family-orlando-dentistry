# V·SENSE Inbound Agent — Family Orlando Dentistry

Production-ready inbound voice agent configuration for Family Orlando Dentistry.

## Files

| File | Purpose |
|------|---------|
| `system-prompt.md` | Full agent system prompt — deploy to VAPI/Retell as the LLM prompt |
| `tool-schemas.json` | Tool definitions with required fields, types, and filler messages |
| `tool-handlers.js` | Webhook handlers for tool calls — wire to your database + notifications |
| `README.md` | This file |

## What Was Fixed (from Stress Test)

The original prompt scored 41/100 with 7 critical blockers. All are resolved:

| # | Issue | Fix |
|---|-------|-----|
| 1 | Zero contact info collected | Mandatory name + callback phone collection in every flow, with refusal handling |
| 2 | All tool handlers were stubs | Real handler structure with validation, DB writes, and notification dispatch |
| 3 | No Florida two-party recording consent | Mandatory first-sentence disclosure with objection handling |
| 4 | Emergency tool failure gave false assurance | Explicit fallback: provide office number, never imply it was logged if it wasn't |
| 5 | No after-hours emergency guidance | Avulsion protocol, severity-tiered safety guidance, ER redirect for critical cases |
| 6 | No prompt injection or PII guardrails | Security section: AI disclosure, instruction-ignore defense, PII rules, hostility handling |
| 7 | Emergency mid-conversation had no escape | Emergency Detection override applies to ALL flows — agent pivots immediately |

## Setup

### 1. Deploy the system prompt
Copy the contents of `system-prompt.md` into your voice platform's LLM prompt field (VAPI, Retell, etc.).

### 2. Register the tools
Use `tool-schemas.json` to register tools in your voice platform. Each tool includes:
- Required and optional parameters
- Type constraints and enums
- Filler messages for natural conversation flow

### 3. Wire the webhook handlers
`tool-handlers.js` needs two things configured before it works:

**Database client** — Replace the `writeToDatabase()` function with your actual DB client. Tables needed:
- `leads` — Invisalign/cosmetic lead records
- `appointment_requests` — Scheduling requests
- `emergencies` — Urgent dental cases
- `transfer_log` — Transfer attempt records

**Notification service** — Replace `sendUrgentNotification()` with your alert channel (Slack webhook, Twilio SMS, email API, etc.).

### 4. Deploy the webhook
Mount `handleToolCall` at your webhook URL:
- **Vercel:** Export as default serverless function
- **Express:** `app.post('/api/vapi-tools', handleToolCall)`
- Point your voice platform's tool webhook URL to this endpoint
