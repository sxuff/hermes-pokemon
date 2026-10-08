# Verification

## 0.7.0 (2026-10-08)

Four features and one engineering change, all local and read-only.
- **Other chats:** the bridge emits a separate `elsewhere` signal for a successful `message.complete` from a non-focused session. Unit tests cover: focused state untouched, errors/stops/replays/unknown sessions ignored, the focused session's own finish still cheers. The companion's glance turns toward the session list with a "!", holds a 30-second cooldown, never interrupts fetch, shows only the bubble in extra quiet mode, and returns to keeping company afterwards.
- **Milestone rewards:** `rewardsFor` derives bench/lantern/bunting from the saved milestone list (a quietly recorded day 30 still earns its bench); the companion's visits keep it on walkable ground and seated in front of the item; the renderer draws everything behind the walkable grass and lights the lantern only after dark. Browser: **Simulate day 100** records `[30, 100]`, lists "A garden bench · A paper lantern" in Settings, and reaches `lanternlit` with the pinned night sky (`docs/images/rewards-night.png`).
- **Day length and moon:** `phaseForHour(hour, season)` keeps the previous hours as the default and moves dawn/dusk by season; every season walks dawn → day → dusk → night in order. `moonPhase` reproduces the 2000-01-06 reference new moon and the 2000-01-21 full moon within a day; a pixel test checks new (no disk), full (whole disk), first quarter (right half), last quarter (left half), the Southern mirror, and a dark pond at new moon.
- **Keyboard access:** `keyboardAction` is unit-tested for arrows, wrap-around, Home/End, Enter/Space, Escape and unknown keys; every target lands where a click would. Browser: focusing the canvas, Home announces "Your companion", ArrowRight announces "The old tree", Enter reaches `investigating`, Escape clears the announcement (`docs/images/keyboard-focus.png`).
- `npm test`: **198 passed, 0 failed** (189 + 9 new). `npm run check:browser`: all 7 scripts pass in headless Chromium 1.64.0 (smoke 2.8 s, growth 42 s, xp 67 s, play 49 s, lifecycle 8.5 s, rhythm 41 s, world 47 s), no page errors. The same command now runs in CI on every push.
- Noted while starting: one `npm test` run on main failed two runtime tests with "The bundled sprites could not be loaded" and then passed on every rerun; not reproduced since.

## 0.6.2 (2026-10-06)

Native user report: a line above the fence and across the tree, and three odd bars on the pond, at night.
- **Line:** the dawn/dusk/night sky deepening was a flat band over rows 0 to 21 drawn after the tree, so its bottom edge cut straight across the canopy. It is now a row-by-row fade over rows 0 to 29. Before and after night captures: the seam across the tree is gone, and tree brightness now changes smoothly from row to row.
- **Pond:** six shimmer glints were laid out on a fixed stagger, and they lined up with the moon reflection into a staircase of bars. Glints are now scattered, clipped to the water and blink independently, and the moon reflection is a short, softer column under the moon. Captures read as scattered glints.
- `npm test`: 189 passed. Browser: all 7 scripts pass.

## 0.6.1 (2026-10-06)

Feedback after first use: all-day rain was too much and movement felt repetitive.
- **Showers:** a showery day (20% of spring/autumn days, 12% of summer, none in winter) now has 1 to 3 showers of 3 to 6 minutes between 7am and 10pm, picked from the date. Showers fade in and out over about 20 seconds (instantly in extra quiet mode).
- **Movement:** LeapForth, Tumble, Trip, Charge, EventSleep, Shake, Withdraw and Kick are bundled wherever the pinned set has a real sheet; other forms reuse their own nearest move. Double was measured and dropped (it alone added about 270 KB). Idle routines never repeat back to back, and pose lengths and playback rates vary by ±20% and ±15%.
- `npm test`: **189 passed, 0 failed** (186 + 3 new: shower schedule over 1,000 days including a minute-by-minute cap, fade in/out, and gesture coverage plus one simulated hour per starter checking no back-to-back routine and that the new moves appear). The old all-day rain test was replaced.
- Browser: all 7 scripts pass. Six new gestures were captured on Charmander and reviewed; all render grounded and uncropped. No page errors.
- Bundle: 1,121 KB → 1,350 KB.
- Native: not yet exercised in Hermes Desktop.

