# GO / NO-GO: Mission Control: Space Apps 2026 submission materials

Challenge: **Space Mission Design Game**. Fill in the team name, the public game URL and the video link before submitting.

- Team: _(team name)_ - _(members)_
- Play: _(public URL)_
- Video: _(link)_
- Code: https://github.com/ahadniyozov/nasa-challenge-2026

---

## 1. Project description (short, ~60 words)

GO / NO-GO: Mission Control is a browser game where you design a real satellite mission, alone or as a crew of up to four. A customer asks for a job, such as finding wildfires or watching hurricanes. You choose the instrument, power, radio, orbit, rocket and ground stations, launch, and fly over a real NASA Earth. The report explains *why* a mission failed and which part to change.

## 2. Project description (long)

**What it does.** The player gets six missions from six customers, from a student club's first CubeSat to a city map on a tight budget. Each mission teaches one engineering trade-off:

1. A photo only counts when it reaches Earth (radio and ground stations).
2. Earth's shadow drains the battery, memory fills up, and low orbits fall (wildfires).
3. An orbit's tilt decides which latitudes it can see (polar ice).
4. Different jobs need different orbits: geostationary for nonstop weather watching.
5. Radiation crashes computers: safe mode or a radiation-hardened computer (space weather).
6. Everything at once: sharp images, huge files and a tight budget (city mapping).

**Crew mode: mission control for 2-4 players.** Real missions are designed by teams, so the game can be too. One player creates a crew and gets a short code; the others join from their own phones or laptops. Each takes a role - flight director, engineer (power and structure), scientist (instrument and orbit), communications (radio and ground stations) - and owns those parts of the design. Nothing launches until every role votes GO. In flight the director steers, while the others watch their own consoles (power, memory, radiation, the radar) and call out warnings or switch on safe mode. The report shows which role's choice decided the outcome.

**How it works.** All the numbers come from a small physics engine written in TypeScript. It computes the orbital period, the share of each orbit in Earth's shadow, passes over the chosen ground stations, orbit lifetime from air drag, and power, data, mass and cost budgets. The flight is an arcade game, but its rules come from the engine: if the battery runs flat in the game, the energy budget really doesn't close. The satellite you build is drawn part by part in 3D, the launch is filmed like a launch broadcast with a realistic flight profile (clock, altitude, speed, staging, fairing and spacecraft separation), and the flight happens over NASA's Blue Marble by day and Black Marble city lights by night.

**Why it matters.** Mission design is about trade-offs, and failing is the best teacher. Every failed mission ends with a plain-language explanation and a button that jumps straight to the part to change. After a win, an "In real life" card shows the real NASA mission that does the same job: CubeSat Launch Initiative, FIRMS (MODIS/VIIRS), ICESat-2, GOES, Van Allen Probes, Landsat. Crew mode adds the other half of real mission design: agreeing on one design and talking during operations.

**Who it's for.** Ages 10 and up, classrooms and clubs: one decision per row, big buttons, works on phones (portrait, touch), and a whole class can play in crews of four.

**Tech.** React 19 and TypeScript; three.js (react-three-fiber) for the 3D satellite, launch and flight, with a Canvas 2D fallback for weak devices; socket.io for crew mode; WebAudio for synthesised sound effects (no audio files). Served by Caddy, with a small Node server for crews. No accounts and no tracking: progress is saved only in the browser.

## 3. NASA resources used

