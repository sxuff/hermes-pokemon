// Preview-only: golden images. Three still scenes are seeded (save, season, sky, weather, moon,
// randomness) so the garden renders the same pixels every time; each is compared with
// tests/goldens/<scene>.png through the canvas, never a screenshot, so scaling cannot blur it.
// UPDATE_GOLDENS=1 npm run check:browser golden   rewrites the goldens from the current render.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const ready = () => page.waitForFunction(() => document.querySelector('.hp-stage') && !document.querySelector('.hp-loading'));
  const goldens = globalThis.__goldens;
  const scenes = [
    { name: 'day-summer', sky: 'day', season: 'summer', weather: 'clear', metDaysAgo: 1, awayDays: 0, milestones: [] },
    { name: 'night-winter-rewards', sky: 'night', season: 'winter', weather: 'clear', metDaysAgo: 400, awayDays: 20, milestones: [30, 100, 365], moon: 0.5 },
    { name: 'dusk-autumn-rain', sky: 'dusk', season: 'autumn', weather: 'rain', metDaysAgo: 40, awayDays: 0, milestones: [30], moon: 0.25 },
  ];
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.locator('#width').fill('370');
  await page.locator('#width').dispatchEvent('input');
  const results = {};
  for (const scene of scenes) {
    await page.evaluate((scene) => {
      __demo.disable();
      const now = Date.now();
      const key = 'hermes-pokemon.demo.companion';
      const record = {
        version: 6, species: 'charmander', nickname: 'Dario', motion: 'reduced', sky: scene.sky, season: scene.season, hemisphere: 'north', weather: scene.weather,
        memories: { charmander: { favoriteSpot: null, lastInteraction: null, lastSeenAt: now - (scene.awayDays || 0.001) * 86_400_000, lastGreetingAt: 0, keepsakes: [], arrivals: [], metAt: now - scene.metDaysAgo * 86_400_000, milestones: scene.milestones, placed: [], sightings: {} } },
        progression: {},
      };
      localStorage.setItem(key, JSON.stringify(record));
      // Seeded randomness for the garden and a pinned moon, read by the preview only.
      let seed = 12345;
      __hermesPokemonDebug.random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
      __hermesPokemonDebug.moon = scene.moon ?? 0.5;
      __demo.enable();
    }, scene);
    await ready();
    await page.waitForFunction(() => __hermesPokemonDebug.pet && __hermesPokemonDebug.runtime());
    await page.waitForTimeout(400);
    // Freeze the companion where you stand, facing you, with no bubble; the runtime draws it still.
    await page.evaluate(() => { const p = __hermesPokemonDebug.pet; p.reset(); p.bubble = null; p.start([{ kind: 'pose', anim: 'Idle', duration: 600, state: 'idle' }]); });
    await page.waitForTimeout(600);
    const live = await page.evaluate(() => {
      const canvas = document.querySelector('.hp-stage canvas');
      return { width: canvas.width, height: canvas.height, data: canvas.toDataURL('image/png'), phase: __hermesPokemonDebug.runtime().phase, rewards: __hermesPokemonDebug.pet.rewards.join(), untidy: __hermesPokemonDebug.pet.untidy };
    });
    check(live.phase === scene.sky, `${scene.name}: phase ${live.phase}`);
    if (goldens?.update) {
      await goldens.write(scene.name, live.data);
      results[scene.name] = 'written';
      continue;
    }
    const diff = await page.evaluate(async ({ name, width, height }) => {
      const response = await fetch(`/tests/goldens/${name}.png`, { cache: 'no-store' });
      if (!response.ok) return { missing: true };
      const bitmap = await createImageBitmap(await response.blob());
      if (bitmap.width !== width || bitmap.height !== height) return { size: [bitmap.width, bitmap.height] };
      const scratch = document.createElement('canvas');
      scratch.width = width; scratch.height = height;
      const c = scratch.getContext('2d');
      c.drawImage(bitmap, 0, 0);
      const golden = c.getImageData(0, 0, width, height).data;
      const live = document.querySelector('.hp-stage canvas').getContext('2d').getImageData(0, 0, width, height).data;
      let differing = 0;
      for (let i = 0; i < golden.length; i += 4)
        if (golden[i] !== live[i] || golden[i + 1] !== live[i + 1] || golden[i + 2] !== live[i + 2] || golden[i + 3] !== live[i + 3]) differing++;
      return { differing, total: golden.length / 4 };
    }, { name: scene.name, width: live.width, height: live.height });
    check(!diff.missing, `${scene.name}: no golden yet. Run with UPDATE_GOLDENS=1 to create tests/goldens/${scene.name}.png`);
    check(!diff.size, `${scene.name}: golden is ${diff.size} but the canvas is ${live.width}x${live.height}`);
    const share = diff.differing / diff.total;
    results[scene.name] = `${diff.differing} of ${diff.total} pixels differ (${(share * 100).toFixed(3)}%)`;
    if (share > 0.002) {
      await page.locator('.hp-stage').screenshot({ path: `output/playwright/golden-${scene.name}-actual.png` });
      throw new Error(`${scene.name}: ${results[scene.name]}; see output/playwright/golden-${scene.name}-actual.png`);
    }
  }
  await page.evaluate(() => { delete __hermesPokemonDebug.random; delete __hermesPokemonDebug.moon; __demo.disable(); localStorage.removeItem('hermes-pokemon.demo.companion'); __demo.enable(); });
  check(errors.length === 0, errors.join('\n'));
  return results;
}
