# GO / NO-GO: Mission Control: Space Apps 2026 submission materials

Challenge: **Space Mission Design Game**. Fill in the team name, the public game URL and the video link before submitting.

---

## 1. Project description (short, ~60 words)

GO / NO-GO: Mission Control is a browser game where you design a real satellite mission. A customer asks for a job, such as finding wildfires or watching hurricanes. You choose the instrument, power, radio, orbit, rocket and ground stations, launch, and fly. The report checks every requirement, explains *why* the mission failed and which part to change.

## 2. Project description (long)

**What it does.** The player gets six missions from six customers, from a student club's first CubeSat to a city map on a tight budget. Each mission teaches one engineering trade-off:

1. A photo only counts when it reaches Earth (radio and ground stations).
2. Earth's shadow drains the battery, memory fills up, and low orbits fall (wildfires).
3. An orbit's tilt decides which latitudes it can see (polar ice).
4. Different jobs need different orbits: geostationary for nonstop weather watching.
5. Radiation crashes computers: safe mode or a radiation-hardened computer (space weather).
6. Everything at once: sharp images, huge files and a tight budget (city mapping).

**How it works.** All the numbers come from a small physics engine written in TypeScript. It computes the orbital period, the share of each orbit in Earth's shadow, passes over the chosen ground stations, orbit lifetime from air drag, and power, data, mass and cost budgets. The flight is an arcade game, but its rules come from the engine. If the battery runs flat in the game, the energy budget really doesn't close.

**Why it matters.** Mission design is about trade-offs, and failing is the best teacher. Every failed mission ends with a plain-language explanation and a button that jumps straight to the part to change. After a win, an "In real life" card shows the real NASA mission that does the same job: CubeSat Launch Initiative, FIRMS (MODIS/VIIRS), ICESat-2, GOES, Van Allen Probes, Landsat.

**Who it's for.** Ages 10 and up: one decision per row, big buttons, and it works on phones (portrait, touch).

**Tech.** React 19, TypeScript, Canvas 2D (3D version with three.js in progress). WebAudio for sound effects (synthesised, no audio files). Docker + Caddy for deployment. No accounts and no tracking. Progress is saved only in the browser.

## 3. NASA resources used

| Resource | Where in the game |
|---|---|
| [NASA Blue Marble](https://science.nasa.gov/earth/earth-observatory/collections/blue-marble) | Daytime Earth map under the satellite |
| [NASA Black Marble](https://www.earthdata.nasa.gov/data/projects/black-marble) | City lights in Earth's shadow |
| [NASA CubeSat 101](https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf) | Part sizes, masses and prices; rideshare launch; mission 1 |
| [NASA Small Spacecraft Systems Virtual Institute](https://www.nasa.gov/smallsat-institute/) | Typical small-satellite subsystems |
| NASA: Design and Develop Science Missions (challenge resource) | Mission 2: instrument, orbit and data link vs. customer needs |
| NASA Mission Design Lab (challenge resource) | Missions 3, 5, 6: inclination, radiation, trade studies |
| NASA Mission Viz (challenge resource) | Mission 4: geostationary vs. low orbit |
| [CubeSat Launch Initiative](https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/) · [FIRMS](https://www.earthdata.nasa.gov/data/tools/firms) · [ICESat-2](https://science.nasa.gov/mission/icesat-2/) · [GOES](https://science.nasa.gov/mission/goes) · [Van Allen Probes](https://science.nasa.gov/mission/van-allen-probes/) · [Landsat 9](https://science.nasa.gov/mission/landsat-9/) | "In real life" cards after each mission |

All facts on the cards were checked against these pages on 2026-11-14. The game uses no NASA logos and no photos of people.

## 4. Video script (about 50 seconds)

| Time | On screen | Voice-over / caption |
|---|---|---|
| 0–5 s | Mission map, six cards | "Can you design a satellite that actually works?" |
| 5–12 s | Wildfire brief: the Forest Fire Service asks for 10 fire photos over 3 years | "Every mission starts with a real customer and real requirements." |
| 12–20 s | Fly the cheap test satellite: battery runs flat in Earth's shadow, memory fills up | "Our first try fails, and the game shows why." |
| 20–27 s | Report: ❌ lines, "Battery ran flat in Earth's shadow", the "Change: Battery" button | "Every failure points to the part to fix." |
| 27–35 s | Build screen: pick heat camera, polar orbit, bigger battery; gauges turn green | "Each choice costs mass, power or money, just like at NASA." |
| 35–42 s | Launch countdown and lift-off (sound on), then a successful flight with photos sent to a station | "Launch, fly, and send the data home." |
| 42–48 s | ★★★ report with the "In real life: MODIS & VIIRS" card | "Then meet the real NASA mission that does the same job." |
| 48–52 s | Title + URL | "GO / NO-GO: Mission Control. Play it free in your browser." |

Recording tips: record at 1280×720 or on a phone in portrait, with sound on. Use `?all` to open all missions.

## 5. Testing checklist (after every merge)

Play all six missions on a laptop **and** a phone. For each mission check:

- [ ] the test or start satellite fails, and the report explains why;
- [ ] the sample solution (see `CLAUDE.md`) passes;
- [ ] the "In real life" card appears after a win, and its link opens;
- [ ] sounds play (countdown, lift-off, photo, station, hit, storm, win or lose) and 🔊 mutes them;
- [ ] phone: no horizontal scroll, the touch buttons work, the flight is smooth.

File each bug as a GitHub issue with steps, the expected and actual result, a screenshot, and the device and browser.
