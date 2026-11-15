# GO / NO-GO: Mission Control: Space Apps 2026 submission materials

Challenge: **Space Mission Design Game**. Fill in the team name, the public game URL and the demo (slides) link before submitting.

- Team: _(team name)_ - _(members)_
- Play: _(public URL)_
- Demo (slides): _(public link)_
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

The form has separate fields for NASA data and for the use of AI. For **Use of Artificial Intelligence**: "Claude (Anthropic) was used as a coding assistant. Game design, mission content, testing and all decisions are by the team. No AI-generated images or video are used."

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
```

## 4. Project demo: slide deck (7 slides)

Rules (Space Apps project submission guide): the demo is required, either a video of at most 30 seconds or a deck of **at most 7 slides including the title slide**; over the limit means no Global Judging. The deck must be in English, hosted outside the Space Apps site (Google Slides, Google Drive PDF, GitHub), and open without a password or sign-in. Screenshots for the slides (2880x1620, phone 1170x2532): `docs/screens/`; `launch-ascent.jpg` and `crew-build.jpg` are spares.

| # | Slide | Picture | Text (short) |
|---|---|---|---|
| 1 | **GO / NO-GO: Mission Control** - title | `launch-pad.jpg` (lift-off at dusk) | Design a real satellite mission. Launch it. Fly it. Team name, Space Apps 2026, Space Mission Design Game. |
| 2 | **The idea** | `home.jpg` | A customer needs a job done from orbit - find wildfires, watch hurricanes, map a city. You design the satellite, choose the orbit and the rocket, then fly the mission. Mission design is about trade-offs, and failing is the best teacher. |
| 3 | **How you play** | strip: `missions.jpg` → `build.jpg` → `launch-orbit.jpg` → `flight.jpg` | Brief → build (each part costs mass, power, money) → launch → fly over the Earth → report. Six missions, six trade-offs: data link, Earth's shadow and power, inclination, geostationary orbit, radiation, budget. |
| 4 | **Real physics, honest failures** | `report-fail.jpg` | A TypeScript engine computes orbital period, shadow share, ground-station passes, drag lifetime, power, data, mass and cost budgets. If the battery dies in the game, the energy budget really doesn't close. Every failure says why and which part to change. |
| 5 | **Crew mode: mission control for 2-4** | `crew-lobby.jpg` + `crew-lobby-phone.jpg` or `crew-poll-phone.jpg` | Flight director, engineer, scientist, communications. Each owns part of the design, everyone votes GO, then they fly together from their own devices. Built for classrooms. |
| 6 | **Built on NASA data** | `report-win.jpg` (the "In real life" card) | Blue Marble and Black Marble Earth; CubeSat 101 and NASA mission-design guides behind the rules; real hardware photos from the NASA Image Library; after each win, the real NASA mission that does the same job (FIRMS, ICESat-2, GOES, Van Allen Probes, Landsat 9). |
| 7 | **Play it** | QR code to the game | Game URL, GitHub link. Browser, phone or laptop, free, no account. Tech: React, TypeScript, three.js, socket.io. |

Tips: one idea per slide, big screenshots, little text (the long description is on the project page). Export as PDF too, in case the link host is down.

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
