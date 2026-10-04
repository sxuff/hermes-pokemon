// Run after smoke.js. Demo-only fast-forward buttons never touch Hermes storage.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const ready = () => page.waitForFunction(() => document.querySelector('.hp-stage') && !document.querySelector('.hp-loading'));
  async function select(species, nickname) {
    await page.getByRole('button',{name:'Companion settings',exact:true}).click();
    await page.getByRole('button',{name:'Change starter',exact:true}).click();
    await page.getByRole('button',{name:new RegExp(species,'i')}).click();
    await page.getByRole('textbox',{name:'A name for your new friend optional'}).fill(nickname);
    await page.getByRole('button',{name:'Welcome to the garden'}).click();
    await ready();
  }
  const results=[];
  for(const [species,nickname,forms] of [['bulbasaur','Sprout',['ivysaur','venusaur']],['squirtle','Brook',['wartortle','blastoise']],['charmander','Dario',['charmeleon','charizard']]]) {
    await select(species,nickname);
    for(const [index,form] of forms.entries()) {
      await page.getByRole('button',{name:'Preview evolution',exact:true}).click();
      await ready();
      await page.getByRole('button',{name:/Ready to evolve into/}).click();
      await page.getByRole('button',{name:'Not now',exact:true}).click();
      check(await page.evaluate(i=>__hermesPokemonDebug.pet.form===i, index?forms[0]:species),'Declining changed form');
      await page.getByRole('button',{name:/Ready to evolve into/}).click();
      await page.waitForFunction(()=>__hermesPokemonDebug.pet.canEvolve);
      const before=await page.evaluate(()=>({x:__hermesPokemonDebug.pet.x,y:__hermesPokemonDebug.pet.y}));
      await page.getByRole('button',{name:new RegExp('^Evolve into '+form+'$','i')}).click();
      check(await page.getByRole('button',{name:'Pet',exact:true}).isDisabled(),'Pet interrupts evolution');
      await page.waitForFunction(id=>__hermesPokemonDebug.pet.form===id,form);
      await ready();
      check(await page.evaluate(p=>Math.hypot(__hermesPokemonDebug.pet.x-p.x,__hermesPokemonDebug.pet.y-p.y)<2,before),'Evolution teleported');
      check(await page.locator('.hp-growth-notice').innerText().then(t=>t.includes('Evolved into')),'No evolution announcement');
      await page.locator('.demo-pane').screenshot({path:`output/playwright/v05-${form}.png`});
      await page.getByRole('button',{name:'Reload plugin',exact:true}).click();
      await ready();
      check(await page.evaluate(({id,name})=>__hermesPokemonDebug.pet.form===id&&__demo.diagnostics().saved.nickname===name,{id:form,name:nickname}),'Evolution or nickname lost on reload');
      results.push(form);
    }
    await page.getByRole('button',{name:'Throw ball',exact:true}).click();
    await page.waitForFunction(()=>!__hermesPokemonDebug.pet.busy);
    check(await page.evaluate(()=>!__hermesPokemonDebug.pet.ball),'Evolved fetch left a ball');
  }
  await page.reload();
  await ready();
  check(await page.evaluate(()=>Object.values(__demo.diagnostics().saved.progression).every(p=>p.stage===2)),'Switching lost a lineage');
  await page.locator('#width').fill('240');
  await page.locator('#width').dispatchEvent('input');
  const narrow=await page.locator('.hp-root').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));
  check(narrow.width===narrow.scroll,'Evolved narrow pane overflows');
  await page.locator('.demo-pane').screenshot({path:'output/playwright/v05-charizard-narrow.png'});
  await page.locator('#width').fill('370');
  await page.locator('#width').dispatchEvent('input');
  await page.screenshot({path:'docs/images/evolution.png',fullPage:true});
  check(errors.length===0,errors.join('\n'));
  return {evolvedForms:results,decline:true,positionPreserved:true,reloadPersistence:true,evolvedFetch:true,separateLineages:true,narrow,errors};
}
