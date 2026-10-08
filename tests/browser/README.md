# Browser checks

Seven Playwright scripts exercise the **built ESM plugin** through the explicitly simulated SDK in the browser demo. They operate only on the preview's independent localStorage, never Hermes storage.

```sh
npm ci
npm run build
npx playwright install chromium   # once; CI adds --with-deps on Ubuntu
npm run check:browser
```

`npm run check:browser` starts the demo server, opens one Chromium page and runs the scripts in this order: `smoke`, `growth`, `xp`, `play`, `lifecycle`, `rhythm`, `world`. Pass names to run a subset, for example `npm run check:browser smoke world`. A failing script stops the run, prints the error and writes `output/playwright/<name>-failure.png`. CI runs the full set on every push and pull request.

The scripts are the same `async (page) => {…}` functions that Playwright CLI accepts, so they can also be run one at a time against `npm run demo`:

```sh
npx @playwright/cli open http://127.0.0.1:4173/
npx @playwright/cli run-code --filename=tests/browser/smoke.js
```

`smoke.js` resets the demo companion and writes the documentation screenshots. `growth.js` uses the clearly marked demo buttons to exercise all six evolution choices. `xp.js` replaces the demo save with a v3 fixture and waits one real active minute to check XP. `play.js` needs an already-selected starter. `rhythm.js` resets the demo companion and covers v0.6: all four seasons and the hemisphere flip, long-turn company and the bigger cheer, quiet failures and the break offer, a keepsake find surviving reload, and waiting at a learned arrival time; it writes `docs/images/season-*.png`. `world.js` covers tool reactions, rain, late nights, visitors, decorations and milestones, plus the v0.7 additions: the glance at another chat, milestone rewards in the garden, keyboard access to the scenery and the seasonal moon.

The demo-only debug handle makes rare invitations reproducible. Lifecycle instrumentation counts frames, observers and listeners without replacing visibility or scheduling behavior. It is never included in the installed plugin.

Native Hermes docking, session activity and full application restarts need a separate host smoke test; see `docs/VERIFICATION.md`.