## 0.6.0 (2026-10-06)

Adds long-turn company and a bigger cheer, quiet reactions to failed turns with an occasional break offer, calendar seasons with a hemisphere setting and one seasonal habit per starter, 13 collectible keepsakes, and learned arrival times. v1–v4 saves migrate to version 5 with companion, nickname, settings, memories and growth preserved.

### Executed automated checks

`npm test`: **163 passed, 0 failed** (144 existing + 19 new in `tests/rhythm.test.mjs`). New coverage: the bridge's turn start time, long-turn threshold and error streak (success, focus change and replays reset or ignore it; a user's Stop never counts); company for all three starters, deferring to fetch without cancelling it; quiet failure reactions with no bubble or confetti; the break offer's streak, cooldown and reduced-motion rules, and waiting out a nap instead of waking it; month-to-season mapping for both hemispheres and pinned seasons; each starter's seasonal habit appearing in ordinary life; keepsake place/season rules, single collection, save validation and reload; arrival learning (one per day per window, three distinct days required, real absence required); and arrival learning folded into the existing presence write. A fuzz test mixes every new input with play across all seasons and checks walkability and bounded queues.

Existing tests changed only where they hard-coded save version 4, the exact v4 memory shape, or the old rule that an error emits nothing. Errors and interruptions still never celebrate.

Two defects found during this work were fixed before release. A long turn that started during fetch could leave the companion stuck in its final "presenting" label instead of sitting down. The break offer could also wait on that label. Both now defer only while a plan is still running.

### Executed browser checks

Chromium (Playwright headless shell 153), loading the built ESM plugin with the preview SDK. In one page session, `smoke.js`, `growth.js`, `xp.js`, `play.js`, `lifecycle.js` and the new `rhythm.js` **all passed**. The same five original scripts also passed against an unmodified v0.5.0 checkout as a baseline. Two original scripts needed selector-only updates: `smoke.js` now names the Extra quiet mode checkbox because Settings has a second checkbox, and `xp.js` expects the v5 save.

| Check | Result |
| --- | --- |
| Seasons | October showed autumn on the calendar; the Southern Hemisphere option flipped it to spring; all four pinned seasons applied to the garden and companion; the setting and the v5 save persisted across reload |
| Long turn | The labeled **Long turn** demo event (the preview clock jumps three minutes) brought the companion to sit beside you with the caption "Sitting with you while Hermes works on a long one"; Completed then produced the bigger cheer; a short turn still got the ordinary cheer |
| Failed turns | One failure gave a quiet nod with no bubble; a second brought the ball over |
| Keepsakes | A pond investigation found a Smooth pebble; Settings showed "1 / 13"; it survived reload |
| Arrival rhythm | With three seeded earlier days at the current time and a 40-minute absence, the companion was already waiting in its favorite spot; Settings listed the learned time (seeded 9:00/9:05/9:10 displayed as 9:05 AM) |
| Errors | No page errors during the run |

The keepsake check uses the preview-only debug handle to force a find, because finds are deliberately rare. The arrival check seeds earlier days directly in the demo's own localStorage. Seasonal stills in `docs/images/season-*.png` are preview captures. They were reviewed and the ground details reworked once, because the first versions read as pixel noise.

### Second batch: world and rhythm (same release)

Adds tool-aware reactions, offline rainy days, late-night sleepiness, four wild visitors, keepsakes you can place in the garden, and day-count milestones. The save stays at version 5. New fields default safely: `weather` (setting), plus `metAt`, `milestones` and `placed` (per-species memories). `placed` only accepts keepsakes that were actually found.

