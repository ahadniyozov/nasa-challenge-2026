# Phone check: 2026-11-14

Build: `main` @ fd5d857 (after PR #2) + links in `dev3/resource-links`.
Method: Microsoft Edge with phone emulation (Playwright: `isMobile`, `hasTouch`), portrait. A bot flew each mission with the sample solution from `solutions.ts` and safe mode on.
This is **not** a real phone: Ahad will check on real devices.

## Results

| Screen | iPhone 13 (390×844) | Small phone (360×640) |
|---|---|---|
| Mission map, brief, build, NASA Resources | no horizontal scroll | no horizontal scroll |
| Flight, all 6 missions | 60 fps, no horizontal scroll | 60 fps, no horizontal scroll |
| Report, all 6 missions | ★★★ on 6/6 + "In real life" card | ★★★ on 5/6, ★★ on space weather (bot run) + card on 6/6 |
| Console errors | none | none |

## Bugs found (draft issues)

### 1. "Worked for all 1 years": wrong plural in the report
- **Steps:** finish mission 1 (1 year) → report.
- **Expected:** "Worked for the whole year" / RU «Проработал весь год».
- **Actual:** "Worked for all 1 years". RU is also wrong for 5 years: «Проработал все 5 года» (should be «лет»).
- **Where:** `Game2D.tsx` `requirements()`, key `'Worked for all {n} years'`; RU in `i18n/ru-2d.ts`.

### 2. The flight tip on a phone explains the keyboard
- **Steps:** on a phone, start any flight.
- **Expected:** "Tap the left or right side to change lane. Tap 🛡️ for safe mode."
- **Actual:** "← → to change lane… SPACE = safe mode". A phone has no arrow keys or space bar, and the ◀ ▶ tap zones are almost invisible (`color: #ffffff22`).
- **Where:** `FlightHud.tsx` tips; `game2d.css` `.g2d-touch`. Suggest choosing the tip by `matchMedia('(hover: none)')`.

### 3. The flight tip covers the orbit bar for the first 5 seconds
- **Steps:** phone 390×844, start a flight.
- **Actual:** the tip box covers the "Orbit 1 of 4" strip, which shows Earth's shadow, right when the player should look at it.
- **Suggestion:** move the tip lower (above the satellite) on narrow screens.

### 4. The top bar takes two rows on a phone and stays visible in flight
- **Steps:** phone 390×844, open the mission map or start a flight.
- **Actual:** the links (Resources, 🔊, EN/RU, 3D runner, Engineer mode) wrap onto 2 rows (~100 px), and during the flight "3D runner" / "Engineer mode" can leave the mission by accident.
- **Suggestion:** during the flight show only 🔊. On phones, hide the old-mode links in a menu.

### 5. A lesson suggests a part that cannot be chosen on mission 1
- **Steps:** mission 1, fly the test satellite and hit the night side.
- **Actual:** "A normal camera needs sunlight - heat cameras and radiometers see at night", but mission 1 has only the simple camera and no button to change it. It may confuse a 10-year-old.
- **Suggestion:** for locked slots, word it as advice for later ("on later missions you can pick a heat camera").
