// Run with Playwright CLI: run-code --filename=tests/browser/play.js
// Uses the demo's opt-in test handle to make a rare random moment reproducible.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const summaries = [];
  async function ready() { await page.waitForFunction(() => document.querySelector('.hp-stage') && !document.querySelector('.hp-loading')); }
  async function select(species, name) {
    await page.getByRole('button', {name:'Companion settings',exact:true}).click();
    await page.getByRole('button', {name:'Change starter',exact:true}).click();
    await page.getByRole('button', {name:new RegExp(species, 'i')}).click();
    await page.getByRole('textbox', {name:'A name for your new friend optional'}).fill(name);
    await page.getByRole('button', {name:'Welcome to the garden'}).click();
    await ready();
    await page.getByRole('button', {name:'Companion settings',exact:true}).click();
    await page.getByRole('radio', {name:'Day',exact:true}).click();
    await page.getByRole('button', {name:'Close settings'}).click();
  }
  for (const [species, name] of [['bulbasaur','Sprout'],['charmander','Dario'],['squirtle','Brook']]) {
    await select(species, name);
    await page.evaluate(() => { const p=__hermesPokemonDebug.pet; p.reset(); p.time=100; p.lastAttention=0; p.nextInvitationAt=0; p.choose(); });
    await page.waitForFunction(() => __hermesPokemonDebug.pet.inviting && __hermesPokemonDebug.pet.ball?.phase === 'invitation-roll');
    check(!await page.getByRole('button', {name:'Throw ball'}).isDisabled(), 'Invitation blocks player input');
    await page.waitForTimeout(450);
    await page.locator('.demo-pane').screenshot({path:`output/playwright/v04-${species}-invitation.png`});
    summaries.push(await page.evaluate(() => ({species:__hermesPokemonDebug.pet.species,state:__hermesPokemonDebug.pet.state,ball:__hermesPokemonDebug.pet.ball.phase})));
    await page.getByRole('button', {name:'Throw ball'}).click();
    check(await page.evaluate(() => __hermesPokemonDebug.pet.fetching && !__hermesPokemonDebug.pet.inviting), 'Invitation did not become fetch');
    await page.evaluate(() => { __demo.simulate('working'); __demo.simulate('completed'); });
    await page.getByRole('button', {name:'Pet',exact:true}).click();
    await page.waitForFunction(() => !__hermesPokemonDebug.pet.busy);
    await page.evaluate(() => { __demo.simulate('idle'); __hermesPokemonDebug.pet.reset(); });
    const c=page.locator('.hp-stage canvas'), box=await c.boundingBox();
    const point=species==='bulbasaur' ? {x:22,y:98} : species==='charmander' ? {x:27,y:25} : {x:116,y:63};
    await c.click({position:{x:box.width*point.x/160,y:box.height*point.y/120}});
    await page.waitForFunction(() => __hermesPokemonDebug.pet.state === 'investigating');
    await page.waitForFunction(() => { const p=__hermesPokemonDebug.pet; return p.state==='investigating' && p.step?.kind==='pose' && p.elapsed>.4; });
    check(await page.evaluate(() => __hermesPokemonDebug.pet.favoriteSpot !== null), 'Scenery attention did not persist');
    await page.waitForFunction(() => __hermesPokemonDebug.pet.state !== 'investigating');
    check(await page.evaluate(() => !__hermesPokemonDebug.pet.ball && !__hermesPokemonDebug.pet.treat), 'Interaction left a prop');
  }
  await page.evaluate(() => { const p=__hermesPokemonDebug.pet; p.reset(); p.time+=200; p.lastAttention=0; p.nextInvitationAt=0; p.choose(); });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(() => __hermesPokemonDebug.pet.reduced);
  check(await page.evaluate(() => !__hermesPokemonDebug.pet.inviting && !__hermesPokemonDebug.pet.ball), 'Quiet mode failed to cancel invitation');
  const position=await page.evaluate(() => ({x:__hermesPokemonDebug.pet.x,y:__hermesPokemonDebug.pet.y}));
  await page.evaluate(() => __hermesPokemonDebug.pet.investigate({x:27,y:25},'tree'));
  await page.waitForFunction(() => __hermesPokemonDebug.pet.state !== 'investigating');
  check(await page.evaluate(pos => {const p=__hermesPokemonDebug.pet;return p.x===pos.x&&p.y===pos.y;},position), 'Quiet investigation traveled');
  await page.emulateMedia({reducedMotion:'no-preference'});
  check(errors.length===0,errors.join('\n'));
  return {species:summaries,invitationToFetch:true,sceneryClicks:true,quietCancellation:true,quietInvestigationStill:true,errors};
}