`npm test`: **186 passed, 0 failed** (163 above + 23 new in `tests/world-life.test.mjs`). New coverage:
- **Tools:** tool-name mapping (unknown tools, `clarify` and replays never react); tool events never disturbing the working/waiting state; the 20-second cooldown; never interrupting fetch; extra quiet mode.
- **Rain:** date-stable rain with no rain in winter and roughly the configured share over 1,000 days; each starter's rain habit; Charmander never basking in rain.
- **Late night:** the 1am to 5am window; sleepy habits; dozing during late company; work cues not waking a dozing companion while a finished turn does; daytime life unchanged.
- **Visitors:** eligibility by phase, season and weather; a full arrive, stay and leave cycle with minutes between visits; none in extra quiet mode; watching never preempting play.
- **Decorations:** found-only placement, a 4-slot limit, persistence, and walkable slots.
- **Milestones:** local calendar day counting; each milestone once; stale milestones recorded silently after long breaks; a milestone adding no save beyond an ordinary return; the celebration following the welcome-back greeting.
- **Combined:** a fuzz run mixing all of these with play for all three starters.

Four existing tests changed only to include the new default fields in exact-shape assertions.

Browser (same Chromium setup): `smoke.js`, `growth.js`, `xp.js`, `play.js`, `lifecycle.js`, `rhythm.js` and the new `world.js` **all passed in one page session**. `world.js` covers:
- **Tools:** the three simulated tool buttons producing scouting, curious and digging, and the cooldown holding.
- **Visitors:** a summoned visitor arriving and being watched.
- **Rain:** pinned rain applying, persisting and showing Squirtle puddling.
- **Late night:** holding late-night on, a long turn dozing off with Zs, a Working cue not waking it, and Completed waking it into the proud cheer.
- **Decorations:** placing two seeded keepsakes, the companion checking on one, and persistence.
- **Milestones:** a save met 30 days ago celebrating "30 days together" once, with Settings showing "Days together 30".

No page errors occurred. Late night is forced through the debug handle, because the runtime otherwise reads the real clock.

Visual review of preview captures led to four fixes before release:
- Magikarp first sat on top of the water. It now sinks below the waterline with a ripple ring.
- Placed keepsakes blended into the path stones. They now have a dark outline and clearer shapes.
- Sleep Zs were hard to see. They now have a dark outline.
- Raindrops formed a regular grid. They are now longer, lighter and randomly spaced.

Stills: `docs/images/rain.png`, `visitor.png`, `decorations.png`, `dozing.png`.

The four visitor sprite sets add Idle, Walk and Hop sheets from the same pinned SpriteCollab commit (original CHUNSOFT sheets; see CREDITS.md). The bundle grew from 943 KB to 1,121 KB.

### Native and release limits

v0.6 uses the same documented SDK surface as v0.5: the same atoms and `message.complete`/`tool.*` events, plus the existing `status` field, which already distinguished errors from interruptions. Tool reactions read only `tool.start`'s `name`. The release introduces no model calls, runtime network access or agent behavior changes. None of the new behavior has been exercised in native Hermes yet. Native smoke-test items: real long turns; real error and interrupted statuses; real tool bursts; arrival learning and milestones across real days; natural rain days; and late-night behavior at real late hours. The catalog pull request stays a draft.

## 0.5.0 (2026-10-04)

Adds local XP, levels and optional evolution through all three starter lines. v1–v3 saves migrate to version 4 with the existing companion, nickname, settings and memories preserved. Progression is separate for each starter lineage. The new forms retain their lineage's routines and use real bundled sprite sheets.

### Executed automated checks

`npm test`: **144 passed, 0 failed**. This includes all nine forms' animation timing, ten minutes of garden life, fetch and berries; all six consented evolution transitions; valid position handoff; one completion callback; reduced-motion toggles; reload/disable cancellation; visible/focused active time; XP cooldowns across reloads and clock rollback; level cap; save validation and migration; and renderer/lifecycle regressions.

