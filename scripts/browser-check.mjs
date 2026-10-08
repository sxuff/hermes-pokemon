// Runs the Playwright scripts in tests/browser against the built demo, in their documented order.
// Usage: npm run build && npm run check:browser [names…]   (once: npx playwright install chromium)
// Each script is the same `async (page) => {…}` function that `@playwright/cli run-code` accepts,
// so the two ways of running them stay interchangeable.
import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT || 4173);
const ORIGIN = `http://127.0.0.1:${PORT}/`;
const ORDER = ["smoke", "growth", "xp", "play", "lifecycle", "rhythm", "world"];
const names = process.argv.slice(2).filter((name) => ORDER.includes(name));
const scripts = names.length ? names : ORDER;

async function waitForServer(url, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`The demo server did not answer at ${url}`);
}

const server = spawn(process.execPath, ["scripts/serve.mjs"], { env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "inherit", "inherit"] });
let browser, failed = false;
try {
  await waitForServer(ORIGIN);
  await mkdir("output/playwright", { recursive: true });
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 950 } })).newPage();
  page.setDefaultTimeout(30_000);
  await page.goto(ORIGIN);
  for (const name of scripts) {
    const source = await readFile(`tests/browser/${name}.js`, "utf8");
    const script = new Function(`return (\n${source}\n);`)();
    const started = Date.now();
    try {
      const result = await script(page);
      console.log(`✔ ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`, typeof result === "string" ? result : JSON.stringify(result));
    } catch (error) {
      failed = true;
      console.error(`✖ ${name}: ${error?.stack || error}`);
      await page.screenshot({ path: `output/playwright/${name}-failure.png`, fullPage: true }).catch(() => {});
      break;
    }
  }
} finally {
  await browser?.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
