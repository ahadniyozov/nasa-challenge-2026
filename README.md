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

The game is static files served by Caddy with automatic HTTPS. Point a DNS A record at the server, then:

```bash
./deploy/deploy.sh mission.your-domain   # first run: saves the domain, builds, starts
./deploy/deploy.sh                       # update: git pull + rebuild
```

Full guide (server setup, DNS, HTTPS checks, cache headers): [deploy/README.md](deploy/README.md).

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

## Для команды

- **Движок** (`packages/engine`): формулы, баланс, сценарии, тесты. Любую цифру в игре меняем в `catalog.ts`.
- **Игра** (`apps/web/src/game2d`): миссии, сборка, правила полёта (`sim.ts`), отчёт.
- **3D** (`apps/web/src/game3d`): 3D-полёт над глобусом, звук.
- **Сервер и деплой** (`apps/server`, `deploy`).

Правило: игровая логика живёт только в `engine`, а клиент и сервер её только вызывают.

**Русский язык — временный.** Весь перевод лежит в `apps/web/src/i18n/`, переключатель RU/EN — справа в верхней панели. Новые строки в UI оборачивайте в `t('English text')` и добавляйте перевод в `ru-*.ts`. Перед сабмитом: удалить `ru*.ts` и `i18n/LangToggle.tsx`, а в `i18n/index.ts` оставить только английскую ветку.