A review found synchronous storage notification could dispose the memory controller and count an active-time batch twice. Time is now consumed before notifying subscribers, and a regression covers both periodic and final partial batches. A visual check also found a newly narrowed camera could briefly crop the companion; the first frame after a resize now shows the companion fully before ordinary smooth following resumes.

All **77 original animation sheets** and matching shadow sheets are bundled for nine forms; **2,530 frames** pass dimension/ground-anchor checks. Forty documented same-form Idle aliases fill unavailable gestures. Source files were checked byte-for-byte against the pinned SpriteCollab Git blobs. Base starter sheets and timing are unchanged. Evolved bodies, larger head clearance and narrow-pane rendering were visually inspected.

### Executed browser checks

Chromium, loading the built ESM plugin with the preview SDK; no visibility or animation scheduling shims. The browser scripts are committed under `tests/browser/`.

| Check | Result |
| --- | --- |
| Original controls | Animated previews, starter selection, petting, rename/reset, page/plugin persistence, light/dark themes, 240 px layout and simulated bottom docking passed |
| Full evolution lines | All six evolution choices exercised via the labeled demo fast-forward; declining preserved form; confirming preserved position/nickname and showed a new-form announcement |
| Evolved play and storage | Venusaur, Blastoise and Charizard completed fetch; all six evolved forms survived reload; switching retained three separate progression entries |
| Real passive XP | One actual visible, focused minute awarded 3 XP; no clock/rAF acceleration used |
| Interaction XP | Pet awarded 2 XP; repeated clicks and plugin reload did not bypass its cooldown; crossing a level displayed the level-up announcement |
| Migration | A demo v3 Dario save retained nickname and favorite spot and migrated to v4 |
| Hidden/quiet evolution | Hidden XP stopped; hiding froze the evolution until shown; reloading mid-transition kept the old form; reduced-motion evolution completed with the quiet preference retained |
| Lifecycle and budget | 30 draws/second, about 7–8 reduced; 15 reloads kept one frame/two observers/six SDK subscriptions/one style/one canvas with unchanged listeners; disable released every plugin resource counted |

Evolution fast-forward exists only in the clearly marked browser demo and is never offered inside Hermes. The screenshots are preview captures. They are not proof of a native host session.

### Native and release limits

This update uses the same documented SDK surface as v0.4 and introduces no model calls, runtime network access or agent behavior changes. Its new progression behavior has not been exercised in native Hermes. Native dock dragging, full application restart persistence and actual gateway/session cues remain open smoke-test items. The catalog pull request stays a draft. Exact-commit package validation and CI outcomes are recorded in the release/PR.

## 0.4.0 (2026-10-04)

Adds spontaneous ball invitations and species-specific tree, pond and flower investigations while preserving the existing sprite timing, easing, swimming, greetings and memories. A pathfinding repair also prevents straight segments from clipping the tree trunk or pond rim.

### Executed automated checks

- **102 tests passed** on Windows, under both Node 26.3.0 and an official checksum-verified Node 22.23.3 runtime. Coverage includes all invitation phases and handoffs, interruption/cooldown rules, scenery approaches, reduced motion, persistence, lifecycle disposal, obstacle geometry and deterministic release packaging.
- An independent stress run passed **9,001,200 simulation steps**, including **7,800 invitation/action interleavings**. An additional set within that run covered 120 ten-minute random sessions, 288 natural invitations and 467 investigations. No bounds violations, orphaned balls, unbounded event queues or stuck interactions after settling were found.
- The build checks all 39 embedded animation sheets and their anchors, permits only the documented SDK/React ESM imports, and writes the same bundle to both installation layouts. Package tests reject modified bundles, missing files, unexpected files and version mismatches, and verify deterministic ZIP bytes and SHA256 output.

### Executed browser preview checks

