// Preview-only: v0.6 rhythm features. Resets this origin's demo companion, never Hermes storage.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const ready = () => page.waitForFunction(() => document.querySelector('.hp-stage') && !document.querySelector('.hp-loading'));
  const state = () => page.evaluate(() => __hermesPokemonDebug.pet.state);
  const waitState = (s, timeout = 20000) => page.waitForFunction(s => __hermesPokemonDebug.pet.state === s, s, {timeout});
  await page.evaluate(() => { __demo.disable(); localStorage.removeItem('hermes-pokemon.demo.companion'); });
  await page.reload();
  await page.setViewportSize({width:1280,height:950});
  await page.waitForFunction(() => document.querySelectorAll('.hp-preview').length === 3);
  await page.getByRole('button',{name:/Charmander/}).click();
  await page.getByRole('textbox',{name:'A name for your new friend optional'}).fill('Dario');
  await page.getByRole('button',{name:'Meet your companion'}).click();
  await ready();

  // Seasons: calendar, hemisphere flip, every pinned season, persistence.
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  await page.getByRole('radio',{name:'Day',exact:true}).click();
  const month = new Date().getMonth();
  const north = month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'autumn' : 'winter';
  const south = {spring:'autumn',summer:'winter',autumn:'spring',winter:'summer'}[north];
  check((await page.locator('.hp-season small').first().textContent()).includes(`now ${north}`), 'Calendar season wrong');
  await page.getByLabel('Southern Hemisphere seasons').check();
  check((await page.locator('.hp-season small').first().textContent()).includes(`now ${south}`), 'Hemisphere flip wrong');
  await page.getByLabel('Southern Hemisphere seasons').uncheck();
  for (const season of ['Spring','Summer','Autumn','Winter']) {
    await page.getByRole('radio',{name:season,exact:true}).click();
    await page.getByRole('button',{name:'Close settings'}).click();
    await page.waitForTimeout(2500);
    check(await page.evaluate(s => __hermesPokemonDebug.pet.season === s, season.toLowerCase()), `${season} not applied`);
    await page.locator('.hp-stage').screenshot({path:`docs/images/season-${season.toLowerCase()}.png`});
    await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  }
  await page.getByRole('radio',{name:'Calendar',exact:true}).click();
  await page.getByRole('button',{name:'Close settings'}).click();
  await page.reload(); await ready();
  check(await page.evaluate(() => __demo.diagnostics().saved.season === 'auto' && __demo.diagnostics().saved.version === 6), 'Season/v6 save not persisted');

  // Long turn: company while it runs, a bigger cheer when it lands. Short turns stay ordinary.
  await page.locator('[data-event="long"]').click();
  await waitState('company');
  check(/long one/.test(await page.locator('.hp-status').innerText()), 'No company caption');
  await page.locator('[data-event="completed"]').click();
  check(await state() === 'proud', 'Long completion was not a bigger cheer');
  await page.waitForFunction(() => __hermesPokemonDebug.pet.state !== 'proud', null, {timeout:20000});
  await page.locator('[data-event="working"]').click();
  await page.locator('[data-event="completed"]').click();
  check(await state() === 'celebrating', 'Short completion changed');
  await page.waitForTimeout(4000);

  // Failed turns: a quiet nod; two in a row bring the ball over.
  await page.locator('[data-event="failed"]').click();
  check(await state() === 'steady' && !(await page.evaluate(() => __hermesPokemonDebug.pet.bubble)), 'Failure was not quiet');
  await page.waitForTimeout(3500);
  await page.locator('[data-event="failed"]').click();
  // A nap is never interrupted, so the offer can wait up to ~20 s for it to wake.
  await waitState('offering', 40000);
  await page.waitForFunction(() => !__hermesPokemonDebug.pet.inviting, null, {timeout:30000});

  // Keepsakes: rare by design, so the debug handle makes a find reproducible.
  let found = false;
  for (let i = 0; i < 25 && !found; i++) {
    await page.evaluate(() => { const p = __hermesPokemonDebug.pet; p.nextFindAt = 0; p.random = () => 0.01; p.investigate({x:92,y:88}, 'pond'); });
    await page.waitForTimeout(3000);
    found = await page.evaluate(() => __hermesPokemonDebug.pet.keepsakes.size > 0);
  }
  await page.evaluate(() => { __hermesPokemonDebug.pet.random = Math.random; });
  check(found, 'No keepsake found');
  await page.waitForTimeout(1500);
  await page.reload(); await ready();
  check(await page.evaluate(() => __demo.diagnostics().saved.memories.charmander.keepsakes.length === 1), 'Keepsake not saved');

  // Usual arrival: three earlier days at this time, then a return after 40 minutes away.
  await page.evaluate(() => {
    __demo.disable();
    const key = 'hermes-pokemon.demo.companion', rec = JSON.parse(localStorage.getItem(key));
    const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
    const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
    Object.assign(rec.memories.charmander, {arrivals:[[day-3,m],[day-2,m],[day-1,m]], lastSeenAt:Date.now()-40*60000, lastGreetingAt:Date.now()-60*60000, favoriteSpot:'flowers'});
    localStorage.setItem(key, JSON.stringify(rec));
    __demo.enable();
  });
  await ready();
  await waitState('expecting', 8000);
  await page.getByRole('button',{name:'Companion settings',exact:true}).click();
  const memories = await page.locator('.hp-memories').innerText();
  check(!/Still learning your rhythm/.test(memories) && /1 \/ 13/.test(memories), 'Usual time or keepsake missing from Settings');
  check(errors.length === 0, errors.join('\n'));
  return 'rhythm checks passed';
}
