# Frisbee Golf 🥏

A first-person 3D disc golf game for phones, built with three.js.

**Play:** https://skoorbydna-lab.github.io/Frisbee-Golf/

## How to play
- **Touch the disc** and it sticks to your finger. Slide **right** for hyzer (curves left), **left** for anhyzer (curves right), centre for flat.
- **Flick up** to throw. Faster and longer flicks go further; where the flick ends sets the height and direction.
- **Drag** anywhere else to look around. **Two fingers** (or 🔭 Scout) fly the camera round the course.
- Discs skip, roll on their edge and wobble to a stop depending on how they land.

## Modes
- **Tournaments:** Village Open → County Classic → National Championship against 7 CPU players.
- **Pass & play:** 2–4 players on one phone; furthest from the basket throws next.
- **Online play:** 2–4 players on their own phones. One person hosts and shares a 4-letter code; everyone else joins with it. Messages go through a free public MQTT relay (EMQX, with HiveMQ as backup), so it works on mobile data and Wi-Fi with nothing to set up. Hosts can send an invite link straight to WhatsApp.
- **Practice round.**

## The course (9 holes, par 31)
Meadow Rise · Mill Pond · Stone Gorge · Rolling Downs · Darkwood · Island Green · Hilltop Drop · Canyon Run · Archipelago

## Files
- `index.html` – the whole game in one file (this is what GitHub Pages serves).
- `src/core.js` – courses, terrain, physics, CPU scoring (plain JS, testable in Node).
- `src/game.html` – graphics, controls, menus, multiplayer.
- `build.py` – rebuilds `index.html` from `src/`.