Chromium at 1280×950, exercising the built plugin and simulated SDK. No visibility or requestAnimationFrame shims were used. Reproducible scripts are in `tests/browser/`.

| Check | Result |
| --- | --- |
| Three starters | Selected and named Bulbasaur, Charmander and Squirtle through the UI |
| First use and persistence | Animated starter previews, initial Charmander selection and nickname; selection survived page reload; rename and extra-quiet setting survived plugin reload; reset position exercised |
| Layout | 240 px pane measured 238 px content and scroll width with no horizontal overflow; light/dark themes and simulated bottom docking exercised |
| New ball invitations | Each species rendered its invitation; Ball remained available, accepted the existing toy, and completed fetch despite pet clicks and simulated Hermes cues |
| Scenery | Real canvas clicks led to finite investigations at flowers, tree and pond; learned resting spot recorded; no abandoned prop |
| Reduced motion | Enabling the OS preference during an invitation cleared the ball; investigations stayed in place; consecutive idle pixels were identical; fetch and welcome completed |
| Rendering | 30 draws/second normally; about 7–8/second with reduced motion; hidden simulation and rendering stopped with zero queued frames |
| Reload | After 15 reloads: one frame, two observers, six SDK subscriptions, one style and one canvas; listener count unchanged |
| Disable | Zero plugin frames, observers, subscriptions, styles, canvases or counted listeners; only the demo's own pagehide listener remained |

Rare random moments are triggered through the preview-only debug handle so their timing is reproducible. Hermes events and the return simulation are clearly labeled; they do not run a model. Screenshots in `docs/images/` are browser previews, not native Hermes captures.

### Native Hermes observations and limits

The installed Windows host is Hermes 0.21.5+6841, source `8b66a51036c1e20920a17cdd049fdf55c968d683`. Before this upgrade, **v0.3 was directly observed in its docked native pane** with the existing Charmander nickname Dario, host theme colors and changing garden behavior/status. This establishes the existing native integration, not all v0.4 interactions.

The **v0.4 bundle has been copied and checksum-checked in the supported desktop-plugin directory**, with v0.3 backed up. Native UI testing was interrupted by focus/window changes; v0.4 hot reload, native button interactions, dock dragging, full restart persistence, theme switching and actual gateway/session reactions remain unverified. No Hermes core files were modified. Browser checks above must not be read as native-host results.

### Package validation

The official installed `hermes plugins validate` accepted a clean package copy: all 12 checks passed, including the security scan, Desktop SDK surface and no-core-override check. The expected warning says that the Python capability probe is skipped because this desktop-only package has no `__init__.py`. Exact-commit validation and catalog CI results are also recorded on the catalog pull request; this document does not claim native runtime validation from a static validator.

## 0.3.0 (2026-10-04)

This update extends the user's v0.2 animations and garden. The 160×120 art grid, original shadow anchors and sprite timing, turning/easing, swimming, waking, berry bites, night lighting and narrow-pane camera were retained.

### Executed automated checks

`npm test`: **71 passed, 0 failed**. Coverage includes the original movement and integration checks, all three signature plans, greeting deferral/cancellation, favorite-spot learning, v1/v2 → v3 save migration, invalid dates, sparse storage writes, reduced effects and FIFO lifecycle disposal. Runtime tests execute the real scheduler and renderer with stub browser APIs; they verify loading before intersection, disposal during pending image loads, focus/pane presence, and cleanup. They do not check rendered pixels.

An independent randomized run exercised **720,000 simulation steps**, across three species and 80 seeds, mixing ball/berry/pet/call/notice, greetings, Hermes cues, resets and reduced-motion switches. No out-of-bounds pet positions or stuck busy/greeting states remained after inputs stopped. A berry fallback at the upper boundary found during this check was fixed and given a permanent regression test.

`npm run build` validates all 39 bundled sprite sheets and anchors and the three allowed ESM imports. No new external artwork or runtime requests were added.

### Executed browser preview checks

