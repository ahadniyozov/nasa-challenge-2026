# GO / NO-GO: Mission Control

**NASA Space Apps Challenge 2026 — Space Mission Design Game**

Design, launch and operate a space mission as a team. Every choice costs mass, power, money, data or time,
and when a mission fails, the game explains *why*.

## Two ways to play

- **Simple mode** (default, ages 10+): one question per screen with 3 big choices, five smiley meters (weight, energy, money, photos home, lifetime), a crew of four advisors who explain every problem in plain words and jump you to the step that fixes it. The flight is a mini-game: tap targets inside the camera's green circle, photos fly home only over ground stations, the battery drains in Earth's shadow, and real engine events (solar storms, failures, debris) interrupt you. 1-3 stars per mission.
- **Engineer mode** (`🔧` in the top bar, or `?expert`): the full mission-design console described below.

Both modes use the same engine. Simple-mode choices map to real catalog components, and a test checks that the crew's "must fix" advice matches the engine's launch errors for every combination.

## Game loop (engineer mode)

1. **Brief**: pick a customer scenario (first CubeSat, wildfire watch, sandbox).
2. **Design**: four roles split the decisions:
   - **Flight Director**: bus, launcher, cash reserve
   - **Spacecraft Engineer**: power, battery, computer, attitude control, propulsion
   - **Science Lead**: instruments
   - **Ops & Comms**: orbit, radio band, ground stations

   Live budgets, a design review that explains each error, and a 400-run Monte Carlo risk analysis support the decisions.
3. **Go / No-Go poll**: every role must vote GO before launch.
4. **Launch**: 3D launch sequence. Rockets can fail.
5. **Operations**: the mission runs at accelerated time over a 3D Earth, showing Earth's shadow, ground-station contacts, solar storms, debris and failures.
6. **Report**: grade, score breakdown, "why it went this way", and a share link.

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
  src/kid/          simple mode: steps, crew advice, flight mini-game
  src/scenes/       Hangar, Orbit and Launch 3D scenes
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

Two URL tricks help with demos:

- `?seed=5` makes the mission's random events reproducible.
- A `#d=...` link (made with the "Share design" button) opens a saved design.

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

## Для команды

- **Движок** (`packages/engine`): формулы, баланс, сценарии, тесты. Любую цифру в игре меняем в `catalog.ts`.
- **Простой режим** (`apps/web/src/kid`): шаги, советы команды, мини-игра полёта — главный экран игры.
- **UI инженера** (`apps/web/src/ui`): панели, проверка, отчёт.
- **3D** (`apps/web/src/scenes`): ангар, орбита, запуск.
- **Сервер и деплой** (`apps/server`, `deploy`).

Правило: игровая логика живёт только в `engine`, а клиент и сервер её только вызывают.

**Русский язык — временный.** Весь перевод лежит в `apps/web/src/i18n/`, переключатель RU/EN — справа в верхней панели. Новые строки в UI оборачивайте в `t('English text')` и добавляйте перевод в `ru.ts`. Перед сабмитом: удалить `ru.ts`, `ru-kid.ts` и `LangToggle` в `App.tsx`, а в `i18n/index.ts` оставить только английскую ветку.
