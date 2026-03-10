# Voxaris VAPI Voice Agents — Family Orlando Dentistry

Production voice-agent layer for Family Orlando Dentistry (Ocoee, FL). Built on the VAPI platform with Rime TTS, Deepgram STT, and GPT-4o-mini.

## Architecture

```
Phone Call (PSTN)
  → VAPI Platform (orchestration, turn-taking, interruptions)
    → Deepgram Nova-2 (speech-to-text)
    → GPT-4o-mini (reasoning + tool calls)
    → Rime Arcana (text-to-speech, "cove" voice)
  → This Server (webhook handler)
    → Tool execution (capture_lead, request_appointment, etc.)
    → Call logging (status, transcript, cost)
```

## Inbound: V·TEAMS Squad

Inbound calls are handled by a VAPI **Squad** — multiple specialized assistants that route callers automatically:

```
Receptionist
  ├── Invisalign Qualifier   (teeth straightening, aligners, smile)
  ├── Emergency Qualifier    (pain, cracked tooth, bleeding, swelling)
  └── General Scheduler      (cleaning, checkup, follow-up)
```

The receptionist greets, listens for intent, and routes. Each sub-assistant picks up with full context — the caller never repeats themselves.

### Inbound Scenarios
- **Invisalign lead**: Qualifies motivation, timeline, prior ortho history → captures lead → requests consultation
- **Emergency call**: Triages pain level, symptoms, onset → flags priority → routes to same-day scheduling
- **General appointment**: Captures visit type, patient status, time preference → logs request

## Outbound: Campaign Assistants

Three outbound campaign types, each with a dedicated prompt:

| Campaign | Purpose | Prompt File |
|----------|---------|-------------|
| `hygiene_reactivation` | Overdue cleaning patients | `agents/outbound/prompts/hygiene-reactivation.txt` |
| `invisalign_followup` | Warm leads who didn't book | `agents/outbound/prompts/invisalign-followup.txt` |
| `dormant_revival` | Patients absent 6+ months | `agents/outbound/prompts/dormant-revival.txt` |

All outbound calls use the "Ava" persona — warm, brief, non-pushy.
Per-call personalization via `assistantOverrides` (patient name, months overdue, etc.).

## Tools

| Tool | Type | Description |
|------|------|-------------|
| `capture_lead` | sync | Record interest type, motivation, timeline, history |
| `request_appointment` | sync | Submit appointment request with visit type and priority |
| `mark_emergency_priority` | sync | Flag call as dental emergency with symptoms |
| `log_reactivation_interest` | async | Record outbound call disposition |
| `transfer_to_human` | sync | Transfer caller to live staff at (407) 877-9003 |

## File Structure

```
vapi/
├── server.js                          # Standalone Express server
├── package.json                       # Dependencies (just dotenv)
├── .env.example                       # Environment variable template
├── README.md                          # This file
│
├── agents/
│   ├── inbound/
│   │   ├── squad.js                   # Squad config (receptionist + qualifiers)
│   │   └── prompts/
│   │       ├── receptionist.txt       # Front-desk greeting + routing
│   │       ├── qualifier-invisalign.txt  # Invisalign qualification flow
│   │       ├── qualifier-emergency.txt   # Emergency triage flow
│   │       └── general-scheduler.txt     # General appointment capture
│   └── outbound/
│       ├── assistant.js               # Outbound assistant configs + overrides
│       └── prompts/
│           ├── hygiene-reactivation.txt  # Overdue cleaning outreach
│           ├── invisalign-followup.txt   # Warm Invisalign lead follow-up
│           └── dormant-revival.txt       # Dormant patient re-engagement
│
├── lib/
│   ├── vapi-client.js                 # VAPI REST API client (no SDK)
│   ├── tools.js                       # Tool definitions with filler messages
│   └── tool-handlers.js              # Tool execution logic (mock → production)
│
├── api/
│   ├── webhook.js                     # Main webhook router
│   ├── outbound.js                    # Outbound call trigger endpoint
│   └── setup.js                       # Provisioning script (create assistants)
│
└── handlers/
    ├── assistant-request.js           # Returns squad for inbound calls
    ├── tool-calls.js                  # Routes tool calls to handlers
    ├── status-update.js               # Call lifecycle logging
    └── end-of-call-report.js          # Transcript/cost storage
```

