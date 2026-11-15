# GO / NO-GO: Mission Control

**NASA Space Apps Challenge 2026 — Space Mission Design Game**

Design, launch and operate a space mission as a team. Every choice costs mass, power, money, data or time,
and when a mission fails, the game explains *why*.

## The game

A customer orders a mission (find wildfires, watch polar ice, track hurricanes...). You build a satellite from parts, choose its orbit, rocket and ground stations, launch it and fly it over a 3D Earth: change lanes to fly over targets, dodge space junk, survive Earth's shadow and solar storms, and pass over ground stations to send the data home. Every number in the flight comes from the engine's budgets for your design. At the end the report checks each requirement and explains which part to change. Six missions from easy to hard; `?2d` plays the flight in 2D.

## Repository layout

```
packages/engine   Pure TypeScript mission model, shared by client and server
  src/physics.ts    orbital period, eclipse, ground-station passes, drag lifetime
  src/catalog.ts    orbits, launchers, buses, components, stations, scenarios
  src/budgets.ts    design -> mass / power / data / cost / lifetime / science budgets
  src/validate.ts   design review: errors and warnings with explanations
  src/simulate.ts   seeded month-by-month operations + Monte Carlo
  src/score.ts      score, grade, lessons learned
apps/web          React + react-three-fiber client
  src/game2d/       the game: missions, satellite builder, flight rules (sim.ts), 2D flight, report
  src/game3d/       3D flight over the globe, sound
  src/content/      "In real life" cards and the NASA Resources screen
apps/server       Socket.io rooms for up to 4 players + authoritative leaderboard
deploy            Dockerfile, docker-compose, Caddy (automatic HTTPS)
```

## Run locally

Requires Node 22 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # engine unit tests
npm run dev:server   # optional: multiplayer server on :8787
```

Two URL options help with demos:

- `?all` opens every mission.
- `?2d` uses the 2D flight instead of the 3D one.

## Deploy (VPS + domain)

```bash
cd deploy
cp .env.example .env        # set DOMAIN=mission.your-domain
docker compose up -d --build
```

1. Point an A record for the subdomain at the server first.
2. If ports 80/443 are already used by another service, remove `ports` from `web` and route to it from your existing reverse proxy.

## Model notes

These are simplified, educational models, not engineering tools:

- Circular orbits: period `T = 2π√(a³/μ)`; worst-case eclipse fraction `asin(R/(R+h))/π`.
- Ground contact: visibility circle above 10° elevation, with passes estimated from ground-track spacing. This is why polar stations see polar orbits on almost every revolution.
- Power: orbit-average solar generation with 2.5%/yr degradation. Batteries may be discharged only ~30% in LEO (cycle life).
- Data: generated (rate × duty cycle) vs downlinked (link rate × contact time).
- Cost: hardware + 30% integration & test + launch + ground stations + operations + reserve.
- Lifetime: atmospheric drag table (log-interpolated) extended by propulsion Δv.
- Component values are order-of-magnitude, inspired by NASA *CubeSat 101* and *Design and Develop Science Missions*.

Earth textures are NASA Blue Marble / Black Marble (public domain).

## Roadmap

- [ ] Online rooms in the client (server is ready: `room:create`, `room:join`, `design:update`, `poll:vote`)
- [ ] Interactive event cards during operations (spend reserve / switch off instruments)
- [ ] Lunar scenario (Earth–Moon scene, Δv budget, deep-space link)
- [ ] Leaderboard UI, versus mode
- [ ] Tutorial overlay, sound, mobile layout polish

---

## For the team

- **Engine** (`packages/engine`): formulas, balance, scenarios, tests. Every number in the game lives in `catalog.ts`.
- **Game** (`apps/web/src/game2d`): missions, the build screen, flight rules (`sim.ts`), the report.
- **3D** (`apps/web/src/game3d`): launch, 3D flight over the globe, sound.
- **Crew mode** (`apps/web/src/crew`, `apps/server`): multiplayer mission control over socket.io.
- **Server and deploy** (`apps/server`, `deploy`).

Rule: game logic lives only in `engine`; the client and the server only call it.

UI text is English only. Write new strings as `t('English text')` (see `apps/web/src/i18n/index.ts`), so a translation can be added later in one place.
