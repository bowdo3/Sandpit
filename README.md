# Nexus — Interactive 3D Experience

An immersive, touch-responsive 3D particle visualization built with **Three.js**. Tap or click anywhere to send ripples through a living particle field — on phone, tablet, or laptop.

**[Launch the experience →](https://bowdo3.github.io/Sandpit/)**

## Features

- **Full-screen 3D particle system** — thousands of particles forming nebula, crystal, pulse, and storm shapes
- **Touch & mouse interaction** — clicks and taps create force impulses, shockwaves, and screen ripples
- **Multi-touch support** — each finger generates independent reactions on touchscreen devices
- **Orbit controls** — drag to rotate the scene, scroll or pinch to zoom
- **Four visual modes** — switch between Nebula, Crystal, Pulse, and Storm presets
- **Live energy meter** — interactions build energy that intensifies the glow and motion
- **Responsive UI** — glassmorphism HUD adapts to desktop and mobile

## Quick Start

No build step required. Open locally with any static server:

```bash
cd docs
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

Or simply open `docs/index.html` via a local server (required for ES module imports).

## Tech Stack

- [Three.js](https://threejs.org/) — WebGL 3D rendering
- Vanilla HTML / CSS / JavaScript — no framework overhead
- GitHub Pages — zero-config deployment from `/docs`

## Project Structure

```
docs/
├── index.html   # Page shell, UI overlay, import map
├── styles.css   # HUD, controls, screen ripples
└── script.js    # Three.js scene, physics, interaction
```

## How Interaction Works

1. Pointer events (mouse or touch) are converted to normalized device coordinates
2. A ray is cast from the camera through the pointer into the 3D scene
3. Force impulses push nearby particles outward from the hit point
4. Expanding ring shockwaves and 2D screen ripples provide visual feedback
5. Particles spring back to their base positions with damped physics

## Deployment

This repo is configured for **GitHub Pages** serving from the `/docs` folder. Push to `main` and Pages will publish automatically.

## License

MIT
