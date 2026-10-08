// Preview-only migration and XP check, including one real active minute.
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const ready = () => page.waitForFunction(() => document.querySelector('.hp-stage') && !document.querySelector('.hp-loading'));
  await page.evaluate(() => {
    __demo.disable();
    localStorage.setItem('hermes-pokemon.demo.companion',JSON.stringify({version:3,species:'charmander',nickname:'Dario',motion:'system',sky:'day',memories:{charmander:{favoriteSpot:'sun',lastInteraction:{kind:'berry',at:Date.now()},lastSeenAt:Date.now(),lastGreetingAt:0}}}));
  });
  await page.reload(); await ready();
  await page.locator('.hp-stage').scrollIntoViewIfNeeded();
  check(await page.evaluate(()=>document.hasFocus()),'Preview lacks focus');
  const migrated=await page.evaluate(()=>__demo.diagnostics().saved);
  check(migrated.version===6 && migrated.nickname==='Dario' && migrated.memories.charmander.favoriteSpot==='sun','Migration lost existing companion');
  await page.waitForFunction(()=>__demo.diagnostics().saved.progression?.charmander?.xp===3,null,{timeout:75000});
  await page.getByRole('button',{name:'Pet',exact:true}).click();
  const xp=await page.evaluate(()=>__demo.diagnostics().saved.progression.charmander.xp);
  check(xp===5,'First pet XP missing');
  await page.waitForTimeout(600);
  await page.getByRole('button',{name:'Pet',exact:true}).click();
  check(await page.evaluate(()=>__demo.diagnostics().saved.progression.charmander.xp)===xp,'Pet spam rewarded');
  await page.getByRole('button',{name:'Reload plugin',exact:true}).click(); await ready();
  await page.getByRole('button',{name:'Pet',exact:true}).click();
  check(await page.evaluate(()=>__demo.diagnostics().saved.progression.charmander.xp)===xp,'Reload reset cooldown');
  await page.evaluate(()=>__demo.setVisible(false));
  const hidden=await page.evaluate(()=>__demo.diagnostics().saved.progression.charmander);
  await page.waitForTimeout(1200);
  check(JSON.stringify(hidden)===await page.evaluate(()=>JSON.stringify(__demo.diagnostics().saved.progression.charmander)),'Hidden time earned growth');
  await page.evaluate(()=>__demo.setVisible(true));
  // Put the demo just below a level, then earn the final XP with the real Pet button.
  await page.evaluate(()=>{ __demo.disable(); const key='hermes-pokemon.demo.companion',r=JSON.parse(localStorage.getItem(key)); r.progression.charmander={xp:29,stage:0,rewardedAt:{},togetherSeconds:0};localStorage.setItem(key,JSON.stringify(r));__demo.enable(); });
  await ready();
  await page.getByRole('button',{name:'Pet',exact:true}).click();
  check((await page.locator('.hp-growth-notice').innerText()).includes('Level 6'),'Level-up feedback missing');
  await page.getByRole('button',{name:'Preview evolution',exact:true}).click(); await ready();
  await page.getByRole('button',{name:/Ready to evolve into/}).click();
  await page.waitForFunction(()=>__hermesPokemonDebug.pet.canEvolve);
  await page.getByRole('button',{name:'Evolve into Charmeleon',exact:true}).click();
  await page.getByRole('button',{name:'Reload plugin',exact:true}).click(); await ready();
  check(await page.evaluate(()=>__hermesPokemonDebug.pet.form==='charmander'),'Interrupted evolution persisted early');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:/Ready to evolve into/}).click();
  await page.waitForFunction(()=>__hermesPokemonDebug.pet.canEvolve);
  await page.getByRole('button',{name:'Evolve into Charmeleon',exact:true}).click();
  await page.evaluate(()=>__demo.setVisible(false));
  const oldTime=await page.evaluate(()=>__hermesPokemonDebug.pet.time);
  await page.waitForTimeout(2300);
  check(await page.evaluate(t=>__hermesPokemonDebug.pet.time===t&&__hermesPokemonDebug.pet.form==='charmander',oldTime),'Hidden evolution advanced');
  await page.evaluate(()=>__demo.setVisible(true));
  await page.waitForFunction(()=>__hermesPokemonDebug.pet.form==='charmeleon');
  await ready();
  check(await page.evaluate(()=>__hermesPokemonDebug.pet.reduced),'Evolved form lost reduced motion');
  await page.emulateMedia({reducedMotion:'no-preference'});
  return {v3Migration:true,realActiveMinuteXP:3,petXP:2,spamAndReloadCooldown:true,hiddenNoGrowth:true,levelUpNotice:true,reloadCancelsEvolution:true,hiddenEvolutionPaused:true,reducedEvolution:true};
}
