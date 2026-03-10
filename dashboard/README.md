# Voxaris Command — Client Dashboard Demo

**Client:** Family Orlando Dentistry (Orlando Family Dentistry / Nitisusanta Family Dentistry)
**Location:** 2704 Rew Circle, Suite 103, Ocoee, FL 34761

## What This Is

Illustrative Voxaris client portal mockup for the sales demo. All figures are example projections for presentation purposes — not live data.

## How to Use

Open `index.html` in any modern browser. No build step required.

### Editing Numbers

Every data point in the dashboard is driven by a single `CONFIG` object at the top of the `<script>` block in `index.html`. Change any value there and the entire dashboard updates:

```js
const CONFIG = {
  projectedRevenue90Day: 59550,
  afterHoursCaptured: 128,
  callsAnswered: 287,
  // ... all numbers editable here
};
```

## Sections

| Section | Description |
|---------|-------------|
| **Hero** | 90-day projected snapshot with production influenced total |
| **KPI Cards** | Calls answered, appointments booked, revenue lift, missed-call recovery |
| **Weekly Conversion Mix** | Line chart tracking calls answered vs appointments booked (4 weeks) |
| **Inbound Source Breakdown** | Bar chart by channel (after-hours, website, emergency, reactivation) |
| **Service-Line Pipeline** | Table with leads → qualified → booked and conversion bars |
| **Pipeline by Service Line** | Donut chart of booked distribution |
| **Reactivation Funnel** | Horizontal bar showing contacted → responsive → booked |
| **ROI Estimator** | Interactive sliders for missed calls, recovery rate, appointment value, dormant patients, reactivation rate |

## Tech Stack

- Plain HTML/CSS/JS (no build tools)
- Chart.js 4.x via CDN
- Instrument Sans + DM Sans via Google Fonts
- Fully responsive (desktop, tablet, mobile)

## Brand

- Dark luxury aesthetic with Voxaris brand colors
- Gold (#d4a843) as primary accent
- Void (#07080a) background
- Emerald, blue, purple, amber secondary palette
