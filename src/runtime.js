import { loadSprites, createRenderer, drawSprite } from "./renderer.js";
import { phaseForHour, moonPhase } from "./ambient.js";
import { FORMS } from "./species.js";
import { animMeta } from "./anim-meta.generated.js";
import { resolveSeason } from "./seasons.js";
import { LONG_TURN_MS } from "./hermes.js";
import { resolveWeather, isLateNight } from "./weather.js";
import { Visitors, VISITORS } from "./visitors.js";
import { saplingStage } from "./milestones.js";

async function loadVisitorSprites(cameos = []) {
  // Wild visitors by species, cameos by the form your other starter has reached.
  const sheets = [...Object.keys(VISITORS), ...cameos.map((c) => c?.form).filter((form) => typeof form === "string" && Object.hasOwn(FORMS, form))];
  const entries = await Promise.all([...new Set(sheets)].map(async (id) => [id, await loadSprites(id)]));
  return Object.fromEntries(entries);
}

const FPS = 30,
  REDUCED_FPS = 8;

// Each mounted canvas owns one scheduler. Visibility changes cancel the pending frame.
export function mountCanvas({ canvas, ctx, bridge, pet, species, form, reduced, sky = () => "auto", season = () => ({ setting: "auto", hemisphere: "north" }), weather = () => "auto", placed = () => [], rewards = () => [], focus = () => null, cameos = () => [], days = () => 0, selected, memory, onStatus, onError, onReady, onEvolutionComplete }) {
  const assetForm = pet?.form || form || species;
  let disposed = false,
    ready = false,
    frame = 0,
    last = 0,
    pending = 0,
    inView = false,
    renderer,
    draw,
    lastStatus = "",
    phase = "day",
    currentSeason = "summer",
    currentWeather = "clear",
    currentSapling = 0,
    phaseCheck = 0;
  const visitors = pet ? new Visitors() : null;
  // Starters you have raised before, fixed at mount so their sheets are loaded once.
  const cameoList = pet ? (Array.isArray(cameos()) ? cameos() : []) : [];
  const disposers = [];
  const updatePhase = () => {
    const setting = sky(), s = season(), date = new Date();
    currentSeason = resolveSeason(s?.setting, s?.hemisphere);
    // Day length follows the season, and the moon keeps its real phase.
    phase = setting === "auto" ? phaseForHour(date.getHours() + date.getMinutes() / 60, currentSeason) : setting;
    renderer?.setMoon(moonPhase(date), s?.hemisphere === "south");
    currentWeather = resolveWeather(weather(), currentSeason);
    if (pet) {
      pet.season = currentSeason;
      pet.weather = currentWeather;
      pet.lateNight = isLateNight(new Date());
      const ids = placed();
      pet.placed = Array.isArray(ids) ? ids.filter((id) => pet.keepsakes.has(id)) : [];
      const earned = rewards();
      pet.rewards = Array.isArray(earned) ? earned.filter((id) => typeof id === "string") : [];
      pet.phase = phase;
      visitors?.setCameos(cameoList);
      currentSapling = saplingStage(days());
    }
  };
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    pending = 0;
  }
  function active() {
    return !disposed && ready && !document.hidden && inView && bridge.visible.get() && canvas.clientWidth > 0 && canvas.clientHeight > 0;
  }
  function render() {
    if (!ready || disposed) return;
    draw();
    memory?.flush();
    if (pet) {
      const status = `${pet.state}:${pet.busy}:${pet.caption}:${pet.canEvolve}:${pet.evolving}:${pet.keepsakes?.size}`;
      if (status !== lastStatus) {
        lastStatus = status;
        onStatus?.(pet);
      }
      if (onEvolutionComplete && !disposed) {
        const completion = pet.drainEvolution()[0];
        if (completion) onEvolutionComplete(completion);
      }
    }
  }
  function step(dt) {
    phaseCheck -= dt;
    if (phaseCheck <= 0) {
      phaseCheck = 20;
      updatePhase();
    }
    if (pet) {
      pet.setReduced(reduced());
      // A long turn is still running: come and sit with the user until it ends.
      const now = bridge.activity.get();
      if ((now.kind === "working" || now.kind === "waiting") && typeof now.since === "number" &&
          (bridge.now?.() ?? Date.now()) - now.since >= LONG_TURN_MS) pet.beginCompany?.();
      // Fixed small steps keep motion identical regardless of frame pacing.
      let remaining = dt;
      while (remaining > 0) {
        const s = Math.min(remaining, 0.05);
        pet.tick(s);
        remaining -= s;
      }
    }
    renderer?.tick(dt, phase, reduced(), currentSeason, currentWeather);
    if (visitors) {
      visitors.tick(dt, { phase, season: currentSeason, weather: currentWeather, reduced: reduced() });
      for (const event of visitors.drain()) {
        if (event.type === "arrived") pet.watchVisitor(event);
        else if (event.type === "splash") pet.emit("splash", { x: event.x, y: event.y });
      }
    }
    if (pet && active() && document.hasFocus()) memory?.tick?.(dt);
    memory?.checkpoint();
  }
  function loop(now) {
    frame = 0;
    if (!active()) return stop();
    const dt = last ? Math.min((now - last) / 1000, 0.25) : 0;
    last = now;
    pending += dt;
    const interval = 1 / (reduced() ? REDUCED_FPS : FPS);
    // rAF wakes at display rate; we only simulate+draw at our budget.
    if (pending >= interval - 0.004 || !dt) {
      step(Math.min(pending, 0.25));
      pending = 0;
      render();
    }
    if (active()) frame = requestAnimationFrame(loop);
  }
  function refresh() {
    stop();
    syncPresence();
    if (active()) {
      updatePhase();
      render();
      if (active()) frame = requestAnimationFrame(loop);
    }
  }
  function syncPresence() { memory?.setPresent(active() && document.hasFocus()); }
  const resize = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 3);
    if (renderer) renderer.resize(rect.width, dpr);
    refresh();
  });
  resize.observe(canvas);
  const intersection = new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    refresh();
  });
  intersection.observe(canvas);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", syncPresence);
  window.addEventListener("blur", syncPresence);
  window.addEventListener("pagehide", leave);
  function leave() { memory?.setPresent(false); }
  disposers.push(bridge.visible.subscribe(refresh));
  if (pet && bridge.tool?.subscribe)
    disposers.push(bridge.tool.subscribe(() => { if (active()) pet.reactToTool(bridge.tool.get().kind); }));
  if (pet && bridge.elsewhere?.subscribe)
    disposers.push(bridge.elsewhere.subscribe(() => { if (active()) pet.noticeElsewhere?.(); }));
  if (pet)
    disposers.push(
      bridge.activity.subscribe(() => {
        const now = bridge.activity.get();
        if (active()) pet.react(now.kind, now);
        // A turn that ends while hidden must not leave the companion keeping company.
        else if (!["working", "waiting"].includes(now.kind)) pet.endCompany?.();
      }),
    );
  Promise.all([loadSprites(assetForm), pet ? loadVisitorSprites(cameoList) : {}])
    .then(([sprites, visitorSprites]) => {
      if (disposed) return;
      if (pet) {
        renderer = createRenderer(canvas, sprites, species, assetForm, visitorSprites);
        renderer.resize(canvas.getBoundingClientRect().width, Math.min(devicePixelRatio || 1, 3));
        draw = () => renderer.draw(pet, phase, reduced(), currentSeason, { weather: currentWeather, placed: pet.placed, rewards: pet.rewards, visitor: visitors?.current, focus: focus(), sapling: currentSapling });
      } else {
        // Starter-card preview: idle with an occasional nod, a happy hop when chosen.
        const c = canvas.getContext("2d");
        const evolved = FORMS[assetForm]?.stage > 0;
        canvas.width = evolved ? Math.max(36, sprites.Idle.width + 8) : 36;
        canvas.height = evolved ? Math.max(42, (animMeta[assetForm].visualHeight || sprites.Idle.height) + 16) : 42; // headroom for the happy hop
        let clock = 0,
          anim = "Idle",
          once = false,
          wasSelected = selected?.(),
          lastTime = performance.now();
        draw = () => {
          const now = performance.now(),
            dt = Math.min(0.1, (now - lastTime) / 1000);
          lastTime = now;
          const isSelected = selected?.();
          if (isSelected && !wasSelected) [anim, once, clock] = ["Hop", true, 0];
          wasSelected = isSelected;
          clock += dt * 60;
          const length = sprites[anim].durations.reduce((a, b) => a + b, 0);
          if (once && clock > length + 12) [anim, once, clock] = ["Idle", false, 0];
          if (!once && anim === "Idle" && clock > 360) [anim, once, clock] = ["Nod", true, 0];
          // Drawn at art resolution; CSS upscales with pixelated sampling, like the garden.
          c.clearRect(0, 0, canvas.width, canvas.height);
          c.imageSmoothingEnabled = false;
          drawSprite(c, sprites, anim, clock, 0, canvas.width / 2, canvas.height - 4, { once, reduced: reduced() });
        };
      }
      ready = true;
      if (pet) {
        pet.setReduced(reduced());
        const now = bridge.activity.get();
        // Only ongoing work is replayed on load; a stale completion must not cheer again.
        if (active() && ["working", "waiting"].includes(now.kind)) pet.react(now.kind, now);
      }
      onReady?.();
      refresh();
    })
    .catch((error) => {
      console.error("[hermes-pokemon]", error);
      if (!disposed) onError?.("The bundled sprites could not be loaded. Reload the plugin to try again.");
    });
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    resize.disconnect();
    intersection.disconnect();
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", syncPresence);
    window.removeEventListener("blur", syncPresence);
    window.removeEventListener("pagehide", leave);
    memory?.dispose();
    pet?.cancelEvolution();
    disposers.forEach((fn) => fn());
  }
  // Registration-level disposal also covers a disable before React unmounts.
  ctx.runtimes.add(dispose);
  return {
    dispose() {
      dispose();
      ctx.runtimes.delete(dispose);
    },
    refresh,
    toWorld: (fx, fy) => renderer?.toWorld(fx, fy) ?? { x: fx * 160, y: fy * 120 },
    get phase() {
      return phase;
    },
    get season() {
      return currentSeason;
    },
    get weather() {
      return currentWeather;
    },
    // Preview/testing only: start a specific visit now.
    summonVisitor: (id) => visitors?.summon({ phase, season: currentSeason, weather: currentWeather }, id) ?? false,
    get visitor() {
      return visitors?.current ?? null;
    },
    // Preview/testing only: tonight's moon as the renderer has it.
    get moon() {
      return renderer?.ambient.moon ?? null;
    },
  };
}
