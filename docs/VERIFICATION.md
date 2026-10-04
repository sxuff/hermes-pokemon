# Verification

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
