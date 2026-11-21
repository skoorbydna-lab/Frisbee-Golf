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
- **Driving range:** unlimited throws at six target baskets (15–130 m) with distance lines, adjustable wind, and a breakdown of every flick (speed, length, launch angle, aim, carry, roll, drift) plus a tip.
- **Practice round.**

## The course (18 holes, par 66)
Pick **Front 9**, **Back 9**, **All 18** or **Quick 3** (open, canyon, island or mixed) for any mode.

| | Front 9 (par 32) | Back 9 (par 34) |
|---|---|---|
| Open / hilly | 1 Meadow Rise · 2 Mill Pond · 3 Rolling Downs | 10 Hilltop Drop · 11 Darkwood · 12 Windy Ridge |
| Canyon | 4 Stone Gorge · 5 Canyon Run · 6 Red Rock Switchback | 13 The Narrows · 14 Snake Canyon · 15 Mesa Leap |
| Island | 7 Island Green · 8 Stepping Stones · 9 Archipelago | 16 Lagoon Hop · 17 Coral Chain · 18 Lighthouse Finale |

## Files
- `index.html` – the whole game in one file (this is what GitHub Pages serves).
- `src/core.js` – courses, terrain, physics, CPU scoring (plain JS, testable in Node).
- `src/game.html` – graphics, controls, menus, multiplayer.
- `build.py` – rebuilds `index.html` from `src/`.
- `tests/` – Node tests: a bot plays every hole (`holes_bot.js`), round types (`rounds_test.js`), the range, and a two-phone online game with refreshes (`online_test.js`).