## Setup

### 1. Install

```bash
cd vapi
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in:
#   VAPI_API_KEY              — from dashboard.vapi.ai
#   VAPI_OUTBOUND_PHONE_NUMBER_ID — import a Twilio number in VAPI dashboard
#   VAPI_WEBHOOK_URL          — your public webhook URL
```

Provider keys (OpenAI, Deepgram, Rime) go in **VAPI Dashboard → Provider Keys**, not in your `.env`.

### 3. Run Locally

```bash
npm start
# or with auto-reload:
npm run dev
```

### 4. Expose via ngrok (for testing)

```bash
ngrok http 3000
# Copy the https URL → set as VAPI phone number serverUrl
```

### 5. Provision Assistants

```bash
npm run setup
# or: VAPI_API_KEY=xxx node api/setup.js
```

This creates the outbound assistants and inbound squad in VAPI.

### 6. Configure VAPI Phone Number

In the VAPI dashboard:
1. Import your Twilio phone number
2. Set the phone number's **Server URL** to your webhook endpoint
3. Inbound calls will automatically receive the squad config via `assistant-request`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/vapi/webhook` | VAPI webhook (all events) |
| POST | `/api/vapi/outbound` | Trigger an outbound call |
| POST | `/api/vapi/setup` | Provision assistants in VAPI |
| GET | `/health` | Health check |

### Trigger an Outbound Call

```bash
curl -X POST http://localhost:3000/api/vapi/outbound \
  -H "Content-Type: application/json" \
  -d '{
    "campaign": "hygiene_reactivation",
    "phone_number": "+14075551234",
    "patient_name": "Sarah",
    "months_overdue": "8"
  }'
```

## Prompt Design

All prompts follow VAPI's recommended structure:
- **Identity** — Who the agent is
- **Style** — How to speak (1-2 sentences, conversational, no lists)
- **Task** — Numbered steps
- **Response Guidelines** — Guardrails
- **Error Handling** — Fallbacks

Prompts are under 500 tokens to minimize TTFB latency.
`maxTokens: 200` on all assistants to prevent rambling.

## What's Runnable Now

- The webhook server starts and handles all VAPI event types
- Tool call routing works end-to-end (returns mock results, logs to console)
- Inbound squad config is returned correctly for `assistant-request`
- Outbound call trigger validates input and calls VAPI API
- Setup script provisions assistants via VAPI API

## What Requires Live Credentials

- `VAPI_API_KEY` — Required for any VAPI API call
- `VAPI_OUTBOUND_PHONE_NUMBER_ID` — Required for outbound calls
- A Twilio phone number imported into VAPI — Required for inbound calls
- OpenAI, Deepgram, and Rime API keys configured in VAPI dashboard
- A public URL (ngrok or Vercel) for the webhook endpoint

## Cost Estimate

| Component | Cost |
|-----------|------|
| VAPI orchestration | ~$0.05/min |
| Deepgram Nova-2 (STT) | ~$0.01/min |
| GPT-4o-mini (LLM) | ~$0.03-0.05/min |
| Rime Arcana (TTS) | ~$0.04/min |
| Twilio (telephony) | ~$0.02/min |
| **Total** | **~$0.15-0.17/min** |

## Practice Info

- **Practice**: Family Orlando Dentistry / Nitisusanta Family Dentistry
- **Location**: 2704 Rew Circle, Suite 103, Ocoee, FL 34761
- **Doctors**: Dr. Nadine Nitisusanta DMD & Dr. Jonathan Nitisusanta DDS
- **Phone**: (407) 877-9003
- **Hours**: Mon, Tue, Thu, Fri 9am-5pm (Wed & weekends closed)
- **Website**: [familyorlandodentistry.com](https://familyorlandodentistry.com/)
