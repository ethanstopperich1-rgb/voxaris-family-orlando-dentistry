# Voxaris — Family Orlando Dentistry

AI agent system for a phone-first family dental practice. Includes inbound call routing, outbound patient reactivation, conversational video concierge, practice dashboard, landing page, and sales deck.

## Folder Structure

```
.
├── index.html              # Demo hub — links to all surfaces
├── inbound-demo/           # V·TEAMS inbound call simulation (static HTML)
├── outbound-demo/          # V·OUTBOUND reactivation simulation (static HTML)
├── dashboard/              # Voxaris Command practice dashboard (static HTML + Chart.js)
├── landing-page/           # Patient-facing website (static HTML + Tailwind CSS)
├── pitch-deck/             # 16-slide .pptx sales deck (python-pptx)
├── vapi/                   # Vapi voice agent layer
│   ├── agents/
│   │   ├── inbound/
│   │   │   ├── prompts/    # Receptionist, qualifiers, scheduler
│   │   │   └── squad-config.json
│   │   └── outbound/
│   │       ├── prompts/    # Hygiene, Invisalign follow-up, dormant revival
│   │       └── campaign-config.json
│   ├── api/
│   │   └── server.js       # Express webhook server (tool calls + events)
│   ├── handlers/
│   │   └── webhook-handler.js
│   ├── lib/
│   │   ├── tools.js        # VAPI tool definitions
│   │   ├── tool-handlers.js # Mock tool implementations
│   │   └── vapi-client.js  # VAPI REST API client
│   └── .env.example
└── vface/                  # Tavus V·FACE conversational video layer
    ├── config/
    │   ├── persona-prompt.md   # V·FACE system prompt
    │   └── tavus-config.js     # Tavus CVI configuration
    ├── public/
    │   └── index.html          # V·FACE test page with fallback UI
    ├── server/
    │   ├── index.js            # Express server (sessions, webhooks)
    │   └── tavus-client.js     # Tavus API client
    └── .env.example
```

## Demo Modes

### Static demos (no API keys needed)
Open `index.html` in a browser to access the demo hub. All static surfaces work without credentials:
- **Inbound Demo** — scripted multi-agent call simulation
- **Outbound Demo** — scripted reactivation call simulation
- **Dashboard** — interactive charts, pipeline table, ROI calculator
- **Landing Page** — full patient-facing website with V·FACE hero

### Live Vapi agents (requires VAPI_API_KEY)
```bash
cd vapi
cp .env.example .env   # Add your VAPI_API_KEY
npm install express
node api/server.js     # Starts on :3200
```
The server handles tool call webhooks and status events. Configure your VAPI assistant to point its `serverUrl` to this endpoint.

### Live V·FACE (requires Tavus credentials)
```bash
cd vface
cp .env.example .env   # Add TAVUS_API_KEY, TAVUS_PERSONA_ID, TAVUS_REPLICA_ID
npm install express dotenv
node server/index.js   # Starts on :3100
```
Open `http://localhost:3100` for the V·FACE test page. If credentials are missing, it shows a graceful fallback UI.

## Agent Architecture

### Inbound (V·TEAMS Squad)
```
Caller → Receptionist → Invisalign Qualifier
                       → Emergency Triage
                       → General Scheduler
```

### Outbound (V·OUTBOUND Campaigns)
- Hygiene Reactivation — overdue cleaning patients
- Invisalign Follow-Up — warm leads who haven't booked
- Dormant Revival — 12+ month inactive patients

### V·FACE (Tavus CVI)
Conversational video concierge embedded on the practice website. Welcomes visitors, qualifies interest, and routes to the right next step.

### Tool Layer
Five mock tools ready for database integration:
- `capture_lead` — record interest type, motivation, timeline
- `request_appointment` — log visit type, time preference, priority
- `mark_emergency_priority` — flag urgent cases
- `log_reactivation_interest` — record outbound call disposition
- `transfer_to_human` — hand off to live staff

## Practice

- **Family Orlando Dentistry** — Ocoee, FL
- (407) 877-9003
- familyorlandodentistry.com
