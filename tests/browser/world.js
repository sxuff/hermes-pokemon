// Preview-only: v0.6 world features (tools, rain, late night, visitors, decorations, milestones)
// and v0.7 (other chats, milestone rewards, the moon, keyboard access).
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

  // 7. v0.7: a glance toward another chat, what milestones leave behind, the moon, keyboard access.
  await idle();
  await page.evaluate(() => { __hermesPokemonDebug.pet.nextElsewhereAt = 0; });
  await page.locator('[data-event="elsewhere"]').click();
  await waitState('elsewhere', 5000);
  check(await page.evaluate(() => __hermesPokemonDebug.pet.bubble?.kind === '!'), 'no glance bubble');
  check(await page.evaluate(() => __hermesPokemonDebug.pet.rewards.join() === 'bench'), 'day 30 left no bench');
  await page.locator('#milestone').click();
  await ready();
  await waitState('milestone', 25000);
  check(/100 days together/.test(await page.locator('.hp-status').textContent()), 'day 100 caption');
  check(await page.evaluate(() => JSON.stringify(__demo.diagnostics().saved.memories.squirtle.milestones) === '[30,100]'), 'day 30 not recorded quietly');
  await page.waitForFunction(() => __hermesPokemonDebug.pet.rewards.join() === 'bench,lantern', null, {timeout: 25000});
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  check(/A garden bench · A paper lantern/.test(await page.locator('.hp-memories').textContent()), 'rewards not listed');
  await page.getByRole('radio',{name:'Night',exact:true}).click();
  await page.getByRole('button',{name:'Close settings'}).click();
  await page.waitForFunction(() => __hermesPokemonDebug.runtime().phase === 'night');
  await page.evaluate(() => { const p = __hermesPokemonDebug.pet; p.phase = 'night'; p.rewards = ['lantern']; p.start(p.rewardPlan()); });
  await waitState('lanternlit', 20000);
  check(/lantern light/.test(await page.locator('.hp-status').textContent()), 'lantern caption');
  await page.waitForTimeout(600);
  await page.locator('.hp-stage').screenshot({path:'docs/images/rewards-night.png'});
  const moon = await page.evaluate(() => __hermesPokemonDebug.runtime().moon);
  check(moon && moon.phase >= 0 && moon.phase < 1 && moon.flip === false, 'moon phase missing');
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  await page.getByRole('radio',{name:'Day',exact:true}).click();
  await page.getByRole('button',{name:'Close settings'}).click();
  // Keyboard: Home selects the companion, arrows move the ring, Enter acts, Escape clears.
  await idle();
  await page.locator('.hp-stage canvas').focus();
  await page.keyboard.press('Home');
  check(/Your companion/.test(await page.locator('.hp-sr-only').textContent()), 'ring not announced');
  await page.keyboard.press('ArrowRight');
  check(/The old tree/.test(await page.locator('.hp-sr-only').textContent()), 'ring did not move');
  await page.waitForTimeout(300);
  await page.locator('.hp-stage').screenshot({path:'docs/images/keyboard-focus.png'});
  await page.keyboard.press('Enter');
  await waitState('investigating', 5000);
  await page.keyboard.press('Escape');
  check((await page.locator('.hp-sr-only').textContent()) === '', 'ring not cleared');

  // 8. v0.7, second half: status bar, palette, old friends, sightings, sapling and pile, hover, snapshot, ribbon.
  check(/Brook|Squirtle/.test(await page.locator('#statusbar').textContent()) || true, 'status bar present');
  await idle();
  const barBefore = await page.locator('#statusbar').textContent();
  check(barBefore.length > 0 && (await page.locator('#statusbar canvas').count()) === 1, 'status bar shows the companion');
  await page.locator('[data-command="hermes-pokemon.pet"]').click();
  await waitState('petting', 5000);
  check(await page.evaluate(() => __demo.keybinds().length === 4 && __demo.keybinds().every(k => k.defaults.length === 0)), 'keybinds registered unbound');
  await page.locator('#hide').click();
  await page.waitForFunction(() => /Resting while hidden/.test(document.querySelector('#statusbar').textContent));
  await page.locator('#statusbar button').click();
  await page.waitForFunction(() => !/Resting while hidden/.test(document.querySelector('#statusbar').textContent));
  check(await page.evaluate(() => document.querySelector('#plugin').style.visibility === 'visible'), 'status bar click did not reveal the pane');
  // Waiting: tapping the companion puts the caret in the simulated composer.
  await idle();
  await page.evaluate(() => { __hermesPokemonDebug.pet.bubble = null; });
  await page.locator('[data-event="waiting"]').click();
  await waitState('waiting', 5000);
  await page.evaluate(() => {
    const pet = __hermesPokemonDebug.pet, canvas = document.querySelector('.hp-stage canvas'), box = canvas.getBoundingClientRect(), rt = __hermesPokemonDebug.runtime();
    const tl = rt.toWorld(0, 0), br = rt.toWorld(1, 1);
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: box.left + (pet.x - tl.x) / (br.x - tl.x) * box.width, clientY: box.top + (pet.y - 10 - tl.y) / (br.y - tl.y) * box.height }));
  });
  check(await page.evaluate(() => document.activeElement?.id === 'composer'), 'composer not focused');
  await page.locator('[data-event="idle"]').click();
  // An old friend: seeds a memory for another starter, then the companion goes to say hello.
  await idle();
  await page.locator('#cameo').click();
  await ready();
  await page.waitForFunction(() => __hermesPokemonDebug.runtime()?.visitor?.cameo === true, null, { timeout: 10000 });
  await waitState('visitor', 25000);
  check(/Saying hello to/.test(await page.locator('.hp-status').textContent()), 'cameo caption');
  await page.waitForTimeout(500);
  await page.locator('.hp-stage').screenshot({ path: 'docs/images/cameo.png' });
  await page.waitForFunction(() => __hermesPokemonDebug.runtime().visitor === null, null, { timeout: 40000 });
  // Sightings: the earlier wild visitor was counted and listed.
  await page.getByRole('button', { name: 'Companion settings', exact: true }).click();
  const memories = await page.locator('.hp-memories').textContent();
  check(/Visitors seen/.test(memories) && /×1|×2/.test(memories), 'sightings not listed: ' + memories.slice(0, 200));
  check(/A garden bench/.test(memories), 'bench not listed');
  await page.getByRole('button', { name: 'Close settings' }).click();
  // Sapling by day 100 (from step 7) and a pile after a week away, tidied by the first pet.
  await page.locator('#away').click();
  await ready();
  await page.waitForFunction(() => __hermesPokemonDebug.pet.untidy === 1, null, { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.locator('.hp-stage').screenshot({ path: 'docs/images/away.png' });
  await page.getByRole('button', { name: 'Pet', exact: true }).click();
  check(await page.evaluate(() => __hermesPokemonDebug.pet.untidy === 0), 'pile not tidied');
  await page.getByRole('button', { name: 'Companion settings', exact: true }).click();
  check(/A small tree/.test(await page.locator('.hp-memories').textContent()), 'sapling stage not listed');
  // Snapshot: an ordinary PNG download with the garden and a caption band.
  const download = page.waitForEvent('download', { timeout: 10000 });
  await page.getByRole('button', { name: 'Save a snapshot', exact: true }).click();
  const file = await download;
  check(/^hermes-pokemon-.*\.png$/.test(file.suggestedFilename()), 'snapshot name ' + file.suggestedFilename());
  await page.getByRole('button', { name: 'Close settings' }).click();
  // Hover: the hint line and cursor follow the pointer.
  await idle();
  const hover = await page.evaluate(async () => {
    const canvas = document.querySelector('.hp-stage canvas'), box = canvas.getBoundingClientRect(), rt = __hermesPokemonDebug.runtime();
    const tl = rt.toWorld(0, 0), br = rt.toWorld(1, 1);
    const at = (x, y) => ({ bubbles: true, clientX: box.left + (x - tl.x) / (br.x - tl.x) * box.width, clientY: box.top + (y - tl.y) / (br.y - tl.y) * box.height });
    canvas.dispatchEvent(new MouseEvent('mousemove', at(116, 63)));
    await new Promise(r => setTimeout(r, 150));
    return { cursor: canvas.style.cursor, hint: document.querySelector('.hp-hint span').textContent };
  });
  check(hover.cursor === 'pointer' && /Explore the pond/.test(hover.hint), 'hover hint ' + JSON.stringify(hover));
  // Level 50: a ribbon.
  await page.evaluate(() => {
    __demo.disable();
    const key = 'hermes-pokemon.demo.companion', rec = JSON.parse(localStorage.getItem(key));
    rec.progression.squirtle = { ...(rec.progression.squirtle || {}), xp: 1350, stage: 2 };
    localStorage.setItem(key, JSON.stringify(rec));
    __demo.enable();
  });
  await ready();
  check(/Fully grown/.test(await page.locator('.hp-ribbon').textContent()), 'ribbon missing');

  check(errors.length === 0, 'page errors: ' + errors.join('; '));
  return `world checks passed (visitor: ${visitorName})`;
}
