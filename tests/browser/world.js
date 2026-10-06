// Preview-only: v0.6 world features (tools, rain, late night, visitors, decorations, milestones).
// Resets this origin's demo companion, never Hermes storage.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const ready = () => page.waitForFunction(() => document.querySelector('.hp-stage') && !document.querySelector('.hp-loading'));
  const waitState = async (s, timeout = 20000) => {
    try { await page.waitForFunction(s => __hermesPokemonDebug.pet.state === s, s, {timeout}); }
    catch { throw new Error(`never reached "${s}" (now ${await page.evaluate(() => __hermesPokemonDebug.pet.state + ' / ' + __hermesPokemonDebug.pet.anim?.name)})`); }
  };
  const idle = () => page.evaluate(() => { const p = __hermesPokemonDebug.pet; p.nextToolAt = 0; p.start([{kind:'pose',anim:'Idle',duration:30,state:'idle'}]); });
  await page.evaluate(() => { __demo.disable(); localStorage.removeItem('hermes-pokemon.demo.companion'); });
  await page.reload();
  await page.setViewportSize({width:1280,height:950});
  await page.waitForFunction(() => document.querySelectorAll('.hp-preview').length === 3);
  await page.getByRole('button',{name:/Squirtle/}).click();
  await page.getByRole('button',{name:'Meet your companion'}).click();
  await ready();
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  await page.getByRole('radio',{name:'Day',exact:true}).click();
  await page.getByRole('radio',{name:'Summer',exact:true}).click();
  // Natural weather follows the date and may be rainy today; visitors stay away in rain.
  await page.getByRole('radio',{name:'Clear',exact:true}).click();
  await page.getByRole('button',{name:'Close settings'}).click();
  await page.waitForTimeout(500);

  // 1. Tool reactions, from the simulated tool.start events.
  for (const [button, state] of [['tool-web','scouting'],['tool-terminal','curious'],['tool-files','digging']]) {
    await idle();
    await page.locator(`[data-event="${button}"]`).click();
    await waitState(state, 5000);
    check((await page.locator('.hp-status').textContent()).length > 0, 'status caption empty');
  }
  await idle();
  await page.locator('[data-event="tool-terminal"]').click();
  await waitState('curious', 5000);
  await idle();
  await page.evaluate(() => { __hermesPokemonDebug.pet.nextToolAt = __hermesPokemonDebug.pet.time + 20; });
  await page.locator('[data-event="tool-web"]').click();
  await page.waitForTimeout(600);
  check(await page.evaluate(() => __hermesPokemonDebug.pet.state === 'idle'), 'tool cooldown not respected');
  await page.locator('[data-event="idle"]').click();

  // 4. A wild visitor, drawn and watched.
  await idle();
  await page.getByRole('button',{name:'Wild visitor'}).click();
  check(await page.evaluate(() => Boolean(__hermesPokemonDebug.runtime().visitor)), 'no visitor summoned');
  const visitorName = await page.evaluate(() => __hermesPokemonDebug.runtime().visitor.species);
  await waitState('visitor', 15000);
  await page.waitForTimeout(400);
  await page.locator('.hp-stage').screenshot({path:'docs/images/visitor.png'});

  // 2. Rain, pinned in Settings, persisted; Squirtle's puddle habit.
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  await page.getByRole('radio',{name:'Rain',exact:true}).click();
  await page.getByRole('button',{name:'Close settings'}).click();
  await page.waitForTimeout(800);
  check(await page.evaluate(() => __hermesPokemonDebug.runtime().weather === 'rain' && __hermesPokemonDebug.pet.weather === 'rain'), 'rain not applied');
  await page.evaluate(() => { const p = __hermesPokemonDebug.pet; p.start(p.rainPlan()); });
  await waitState('puddling', 15000);
  await page.waitForTimeout(600);
  await page.locator('.hp-stage').screenshot({path:'docs/images/rain.png'});
  await page.reload(); await ready();
  check(await page.evaluate(() => __demo.diagnostics().saved.weather === 'rain'), 'weather not persisted');
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  await page.getByRole('radio',{name:'Natural',exact:true}).click();
  await page.getByRole('button',{name:'Close settings'}).click();

  // 3. Late night: a long turn at 2am may doze off; finishing wakes it to cheer.
  // The runtime re-reads the real clock every 20 s; hold "late night" on for this section.
  await page.evaluate(() => { const p = __hermesPokemonDebug.pet; p.random = () => 0.1;
    globalThis.__lateHold = setInterval(() => { p.lateNight = true; }, 50); p.lateNight = true; });
  await idle();
  await page.locator('[data-event="long"]').click();
  await waitState('company', 20000);
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  await page.getByRole('radio',{name:'Night',exact:true}).click();
  await page.getByRole('button',{name:'Close settings'}).click();
  await waitState('dozing', 40000);
  // Dozing opens with a slow yawn and lying down, then the sleep pose with drifting Zs.
  await page.waitForFunction(() => __hermesPokemonDebug.pet.drowsy, null, {timeout: 15000});
  await page.waitForTimeout(800);
  await page.locator('.hp-stage').screenshot({path:'docs/images/dozing.png'});
  await page.locator('[data-event="working"]').click();
  await page.waitForTimeout(500);
  check(await page.evaluate(() => __hermesPokemonDebug.pet.state === 'dozing'), 'work cue woke it');
  await page.locator('[data-event="completed"]').click();
  await waitState('proud', 8000);
  await page.evaluate(() => { clearInterval(globalThis.__lateHold); const p = __hermesPokemonDebug.pet; p.lateNight = false; p.random = Math.random; });

  // 5. Decorations: collect two keepsakes (preview-forced), place them, see them persist.
  await page.evaluate(() => {
    __demo.disable();
    const record = JSON.parse(localStorage.getItem('hermes-pokemon.demo.companion'));
    record.memories.squirtle = { ...record.memories.squirtle, keepsakes: ['pebble','shell','acorn'] };
    localStorage.setItem('hermes-pokemon.demo.companion', JSON.stringify(record));
  });
  await page.reload(); await ready();
  check(await page.evaluate(() => __demo.diagnostics().saved.memories.squirtle.keepsakes.length === 3), 'seeded keepsakes lost');
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  const places = page.locator('.hp-keepsakes .hp-place');
  check(await places.count() === 3, 'place buttons missing');
  await places.nth(0).click();
  await places.nth(1).click();
  check(await page.locator('.hp-keepsakes .hp-place[aria-pressed="true"]').count() === 2, 'placing not shown');
  await page.getByRole('button',{name:'Close settings'}).click();
  await page.waitForTimeout(500);
  check(await page.evaluate(() => __hermesPokemonDebug.pet.placed.join() === 'pebble,shell'), 'pet does not know the decorations');
  await page.evaluate(() => { const p = __hermesPokemonDebug.pet; p.start(p.decorPlan()); });
  await waitState('admiring', 20000);
  check(/Checking on a (smooth pebble|tiny shell)/.test(await page.locator('.hp-status').textContent()), 'admiring caption');
  await page.locator('.hp-stage').screenshot({path:'docs/images/decorations.png'});
  await page.reload(); await ready();
  check(await page.evaluate(() => __demo.diagnostics().saved.memories.squirtle.placed.join() === 'pebble,shell'), 'decorations not persisted');

  // 6. Milestone: met 30 days ago, then come back.
  await page.evaluate(() => {
    __demo.disable();
    const record = JSON.parse(localStorage.getItem('hermes-pokemon.demo.companion'));
    const now = Date.now();
    record.memories.squirtle = { ...record.memories.squirtle, metAt: now - 30 * 86_400_000, milestones: [], lastSeenAt: now - 120_000, lastGreetingAt: now - 3_600_000 };
    localStorage.setItem('hermes-pokemon.demo.companion', JSON.stringify(record));
    __demo.enable();
  });
  await ready();
  await waitState('milestone', 25000);
  check(/30 days together/.test(await page.locator('.hp-status').textContent()), 'milestone caption');
  check(await page.evaluate(() => JSON.stringify(__demo.diagnostics().saved.memories.squirtle.milestones) === '[30]'), 'milestone not saved');
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  check(/Days together\s*30/.test(await page.locator('.hp-memories').textContent()), 'days together not shown');
  await page.getByRole('button',{name:'Close settings'}).click();

  check(errors.length === 0, 'page errors: ' + errors.join('; '));
  return `world checks passed (visitor: ${visitorName})`;
}