Headless Chromium driven by Playwright CLI, at 1280×950. It loads the actual built plugin through the demo SDK. There were no visibility/rAF shims for these checks. Scripts and screenshots are in `output/playwright/v03-*` in the development workspace.

| Check | Result |
| --- | --- |
| Starter previews and selection | Animated preview pixels changed; selected and nicknamed Bulbasaur, Charmander and Squirtle through controls |
| Pet, berry and fetch | Heart reaction; berry anticipation → eating → clear; ball carried and proudly presented; eight repeated pet clicks plus working/completion cues did not break fetch |
| Welcome | Simulated two-minute absence → approach and greeting → ordinary behavior; memory updated; rapid reload and quick hide did not greet |
| Memories | A real grass click taught the flower spot; settings showed it; nickname and memories survived plugin/page reload and starter changes |
| Species moments | Bulbasaur tending, Charmander warming, Squirtle making rings rendered with the new captions. The harness selected the random behavior branch directly; movement, timing and effects ran normally |
| Settings | Rename and reset exercised; garden changed from night to day |
| Layout | 240 px narrow pane: 238 px content/scroll width, no horizontal overflow, named icon controls; 370 px pane and simulated bottom docking; light and dark themes |
| Reduced motion | Emulated OS preference respected; consecutive idle images pixel-identical; fetch completed; welcome completed without travel |
| Rendering budget | Measured 30 draws/second normally, approximately 8/second reduced; hiding froze both simulation and rendering with zero queued frames |
| Reload and disable | After 15 reloads: one frame, two observers, six SDK subscriptions, one style, one canvas, unchanged listener count. Disabling while hidden left zero plugin frames/observers/subscriptions/styles/canvases/listeners; the demo's own pagehide listener remained |

The demo labels Hermes events and the return simulation explicitly. Demo storage is independent of Hermes storage. Signature and lifecycle stress tests use the demo-only debug handle; it is not exposed by the installed plugin.

### Hermes installation and limits

The supplied screenshot establishes that the user's v0.2 plugin was running in Hermes. Current installed host source at `8b66a51036c1e20920a17cdd049fdf55c968d683` was inspected for supported storage, pane visibility, imports, FIFO disposal and disk-plugin hot reload.

The v0.3 release is installed using the supported disk-plugin directory and installer, with the previous `plugin.js` backed up. Bundle checksums are verified separately. This confirms the installed files, **not** native UI execution. Native v0.3 docking, host theme propagation, persistence across a Hermes restart, and real session/gateway reactions have not been directly exercised. If Hermes still shows v0.2, run **Reload desktop plugins** from its command palette. No Hermes core files were modified.

## 0.2.0 (2026-10-04)

Executed on Windows with Node.js and the Claude desktop app's built-in Chromium browser pane. The preview imports the built `dist/hermes-pokemon/plugin.js` through the mock SDK. This checks the shipped code and lifecycle contract, but does **not** substitute for execution in Hermes Desktop.

### What changed and why

