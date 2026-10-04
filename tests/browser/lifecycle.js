async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  await page.addInitScript(() => {
    const live = { frames: new Set(), observers: new Set(), listeners: new Map(), paints: 0 };
    const raf = requestAnimationFrame.bind(window), caf = cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = fn => { let id = raf(t => { live.frames.delete(id); fn(t); }); live.frames.add(id); return id; };
    window.cancelAnimationFrame = id => { live.frames.delete(id); return caf(id); };
    for (const name of ['ResizeObserver','IntersectionObserver']) {
      const Base = window[name];
      window[name] = class extends Base {
        observe(...args) { live.observers.add(this); return super.observe(...args); }
        disconnect() { live.observers.delete(this); return super.disconnect(); }
      };
    }
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, fn, options) {
      if ((this === document && type === 'visibilitychange') || (this === window && ['focus','blur','pagehide'].includes(type)) || (this instanceof MediaQueryList && type === 'change')) {
        if (!live.listeners.has(this)) live.listeners.set(this, new Set()); live.listeners.get(this).add(fn);
      }
      return add.call(this, type, fn, options);
    };
    EventTarget.prototype.removeEventListener = function(type, fn, options) { live.listeners.get(this)?.delete(fn); return remove.call(this, type, fn, options); };
    const transform = CanvasRenderingContext2D.prototype.setTransform;
    CanvasRenderingContext2D.prototype.setTransform = function(...args) { if (this.canvas.closest?.('.hp-stage')) live.paints++; return transform.apply(this,args); };
    window.__metrics = () => ({ frames: live.frames.size, observers: live.observers.size, listeners: [...live.listeners.values()].reduce((n,s) => n+s.size,0), paints: live.paints });
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.hp-stage') && !document.querySelector('.hp-loading'));
  await page.locator('.hp-stage').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const sample = () => page.evaluate(() => ({ ...__metrics(), ...__demo.diagnostics() }));
  const initial = await sample();
  await page.waitForTimeout(1000);
  const fps = (await sample()).paints - initial.paints;
  check(fps >= 24 && fps <= 34, `Draw budget unexpected: ${fps}`);
  await page.evaluate(() => __demo.setVisible(false));
  const hidden = await sample();
  const stoppedTime = await page.evaluate(() => __hermesPokemonDebug.pet.time);
  await page.waitForTimeout(550);
  const hiddenAfter = await sample();
  check(hiddenAfter.paints === hidden.paints && hiddenAfter.frames === 0, 'Hidden rendering continued');
  check(await page.evaluate(() => __hermesPokemonDebug.pet.time) === stoppedTime, 'Hidden simulation continued');
  await page.evaluate(() => __demo.setVisible(true));
  await page.waitForTimeout(250);
  check((await sample()).paints > hiddenAfter.paints, 'No resume');
  check(await page.evaluate(() => !__hermesPokemonDebug.pet.greetingActive), 'Quick hide manufactured welcome');
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => __demo.reload());
    await page.waitForFunction(() => document.querySelector('.hp-stage') && !document.querySelector('.hp-loading'));
  }
  await page.waitForTimeout(250);
  const reloaded = await sample();
  check(reloaded.frames === 1 && reloaded.observers === initial.observers && reloaded.listeners === initial.listeners && reloaded.subscriptions === initial.subscriptions && reloaded.styles === 1 && reloaded.canvases === 1, `Reload leaked: ${JSON.stringify(reloaded)}`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(180);
  check(await page.evaluate(() => __hermesPokemonDebug.pet.reduced), 'OS reduced motion ignored');
  await page.evaluate(() => { const p=__hermesPokemonDebug.pet; p.reset(); p.start([{kind:'pose',anim:'Idle',duration:5,state:'idle'}]); });
  await page.waitForTimeout(180);
  const still = await page.locator('.hp-stage canvas').evaluate(c => c.toDataURL());
  const quietStart = await sample();
  await page.waitForTimeout(700);
  check(still === await page.locator('.hp-stage canvas').evaluate(c => c.toDataURL()), 'Reduced idle moves');
  const quietFps = ((await sample()).paints - quietStart.paints) / .7;
  check(quietFps <= 10, `Quiet draw rate ${quietFps}`);
  await page.getByRole('button', { name: 'Throw ball' }).click();
  await page.waitForFunction(() => !__hermesPokemonDebug.pet.busy);
  await page.getByRole('button', { name: 'Simulate coming back' }).click();
  await page.waitForFunction(() => __hermesPokemonDebug.pet.greetingActive);
  const spot = await page.evaluate(() => ({ x:__hermesPokemonDebug.pet.x,y:__hermesPokemonDebug.pet.y }));
  await page.waitForFunction(() => !__hermesPokemonDebug.pet.greetingActive);
  check(await page.evaluate(p => __hermesPokemonDebug.pet.x === p.x && __hermesPokemonDebug.pet.y === p.y, spot), 'Quiet welcome traveled');
  await page.evaluate(() => { __demo.setVisible(false); __demo.disable(); });
  const disabled = await sample();
  check(disabled.frames === 0 && disabled.observers === 0 && disabled.listeners === 1 && disabled.subscriptions === 0 && disabled.styles === 0 && disabled.canvases === 0, `Disable leaked: ${JSON.stringify(disabled)}`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { __demo.setVisible(true); __demo.enable(); });
  await page.waitForFunction(() => document.querySelector('.hp-stage') && !document.querySelector('.hp-loading'));
  return { fps, quietFps, hiddenSimulationPaused:true, stableAfter15Reloads:true, initial, reloaded, disabled, disabledListenerIsDemoPagehide:true, reducedIdlePixelIdentical:true, quietFetchAndWelcome:true };
}
