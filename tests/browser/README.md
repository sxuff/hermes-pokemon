# Browser checks

Run `npm ci`, `npm run build`, then `npm run demo` from the repository root. With a Chromium browser available to Playwright CLI:

```sh
npx @playwright/cli open http://127.0.0.1:4173/
npx @playwright/cli run-code --filename=tests/browser/smoke.js
npx @playwright/cli run-code --filename=tests/browser/growth.js
npx @playwright/cli run-code --filename=tests/browser/xp.js
npx @playwright/cli run-code --filename=tests/browser/play.js
npx @playwright/cli run-code --filename=tests/browser/lifecycle.js
npx @playwright/cli run-code --filename=tests/browser/rhythm.js
```

Run the scripts in that order. They operate only on the preview's independent localStorage; `smoke.js` resets that demo companion and writes the documentation screenshots. `growth.js` uses the clearly marked demo buttons to exercise all six evolution choices. `xp.js` replaces the demo save with a v3 fixture and waits one real active minute to check XP. `play.js` needs an already-selected starter. `rhythm.js` resets the demo companion and covers v0.6: all four seasons and the hemisphere flip, long-turn company and the bigger cheer, quiet failures and the break offer, a keepsake find surviving reload, and waiting at a learned arrival time. It writes `docs/images/season-*.png`. Create `output/playwright/` before running them.

The tests exercise the built ESM plugin through the explicitly simulated SDK. The demo-only debug handle makes rare invitations reproducible. Lifecycle instrumentation counts frames, observers and listeners without replacing visibility or scheduling behavior. It is never included in the installed plugin.

These are executable Playwright CLI scripts, not part of `npm test`. Native Hermes docking, session activity and full application restarts need a separate host smoke test; see `docs/VERIFICATION.md`.