| Resource | Where in the game |
|---|---|
| [NASA Blue Marble](https://science.nasa.gov/earth/earth-observatory/collections/blue-marble) | Daytime Earth map under the satellite |
| [NASA Black Marble](https://www.earthdata.nasa.gov/data/projects/black-marble) | City lights in Earth's shadow |
| [NASA Image and Video Library](https://images.nasa.gov/) | Photos of real hardware next to each part on the build screen (credits on the "NASA data & credits" page) |
| [NASA CubeSat 101](https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf) | Part sizes, masses and prices; rideshare launch; mission 1 |
| [NASA Small Spacecraft Systems Virtual Institute](https://www.nasa.gov/smallsat-institute/) | Typical small-satellite subsystems |
| [NASA: Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf) | Mission 2: instrument, orbit and data link vs. customer needs |
| [NASA Goddard Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/) | Missions 3, 5, 6: inclination, radiation, trade studies |
| [NASA Mission Viz](https://nasa.github.io/mission-viz/) | Mission 4: geostationary vs. low orbit |
| [CubeSat Launch Initiative](https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/) · [FIRMS](https://www.earthdata.nasa.gov/data/tools/firms) · [ICESat-2](https://science.nasa.gov/mission/icesat-2/) · [GOES](https://science.nasa.gov/mission/goes) · [Van Allen Probes](https://science.nasa.gov/mission/van-allen-probes/) · [Landsat 9](https://science.nasa.gov/mission/landsat-9/) | "In real life" cards after each mission |

All facts on the cards were checked against these pages on 2026-11-14. The game uses no NASA logos and no photos of people.

### References field (copy into the submission form as is)

The rules ask for every external resource, even free and open source ones.

```
NASA data and imagery
- NASA Blue Marble (Earth Observatory) - https://science.nasa.gov/earth/earth-observatory/collections/blue-marble
- NASA Black Marble - https://www.earthdata.nasa.gov/data/projects/black-marble
- NASA Image and Video Library (hardware photos: jsc2020e012430, 04pd2541, PIA25136, PIA22339, PIA22457, GSFC_20171208_Archive_e001330, PIA12024, iss061e051961, GSFC_20171208_Archive_e001784, PIA13580, s66-09379, KSC-20230507-PH-RLS01_0006, KSC-20210927-PH-KLS01_0075, KSC-20220411-PH-JBS01_0004) - https://images.nasa.gov/

NASA guides behind the game rules
- NASA CubeSat 101 - https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf
- NASA Small Spacecraft Systems Virtual Institute - https://www.nasa.gov/smallsat-institute/
- NASA: Design and Develop Science Missions - https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf
- NASA Goddard Mission Design Lab - https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/
- NASA Mission Viz - https://nasa.github.io/mission-viz/

Real missions in the "In real life" cards
- CubeSat Launch Initiative - https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/
- FIRMS (MODIS & VIIRS) - https://www.earthdata.nasa.gov/data/tools/firms
- ICESat-2 - https://science.nasa.gov/mission/icesat-2/
- GOES - https://science.nasa.gov/mission/goes
- Van Allen Probes - https://science.nasa.gov/mission/van-allen-probes/
- Landsat 9 - https://science.nasa.gov/mission/landsat-9/

Other resources
- Earth textures (day, night, clouds, ocean mask; based on NASA imagery) by Solar System Scope, CC BY 4.0 - https://www.solarsystemscope.com/textures/
- Open-source software: React, three.js, @react-three/fiber, @react-three/drei, zustand, socket.io, Vite, Vitest, TypeScript, tsx (all MIT or Apache-2.0)
- Fonts: Barlow and Barlow Condensed via Google Fonts (SIL Open Font License)
- AI assistance: Claude (Anthropic) was used as a coding assistant; all design decisions and testing by the team.
```

## 4. Video script (about 60 seconds)

| Time | On screen | Voice-over / caption |
|---|---|---|
| 0-5 s | Home screen: "Solo missions" and "Crew mission" | "Can you design a satellite that actually works?" |
| 5-11 s | Mission map with the globe; open "Hurricane watch" or "Wildfires", read the brief | "Every mission starts with a real customer and real requirements." |
| 11-20 s | Build screen: pick camera, panels, orbit, rocket; the 3D satellite changes, gauges turn green or red | "Each choice costs mass, power or money, just like at NASA." |
| 20-28 s | 3D launch: countdown, lift-off from the pad, staging, fairing, spacecraft separation | "Launch it..." |
| 28-36 s | 3D flight over the Earth: change lanes, photograph targets, night side with city lights, downlink to a station | "...fly it over NASA's Blue Marble and send the data home." |
| 36-42 s | A failed report: "Battery ran flat in Earth's shadow", the "Change: Battery" button | "When it fails, the game tells you why and what to change." |
| 42-52 s | Crew mode: two or three screens side by side - lobby with a code, roles, everyone votes GO; in flight a console calls a warning | "Or play as a crew: four roles, one satellite, nothing flies until everyone says GO." |
| 52-57 s | ★★★ report with the "In real life" card | "Then meet the real NASA mission that does the same job." |
| 57-60 s | Title + URL | "GO / NO-GO: Mission Control. Free in your browser." |

Recording tips: 1920x1080 (or 1280x720), sound on, `?all` to open all missions. For crew mode, open two browser windows side by side, or record a phone and a laptop together.

## 5. Testing checklist (after every merge)

Play all six missions on a laptop **and** a phone. For each mission check:

- [ ] the test or start satellite fails, and the report explains why;
- [ ] the sample solution (see `CLAUDE.md`) passes;
- [ ] the "In real life" card appears after a win, and its link opens;
- [ ] the 3D launch plays to the end and the flight starts; `?2d` still works;
- [ ] sounds play (countdown, lift-off, photo, station, hit, storm, win or lose) and the sound button mutes them;
- [ ] phone: no horizontal scroll, the touch buttons work, the flight is smooth.

Crew mode (two devices on the deployed site):

- [ ] create a crew, join with the code from a second device, pick roles and a mission;
- [ ] every role edits only its own parts; the launch waits for everyone's GO;
- [ ] in flight the consoles update, safe mode and callouts reach the director;
- [ ] a reload rejoins the same seat.

File each bug as a GitHub issue with steps, the expected and actual result, a screenshot, and the device and browser.
