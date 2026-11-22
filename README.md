# Frisbee Golf 🥏

A first-person 3D disc golf game for phones, built with three.js.

**Play:** https://skoorbydna-lab.github.io/Frisbee-Golf/

## How to play
- **Touch the disc** and it sticks to your finger. Slide **right** for hyzer (curves left), **left** for anhyzer (curves right), centre for flat.
- **Flick up** to throw. Faster and longer flicks go further; where the flick ends sets the height and direction.
- **Drag** anywhere else to look around. **Two fingers** (or 🔭 Scout) fly the camera round the course.
- Discs skip, roll on their edge and wobble to a stop depending on how they land.

## Golf ⛳
Switch the sport at the top of the menu. Every course, round length and mode works for golf too.
- **Clubs:** Driver (~160 m), 5 Iron (~140), 9 Iron (~110), Wedge (~65), Putter — picked automatically by distance, tap to change.
- **Swipe swing:** touch below the ball, pull down for the backswing, then swipe up through the ball. Backswing length + tempo = power; swiping up-and-right slices, up-and-left hooks.
- **Motion swing (optional):** turn on 📱 Motion swing, tap below the ball, then swing the phone. Peak swing speed sets power; wrist roll in the downswing opens/closes the face. *Gentle* mode scales small wrist swings up. Needs the GitHub Pages version (motion sensors are blocked inside Claude); iPhones ask for permission once. Hold on tight — a wrist strap is best.
- **Your golfer:** a golfer stands at the ball and swings with you (shoulder turn, wrist hinge, follow-through). Clubs are modelled at their real lie angles and lengths (driver 56°, irons ~61–64°, putter 71°). Tap **🧑 Your golfer** on the menu to change name, skin, hair, cap, top, trousers, height and build; online, everyone sees each other's golfers.
- The ball bounces and rolls differently on greens, fairway, rough and sand, backspin checks it up on short grass, and putts can lip out.

## Modes
- **Tournaments:** Village Open → County Classic → National Championship against 7 CPU players.
- **Pass & play:** 2–4 players on one phone; furthest from the basket throws next.
- **Online play:** 2–4 players on their own phones. One person hosts and shares a 4-letter code; everyone else joins with it. Messages go through a free public MQTT relay (EMQX, with HiveMQ as backup), so it works on mobile data and Wi-Fi with nothing to set up. Hosts can send an invite link straight to WhatsApp.
- **Driving range:** unlimited throws at six target baskets (15–130 m) with distance lines, adjustable wind, and a breakdown of every flick (speed, length, launch angle, aim, carry, roll, drift) plus a tip.
- **Practice round.**

## Courses (54 holes)
Pick a course, then **Front 9**, **Back 9**, **All 18** or **Quick 3**, in any mode.

- **Classic** (par 66) – the original mix of open, canyon and island holes.
- **Meadowlands** (par 66) – 18 open, hilly holes with ponds, streams and woods.
- **Red Rock** (par 69) – 18 canyon holes: switchbacks, narrows and gorges to clear.
- **Coral Isles** (par 69) – 18 island holes, from single hops to five-island par 5s.
- **Shuffle** – a random, balanced 18 (six of each type) drawn from all 54 holes.

Each themed course weaves the six hand-built holes of its type in with twelve generated ones. The generated holes come from fixed seeds, so they're identical every time; `tests/gen_search.js` picked those seeds by having a bot play candidates and keeping only sane, finishable layouts.

## Files
- `index.html` – the whole game in one file (this is what GitHub Pages serves).
- `src/core.js` – courses, terrain, physics, CPU scoring (plain JS, testable in Node).
- `src/game.html` – graphics, controls, menus, multiplayer.
- `build.py` – rebuilds `index.html` from `src/`.
- `tests/` – Node tests (golf: `golf_test.js`, `motion_test.js`, `editor_test.js`): a bot plays every hole (`holes_bot.js`), round types (`rounds_test.js`), the range, and a two-phone online game with refreshes (`online_test.js`).
