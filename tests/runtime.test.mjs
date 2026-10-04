import test from "node:test";
import assert from "node:assert/strict";
import { mountCanvas } from "../src/runtime.js";
import { Companion } from "../src/behavior.js";
import { assets } from "../src/assets.generated.js";
import { SPOTS } from "../src/world.js";

function eventHub() {
  const handlers = new Map();
  return {
    addEventListener(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
    },
    removeEventListener(name, fn) { handlers.get(name)?.delete(fn); },
    emit(name) { for (const fn of handlers.get(name) || []) fn(); },
    count() { return [...handlers.values()].reduce((sum, set) => sum + set.size, 0); },
  };
}
function signal(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) { value = next; for (const listener of listeners) listener(); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    count: () => listeners.size,
  };
}

async function fixture({ pet = new Companion("bulbasaur"), species = pet?.species, form, onEvolutionComplete } = {}) {
  const originals = new Map(), frames = new Map(), imagesDrawn = [], observers = [];
  let now = 100, nextFrame = 1, focused = true, seconds = 0, memoryDisposed = 0;
  const statuses = [];
  const context = () => new Proxy({ globalAlpha: 1, drawImage(image) { imagesDrawn.push(image); } }, {
    get: (target, key) => key in target ? target[key] : () => {},
  });
  const canvasFactory = () => {
    const drawing = context();
    return {
      width: 160, height: 120, clientWidth: 320, clientHeight: 240,
      getBoundingClientRect: () => ({ width: 320, height: 240 }),
      getContext: () => drawing,
    };
  };
  const document = { ...eventHub(), hidden: false, hasFocus: () => focused, createElement: () => canvasFactory() };
  const window = eventHub();
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() { this.callback([{ isIntersecting: true }]); }
    disconnect() { this.disconnected = true; }
  }
  const globals = {
    document, window, devicePixelRatio: 1, ResizeObserver: Observer, IntersectionObserver: Observer,
    requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    Image: class { set src(value) { this.url = value; queueMicrotask(() => this.onload?.()); } get src() { return this.url; } },
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const bridge = { visible: signal(true), activity: signal({ kind: "idle" }) };
  const ctx = { runtimes: new Set() };
  const canvas = canvasFactory();
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const memory = {
    flush() {}, checkpoint() {}, setPresent() {},
    tick(dt) { seconds += dt; }, dispose() { memoryDisposed++; },
  };
  const runtime = mountCanvas({
    canvas, ctx, bridge, pet, species, form, reduced: () => false, sky: () => "day", memory,
    onStatus: (value) => statuses.push({ state: value.state, canEvolve: value.canEvolve, evolving: value.evolving }),
    onReady: readyResolve, onError: readyReject, onEvolutionComplete,
  });
  function restore() {
    runtime.dispose();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
  try { await ready; } catch (error) { restore(); throw error; }
  return {
    pet, runtime, bridge, ctx, frames, document, window, observers, imagesDrawn, statuses, canvas,
    get seconds() { return seconds; }, get memoryDisposed() { return memoryDisposed; },
    focus(value) { focused = value; window.emit(value ? "focus" : "blur"); },
    hide(value) { document.hidden = value; document.emit("visibilitychange"); },
    run(count) {
      for (let i = 0; i < count; i++) {
        now += 50;
        const scheduled = [...frames.values()];
        frames.clear();
        for (const callback of scheduled) callback(now);
      }
    },
    restore,
  };
}

test("runtime loads the evolved form while retaining its starter lineage", async () => {
  const pet = new Companion("charmander", Math.random, { form: "charizard" });
  const f = await fixture({ pet, species: "charmander", form: "charizard" });
  try {
    f.run(4);
    assert.equal(pet.species, "charmander");
    assert.ok(f.imagesDrawn.some((image) => image.src === assets.charizard.Idle.url));
    assert.ok(!f.imagesDrawn.some((image) => image.src === assets.charmander.Idle.url));
    assert.ok(f.statuses.some((status) => status.canEvolve === false), "final form is not evolution-ready");
  } finally { f.restore(); }
});

test("completion can synchronously dispose a runtime without scheduling a leaked frame", async () => {
  const completions = [];
  let f;
  f = await fixture({
    pet: new Companion("bulbasaur", Math.random, { position: SPOTS.meadow }),
    onEvolutionComplete(position) { completions.push(position); f.runtime.dispose(); },
  });
  try {
    assert.ok(f.pet.beginEvolution());
    f.runtime.refresh();
    f.run(80);
    assert.deepEqual(completions, [{ ...SPOTS.meadow }]);
    assert.equal(f.frames.size, 0);
    assert.equal(f.ctx.runtimes.size, 0);
    assert.equal(f.document.count(), 0);
    assert.equal(f.window.count(), 0);
    assert.equal(f.bridge.visible.count(), 0);
    assert.equal(f.bridge.activity.count(), 0);
    assert.ok(f.observers.every((observer) => observer.disconnected));
    assert.equal(f.memoryDisposed, 1);
    assert.ok(f.statuses.some((status) => status.evolving && !status.canEvolve));
    f.runtime.dispose();
    assert.equal(f.memoryDisposed, 1);
  } finally { f.restore(); }
});

test("hidden evolution pauses and resumes before emitting exactly one completion", async () => {
  const completions = [];
  const f = await fixture({ onEvolutionComplete: (event) => completions.push(event) });
  try {
    f.pet.beginEvolution();
    f.runtime.refresh();
    f.run(15);
    f.hide(true);
    const time = f.pet.time;
    f.run(100);
    assert.equal(f.pet.time, time);
    assert.equal(f.frames.size, 0);
    assert.deepEqual(completions, []);
    f.hide(false);
    f.run(60);
    assert.equal(completions.length, 1);
    f.runtime.refresh();
    f.run(30);
    assert.equal(completions.length, 1);
  } finally { f.restore(); }
});

test("disable during evolution cancels the transition and cannot commit on reload", async () => {
  const completions = [];
  const f = await fixture({ onEvolutionComplete: (event) => completions.push(event) });
  try {
    f.pet.beginEvolution();
    f.runtime.refresh();
    f.run(12);
    const hostDispose = [...f.ctx.runtimes][0];
    hostDispose();
    assert.equal(f.pet.evolving, false);
    assert.deepEqual(f.pet.drainEvolution(), []);
    f.run(100);
    f.runtime.refresh();
    assert.equal(f.frames.size, 0);
    assert.deepEqual(completions, []);
    assert.equal(f.memoryDisposed, 1);
  } finally { f.restore(); }
});

test("active time is counted only for a visible, focused, loaded habitat", async () => {
  const f = await fixture();
  try {
    f.run(20);
    assert.ok(f.seconds > 0.8 && f.seconds < 1.1);
    f.focus(false);
    const before = f.seconds;
    f.run(40);
    assert.equal(f.seconds, before, "an unfocused window cannot gain active time");
    f.focus(true);
    f.bridge.visible.set(false);
    f.run(40);
    assert.equal(f.seconds, before, "a hidden plugin pane cannot gain active time");
    f.bridge.visible.set(true);
    f.run(20);
    assert.ok(f.seconds > before + 0.8);
    f.runtime.dispose();
    const disposed = f.seconds;
    f.run(40);
    assert.equal(f.seconds, disposed);
  } finally { f.restore(); }
});

test("evolved-card previews load by form id without a pet or starter-only metadata", async () => {
  const f = await fixture({ pet: null, species: "charmeleon" });
  try {
    assert.ok(f.imagesDrawn.some((image) => image.src === assets.charmeleon.Idle.url));
    assert.ok(f.canvas.width >= 36 && f.canvas.height >= 46);
    f.run(20);
    assert.equal(f.seconds, 0, "preview cards do not count as companion activity");
  } finally { f.restore(); }
});
