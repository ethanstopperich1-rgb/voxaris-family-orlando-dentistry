# Family Orlando Dentistry x Voxaris — Landing Page

Custom single-page pitch microsite built for the Family Orlando Dentistry sales demo.

## Quick Start

This is a static HTML page using Tailwind CSS via CDN. No build step required.

### Option 1: Open directly
```bash
open index.html
```
Or double-click `index.html` in Finder.

### Option 2: Local server (recommended for video assets)
```bash
# Python
python3 -m http.server 8080 --directory .

# Node (if npx available)
npx serve .
```
Then open `http://localhost:8080` in your browser.

## File Structure

```
landing-page/
├── index.html          # Complete single-page site
├── assets/             # Avatar video/poster assets go here
│   └── (empty)         # See asset swap notes below
└── README.md           # This file
```

## Asset Placeholders

The following assets need to be swapped in once generated:

| File | Purpose | Specs |
|------|---------|-------|
| `assets/family-orlando-vface-demo.mp4` | V·FACE avatar video loop | 16:9, 1080p min, H.264 MP4 |
| `assets/family-orlando-vface-poster.jpg` | Video poster/thumbnail | Same aspect ratio as video |

Until these assets are placed, a gradient fallback with a play button placeholder will display.

### How to swap assets
1. Generate the avatar video using the prompt in **Section D** of the build spec
2. Place the files in `./assets/` with the exact filenames above
3. The video element and fallback logic will handle the rest automatically

## Sections Included

1. **Header** — Sticky nav with desktop + mobile menu, Book Demo CTA
2. **Hero** — Practice-specific headline, value props, V·FACE preview card
3. **Social Proof Bar** — Key dental industry stats
4. **Why This Practice** — Three pain-point cards (phone-only, high-value, limited hours)
5. **Voxaris Stack** — V·TEAMS, V·OUTBOUND, V·FACE solution cards
6. **V·FACE Hero** — Full-width dark section with avatar video embed + stats
7. **How V·TEAMS Works** — 4-step flow diagram
8. **ROI Calculator** — 5 interactive sliders with real-time output
9. **Service-Line Pipeline** — 5 service cards with progress bars
10. **Demo Highlights** — Feature checklist + sample conversation
11. **Emotional Close** — Family-practice benefits (4 cards)
12. **CTA** — Book demo + practice phone number
13. **Footer** — Branding + address

## Tech Stack

- **Tailwind CSS** (CDN) — utility-first styling
- **Inter font** (Google Fonts) — typography
- **Vanilla JS** — ROI calculator, scroll reveals, mobile menu, video fallback
- No frameworks, no build tools, no dependencies

## Browser Support

Tested for modern browsers (Chrome, Safari, Firefox, Edge). Uses:
- CSS backdrop-filter (glassmorphism)
- IntersectionObserver (scroll reveals)
- CSS custom properties
- Smooth scroll behavior
