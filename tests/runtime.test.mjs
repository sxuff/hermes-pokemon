import test from "node:test";
import assert from "node:assert/strict";
import { mountCanvas } from "../src/runtime.js";
import { Companion } from "../src/behavior.js";
import { createPersistence } from "../src/persistence.js";
import { createCompanionMemory } from "../src/companion-memory.js";

// These stubs verify scheduling and lifecycle, not canvas appearance. The actual
// renderer still executes against a no-op drawing context; browser checks cover pixels.
function browser(t) {
  const saved = new Map(), frames = new Map(), images = [], observers = [];
  let frameId = 0;
  const events = () => {
    const listeners = new Map();
    return {
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      dispatch(type) { for (const fn of listeners.get(type) || []) fn(); },
      listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
    };
  };
  function canvas() {
    const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
    return {
      width: 640, height: 480, clientWidth: 350, clientHeight: 262.5,
      getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight }; },
      getContext: () => context,
    };
  }
  const doc = { ...events(), hidden: false, focused: true, hasFocus() { return this.focused; }, createElement: canvas };
  const win = events();
  function observer(kind) {
    return class {
      constructor(callback) { this.kind = kind; this.callback = callback; this.connected = false; observers.push(this); }
      observe(target) { this.target = target; this.connected = true; }
      disconnect() { this.connected = false; }
      deliver(value) { if (this.connected) this.callback(kind === "intersection" ? [{ isIntersecting: value }] : []); }
    };
  }
  const globals = {
    document: doc, window: win, devicePixelRatio: 1,
    requestAnimationFrame: (fn) => { const id = ++frameId; frames.set(id, fn); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: observer("resize"), IntersectionObserver: observer("intersection"),
    Image: class { constructor() { images.push(this); } set src(value) { this.url = value; } },
  };
  for (const [name, value] of Object.entries(globals)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return {
    doc, win, canvas: canvas(), frames, observers,
    intersection(value) { observers.filter((o) => o.kind === "intersection").forEach((o) => o.deliver(value)); },
    resize() { observers.filter((o) => o.kind === "resize").forEach((o) => o.deliver()); },
    async load() { images.splice(0).forEach((im) => im.onload()); await new Promise((resolve) => setImmediate(resolve)); },
    frame(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn(time)); },
  };
}

function atom(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) { value = next; [...listeners].forEach((fn) => fn()); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    count: () => listeners.size,
  };
}
function fixture(species, now) {
  const store = createPersistence({ get: (_, fallback) => fallback, set() {} });
  const pet = new Companion(species, () => 0.5);
  const memory = createCompanionMemory({ store, species, pet, now });
  const ctx = { runtimes: new Set() };
  const bridge = { visible: atom(true), activity: atom({ kind: "idle" }) };
  return { store, pet, memory, ctx, bridge, species, reduced: () => false };
}
function assertClean(b, f) {
  assert.equal(b.frames.size, 0);
  assert.ok(b.observers.every((o) => !o.connected));
  assert.equal(b.doc.listenerCount(), 0);
  assert.equal(b.win.listenerCount(), 0);
  assert.equal(f.bridge.visible.count(), 0);
  assert.equal(f.bridge.activity.count(), 0);
}

test("loaded sprites do not greet or animate before the first visible intersection", async (t) => {
  const b = browser(t), f = fixture("bulbasaur", () => 1_000_000);
  f.store.remember(f.species, { lastSeenAt: 900_000 });
  const runtime = mountCanvas({ canvas: b.canvas, ...f });
  t.after(runtime.dispose);
  await b.load();
  assert.equal(b.frames.size, 0);
  assert.equal(f.pet.greetingActive, false);
  assert.equal(f.store.getMemory(f.species).lastSeenAt, 900_000);
  b.intersection(false);
  assert.equal(f.store.getMemory(f.species).lastGreetingAt, 0);
  b.intersection(true);
  assert.equal(f.pet.greetingActive, true);
  assert.equal(f.store.getMemory(f.species).lastGreetingAt, 1_000_000);
  assert.equal(b.frames.size, 1);
  const step = f.pet.step;
  for (let i = 0; i < 10; i++) { b.resize(); runtime.refresh(); }
  assert.equal(f.pet.step, step, "resize and refresh do not restart the greeting");
  assert.equal(b.frames.size, 1, "refresh replaces, rather than multiplies, frames");
  runtime.dispose();
  assertClean(b, f);
  assert.equal(f.ctx.runtimes.size, 0);
});

test("disable before sprite loading finishes prevents every late callback and frame", async (t) => {
  const b = browser(t), f = fixture("squirtle", () => 1_000_000);
  let ready = 0, errors = 0;
  const runtime = mountCanvas({ canvas: b.canvas, ...f, onReady: () => ready++, onError: () => errors++ });
  b.intersection(true);
  // Match the host's registration-level teardown before React unmounts.
  f.ctx.runtimes.forEach((dispose) => dispose());
  f.ctx.runtimes.clear();
  runtime.dispose();
  await b.load();
  assert.equal(ready, 0);
  assert.equal(errors, 0);
  assert.equal(f.store.getMemory(f.species).lastSeenAt, 0);
  assertClean(b, f);
  assert.equal(f.ctx.runtimes.size, 0);
});

test("hidden and unfocused presence defers a welcome until focus, then cleans up idempotently", async (t) => {
  let now = 1_000_000;
  const b = browser(t), f = fixture("charmander", () => now);
  const runtime = mountCanvas({ canvas: b.canvas, ...f });
  t.after(runtime.dispose);
  b.intersection(true);
  await b.load();
  assert.equal(b.frames.size, 1);
  assert.equal(f.pet.greetingActive, false, "the first visit never greets");
  b.frame(1_000);
  b.frame(1_100);
  const time = f.pet.time;
  now += 5_000;
  f.bridge.visible.set(false);
  assert.equal(b.frames.size, 0);
  b.frame(70_000);
  assert.equal(f.pet.time, time, "hidden time does not advance simulation");
  const departed = f.store.getMemory(f.species).lastSeenAt;
  now += 65_000;
  b.doc.focused = false;
  f.bridge.visible.set(true);
  assert.equal(b.frames.size, 1);
  assert.equal(f.pet.greetingActive, false, "visibility alone does not claim a return");
  f.pet.throwBall();
  b.doc.focused = true;
  b.win.dispatch("focus");
  assert.equal(f.pet.pendingGreeting, true);
  assert.equal(f.pet.greetingActive, false);
  assert.equal(f.store.getMemory(f.species).lastGreetingAt, now);
  now += 500;
  b.doc.hidden = true;
  b.doc.dispatch("visibilitychange");
  assert.equal(b.frames.size, 0);
  const hiddenDeparture = f.store.getMemory(f.species).lastSeenAt;
  assert.ok(hiddenDeparture > departed);
  now += 120_000;
  f.ctx.runtimes.forEach((dispose) => dispose());
  f.ctx.runtimes.clear();
  runtime.dispose();
  runtime.dispose();
  assert.equal(f.store.getMemory(f.species).lastSeenAt, hiddenDeparture, "hidden unmount does not extend presence");
  assertClean(b, f);
});