| Problem in 0.1 | Fix |
| --- | --- |
| Pokémon faced the wrong way walking left/right (direction rows were mirrored against SpriteCollab's order) | `directionTo()` maps vectors to the real row order; unit-tested for all 8 directions |
| Bulbasaur lurched forward and snapped back every step (its walk sheet moves the body inside the frame) | Every frame is anchored by the ground marker in the matching `*-Shadow.png`, extracted at build time |
| Garden drawn on a 1 px grid, sprites on a 2 px grid | One 160×120 art grid; sprites 1:1; integer-scaled backing store with pixelated CSS scaling |
| ~22 fps from `setTimeout`+rAF; frames at half speed; feet sliding | Steady 30 fps rAF loop with fixed 50 ms simulation steps; walk cycle speed follows movement speed |
| BFS on an 8 px, 4-direction grid → L-shaped routes, instant 90° snaps, always snapping to face down | A* on a 4 px 8-connected grid + line-of-sight smoothing; acceleration/braking; turning one octant at a time; idle glances |
| Four animations for everything | 13 animations: nap = Laying → Sleep → Wake → DeepBreath; pet = Nod/Hop/Pose; play = Rotate/Hop; Eat, LookUp, Sit… |
| Static, flat-rectangle garden; text glyphs for cues | Shaded tree (separate depth-sorted layer), organic pond, mottled meadow, swaying plants, drifting clouds, ripples/fish, falling leaves, butterflies, fireflies; time-of-day grade; pixel speech bubbles and particles |

### Automated

`npm run build` succeeds (≈334 KB single ESM file; only `@hermes/plugin-sdk`, `react`, `react/jsx-runtime` imports; 39 sprite sheets embedded; shadow anchors decoded by a minimal built-in PNG reader).

`npm test`: **29 passed, 0 failed**, including:

- Direction mapping for all 8 SpriteCollab rows; paths around the pond are a few straight legs with every leg clear of obstacles; all named spots walkable.
- Ten simulated minutes per species: stays on walkable ground (or inside the pond while swimming), reaches idle/walking/sleeping/playing and its species state (resting/basking/watching), and Squirtle swims.
- Fetch per species under repeated throw/berry/pet/Hermes-cue spam: ball is picked up, returned, cleared; a new throw is accepted afterwards.
- Berry per species: walked to, eaten with the Eat animation, cleared.
- Pet debounce; petting a napping Pokémon wakes it first; Hermes cues never cancel naps or fetches; completed → celebrating + confetti event.
- Call-to-grass arrival, acceleration (no full-speed start), atomic reset, reduced-motion fetch, no catch-up jump after a long pause.
- Persistence v2, v1 → v2 migration, invalid sky values, plus the 0.1 storage/Hermes bridge suites.

### In the browser preview (snapshots read back at 5×)

| Check | Result |
| --- | --- |
| Walk facing | Charmander walking left faces left; Bulbasaur walking right faces right with a planted body (no lurch) |
| Species routines | Bulbasaur sits/looks up under the tree; Charmander basks in the sun patch; Squirtle dives in, swims clipped at the waterline, climbs out |
| Fetch | “!” → chase → bounce/roll → ball held overhead → returned → Pose + sparkle bubble; napping Pokémon wakes up first |
| Berry | Falls, is walked to and eaten (Eat animation), hearts afterwards |
| Hermes cues (simulated) | “…” while working, “?” for clarify, hop + confetti on completion |
| Time of day | Dawn, day, dusk and night all rendered; night shows stars, moon, fireflies and Charmander's flame glow |
| Narrow pane | ≤300 px wide: 1.4× follow camera; clicks map through the camera; no horizontal overflow at 240 px; controls collapse to icons |
| Starter cards | Animated previews, happy hop when a card is selected |
| Reduced motion | Consecutive idle frames are pixel-identical; petting still shows a heart that expires; fetch completes without travel |
| Lifecycle | After 1 and after 10 rapid reloads: exactly 1 pending frame, 1 ResizeObserver, 1 IntersectionObserver, 1 style node, 1 canvas. Hidden via the SDK visibility atom: 0 pending frames; shown again: resumes |

The preview pane was hidden from view during most of these checks, so the page's visibility and rAF were shimmed for snapshotting; layout measurements were taken from on-screen screenshots.

### Not verified inside Hermes

Hermes Desktop was not available. Native dock dragging, real SDK storage across host restarts, host theme propagation, and real event dispatch remain host smoke-test items. Suggested pass: install, enable, choose/name a starter, restart Hermes, drag the pane below the chat, run one successful turn and a clarification, hide/reveal the tab, then disable/re-enable and reload the plugin.

## 0.1.0

The original 0.1 verification (Playwright-driven checks, 20 tests) covered the same lifecycle contract with the previous renderer; its evidence lives in `output/playwright/` in the development workspace.
