# Voxaris Inbound Demo — Family Orlando Dentistry

Standalone HTML/CSS/JS demo simulating the V·TEAMS inbound call experience for Family Orlando Dentistry (Ocoee, FL).

## What This Demonstrates

The **V·TEAMS Inbound** flow: Receptionist → Qualifier → Specialist → Closer — a coordinated multi-agent system that answers, qualifies, routes, and books without making the patient repeat themselves.

### Scenario 1: Invisalign Lead Simulation
- New patient interested in Invisalign arrives
- Receptionist confirms free consultation offer and begins qualification
- Qualifier scores intent (crowding, timeline, prior ortho history)
- Specialist packages the consult request with context
- Closer captures afternoon preference and initiates booking

### Scenario 2: Emergency Call Simulation
- Patient with a cracked tooth and severe pain calls in
- Receptionist immediately detects urgency and triages
- Emergency Qualifier collects pain level, swelling, trauma status, onset
- Specialist packages full context for seamless handoff
- Closer routes to priority scheduling with safety guidance

## Features

- **Animated conversation playback** with typing indicators and timed message sequencing
- **Live V·TEAMS flow visualization** showing which agent is active, completed, or pending
- **Accumulated context strip** that reveals data points as they're collected — demonstrating no-repeat handoffs
- **Agent color coding** across chat bubbles and flow steps (Receptionist / Qualifier / Specialist / Closer / Emergency)
- **Premium dark aesthetic** consistent with Voxaris brand (Instrument Sans + DM Sans, gold accents, void backgrounds)
- **Fully responsive** — works on desktop, tablet, and mobile

## How to Use

1. Open `index.html` in any modern browser
2. Select **Invisalign Lead** or **Emergency Call**
3. Press **Play Demo** to watch the conversation unfold
4. Observe the flow panel highlighting each V·TEAMS stage
5. Watch context tags accumulate as patient data is captured

## Practice Info

- **Practice**: Orlando Family Dentistry / Nitisusanta Family Dentistry
- **Location**: 2704 Rew Circle, Suite 103, Ocoee, FL 34761
- **Doctors**: Dr. Nadine Nitisusanta DMD & Dr. Jonathan Nitisusanta DDS
- **Phone**: (407) 877-9003
- **Hours**: Mon, Tue, Thu, Fri 9am–5pm (Wed & weekends closed)
- **Website**: [familyorlandodentistry.com](https://familyorlandodentistry.com/)

## Files

```
inbound-demo/
├── index.html   ← Full standalone demo (no dependencies)
└── README.md    ← This file
```

## Tech

- Zero external dependencies (no build step, no frameworks)
- Google Fonts loaded for Instrument Sans + DM Sans
- Pure CSS animations and vanilla JavaScript
- Single-file architecture for easy sharing and deployment
