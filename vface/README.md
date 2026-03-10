# V·FACE — Tavus CVI Integration for Family Orlando Dentistry

Real-time conversational video concierge powered by Tavus CVI. Visitors talk face-to-face with a photorealistic AI dental concierge that handles Invisalign questions, emergency triage, appointment routing, and general inquiries.

## Architecture

```
Browser (index.html)
  |
  |-- POST /api/conversations  -->  Express Server (server/index.js)
  |                                       |
  |                                       +--> Tavus API: POST /v2/conversations
  |                                       |      (uses config + persona prompt)
  |                                       |
  |                                       +--> Returns { conversation_url }
  |
  |-- Daily.js joins conversation_url (WebRTC)
  |
  |-- Bidirectional audio/video with Tavus replica
```

### File Structure

```
vface/
├── index.html                    # Front-end V·FACE test page
├── .env.example                  # Env var template
├── README.md                     # This file
├── config/
│   ├── tavus-config.js           # Centralized config (reads .env)
│   └── persona-prompt.md         # System prompt for the concierge
├── server/
│   ├── package.json              # Node dependencies
│   ├── index.js                  # Express server (API + static)
│   └── tavus-client.js           # Tavus API client library
└── public/
    └── kb/
        └── family-orlando-kb.md  # Knowledge base document
```

## Setup

### Prerequisites

- Node.js 18+
- A Tavus account with API access (https://platform.tavus.io)

### Step 1: Install dependencies

```bash
cd vface/server
npm install
```

### Step 2: Create environment file

```bash
cd vface
cp .env.example .env
```

Add your `TAVUS_API_KEY` to the `.env` file.

### Step 3: Create your persona

Start the server first:

```bash
cd vface/server
npm start
```

Then create the persona (this registers your system prompt and layer config with Tavus):

```bash
curl -X POST http://localhost:3100/api/setup/persona
```

Copy the returned `persona_id` into your `.env` as `TAVUS_PERSONA_ID`.

### Step 4: Select a replica

Browse available replicas:

```bash
curl http://localhost:3100/api/setup/replicas
```

Pick a replica that matches the concierge profile (female, early 30s-40s, professional, warm). Copy the `replica_id` into your `.env` as `TAVUS_REPLICA_ID`.

### Step 5: Restart and test

```bash
cd vface/server
npm start
```

Open http://localhost:3100 in your browser. The status should show "Tavus Ready".

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Health check and config status |
| `POST` | `/api/conversations` | Create a new CVI session |
| `POST` | `/api/conversations/:id/end` | End an active session |
| `GET` | `/api/conversations/:id` | Get session details |
| `POST` | `/api/setup/persona` | Create the Tavus persona (dev) |
| `GET` | `/api/setup/replicas` | List available replicas (dev) |

### POST /api/conversations — Request Body

```json
{
  "visitor_name": "Maria",
  "concern": "invisalign",
  "urgency": "normal"
}
```

All fields are optional. The server uses them to personalize the greeting and set conversational context.

## Persona Prompt

The full system prompt lives in `config/persona-prompt.md`. It covers:

- Practice details (hours, location, doctors, contact)
- Invisalign qualification flow
- Emergency triage flow
- General inquiry handling
- After-hours awareness
- Tone and boundary rules

Edit this file to adjust the concierge's behavior, then either restart the server or call the persona update endpoint.

## Knowledge Base

`public/kb/family-orlando-kb.md` contains structured practice data for Tavus document context. To register it:

1. Deploy the file to a public URL
2. Call `POST /v2/documents` with the URL (see Tavus docs)
3. Attach to persona via document tags

## Fallback Behavior

The front-end handles all error states gracefully:

- **Server not running**: Shows "Server Offline" with setup instructions
- **Credentials missing**: Shows which env vars are needed
- **Session creation fails**: Shows error message, allows retry
- **Session ends**: Shows completion state with restart option
- **No video stream**: Placeholder remains visible until replica video arrives

The page never shows a broken empty video container.

## What Works Now vs What Needs Credentials

### Functional now (no credentials needed)
- Server starts and serves the front-end
- Status endpoint reports configuration state
- Front-end renders with branded loading/fallback/error states
- Persona prompt file is committed and ready
- Knowledge base document is committed
- Config module validates and reports missing credentials
- All API routes handle unconfigured state with clear error messages

### Requires Tavus credentials
- Live conversation creation (needs `TAVUS_API_KEY` + `TAVUS_PERSONA_ID` + `TAVUS_REPLICA_ID`)
- Real-time video/audio with Tavus replica
- Persona creation via setup endpoint (needs `TAVUS_API_KEY`)
- Replica browsing via setup endpoint (needs `TAVUS_API_KEY`)
- Knowledge base document registration (needs `TAVUS_API_KEY`)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TAVUS_API_KEY` | Yes | Tavus platform API key |
| `TAVUS_PERSONA_ID` | Yes | ID of the created persona |
| `TAVUS_REPLICA_ID` | Yes | ID of the selected replica |
| `PORT` | No | Server port (default: 3100) |
| `ALLOWED_ORIGIN` | No | CORS origin (default: http://localhost:3100) |
