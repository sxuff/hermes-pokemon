import { loadSprites, createRenderer, drawSprite } from "./renderer.js";
import { phaseForHour } from "./ambient.js";

const FPS = 30,
  REDUCED_FPS = 8;

// Each mounted canvas owns one scheduler. Visibility changes cancel the pending frame.
export function mountCanvas({ canvas, ctx, bridge, pet, species, reduced, sky = () => "auto", selected, memory, onStatus, onError, onReady }) {
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
    phaseCheck = 0;
  const disposers = [];
  const updatePhase = () => {
    const setting = sky();
    phase = setting === "auto" ? phaseForHour(new Date().getHours() + new Date().getMinutes() / 60) : setting;
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
      const status = `${pet.state}:${pet.busy}:${pet.caption}`;
      if (status !== lastStatus) {
        lastStatus = status;
        onStatus?.(pet);
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
      // Fixed small steps keep motion identical regardless of frame pacing.
      let remaining = dt;
      while (remaining > 0) {
        const s = Math.min(remaining, 0.05);
        pet.tick(s);
        remaining -= s;
      }
    }
    renderer?.tick(dt, phase, reduced());
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
    frame = requestAnimationFrame(loop);
  }
  function refresh() {
    stop();
    syncPresence();
    if (active()) {
      updatePhase();
      render();
      frame = requestAnimationFrame(loop);
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
  if (pet)
    disposers.push(
      bridge.activity.subscribe(() => {
        if (active()) pet.react(bridge.activity.get().kind);
      }),
    );
  loadSprites(species)
    .then((sprites) => {
      if (disposed) return;
      if (pet) {
        renderer = createRenderer(canvas, sprites, species);
        renderer.resize(canvas.getBoundingClientRect().width, Math.min(devicePixelRatio || 1, 3));
        draw = () => renderer.draw(pet, phase, reduced());
      } else {
        // Starter-card preview: idle with an occasional nod, a happy hop when chosen.
        const c = canvas.getContext("2d");
        canvas.width = 36;
        canvas.height = 42; // headroom for the happy hop
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
        if (active()) pet.react(bridge.activity.get().kind);
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
  };
}
