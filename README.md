# Swaraj Kumar — Portfolio

The personal portfolio of **Swaraj Kumar**, Senior UX Designer at redBus (MakeMyTrip group).

An immersive, scroll-driven WebGL experience (Three.js) that opens into a personal story and three in-depth UX case studies:

- **RPW Homepage Revamp** — a data-driven operator dashboard
- **revMax Self-Serve on redPro** — a self-serve fare engine
- **Marketplace Hygiene Dashboard** — a triage-first operator dashboard

## Stack

Hand-built static site — no framework, no build step.

- **Three.js** (via CDN import map) for the 3D world
- **Lenis** for smooth scrolling on case-study pages
- Vanilla HTML / CSS / JS, with a shared `enhance.js` / `enhance.css` interaction layer (custom cursor, magnetic UI, page transitions, light/dark theme)

## Run locally

Any static server works, e.g.:

```bash
npx serve .
# or
node server.js   # serves on http://localhost:4321
```

## Structure

```
index.html          # home — WebGL world + story + work grid
world.js            # the Three.js scene
enhance.css/.js     # shared polish layer (cursor, theme, transitions)
work/               # the three case-study pages
assets/             # case-study imagery
```

---

© Swaraj Kumar · swaraj.kumar0103@gmail.com
