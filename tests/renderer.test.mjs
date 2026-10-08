import test from "node:test";
import assert from "node:assert/strict";
import { createRenderer } from "../src/renderer.js";
import { Companion } from "../src/behavior.js";
import { assets } from "../src/assets.generated.js";
import { animMeta } from "../src/anim-meta.generated.js";
import { SPOTS } from "../src/world.js";

function drawingFixture(form, lineage) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const context = () => new Proxy({ globalAlpha: 1 }, { get: (target, key) => key in target ? target[key] : () => {} });
  const canvas = () => {
    const c = context();
    return { width: 160, height: 120, getContext: () => c };
  };
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: { createElement: canvas } });
  const sprites = Object.fromEntries(Object.entries(assets[form]).map(([name, data]) => [name, { ...data, image: {} }]));
  return {
    renderer: createRenderer(canvas(), sprites, lineage, form),
    restore() {
      if (previous) Object.defineProperty(globalThis, "document", previous);
      else delete globalThis.document;
    },
  };
}

test("a newly narrow camera shows the whole companion immediately after resize", () => {
  const f = drawingFixture("charizard", "charmander");
  try {
    const pet = new Companion("charmander", Math.random, { form: "charizard" });
    f.renderer.resize(370, 1);
    f.renderer.draw(pet, "day", false);
    f.renderer.resize(240, 1);
    f.renderer.draw(pet, "day", false);
    const topLeft = f.renderer.toWorld(0, 0), bottomRight = f.renderer.toWorld(1, 1);
    assert.ok(pet.x - 20 >= topLeft.x && pet.x + 20 <= bottomRight.x, "wings fit on the first narrow frame");
    assert.ok(pet.y - animMeta.charizard.visualHeight >= topLeft.y, "head fits on the first narrow frame");
    assert.ok(pet.y + 7 <= bottomRight.y, "feet are not cropped while the camera catches up");
    const center = f.renderer.toWorld(0.5, 0.5);
    assert.ok(center.x >= topLeft.x && center.x <= bottomRight.x);
    assert.ok(center.y >= topLeft.y && center.y <= bottomRight.y);
  } finally { f.restore(); }
});

test("initial narrow mounting snaps into view, then ordinary camera following stays gentle", () => {
  const f = drawingFixture("blastoise", "squirtle");
  try {
    const pet = new Companion("squirtle", Math.random, { form: "blastoise" });
    f.renderer.resize(240, 2);
    f.renderer.draw(pet, "day", false);
    const before = f.renderer.toWorld(0, 0);
    assert.ok(pet.y < f.renderer.toWorld(1, 1).y);
    Object.assign(pet, SPOTS.shade);
    f.renderer.draw(pet, "day", false);
    const after = f.renderer.toWorld(0, 0);
    assert.ok(after.x < before.x && after.x > 0, "normal following eases rather than snapping to the new target");
    assert.ok(Math.abs(after.x - before.x) < 5);
    f.renderer.resize(370, 1);
    f.renderer.draw(pet, "day", false);
    assert.deepEqual(f.renderer.toWorld(0, 0), { x: 0, y: 0 });
    assert.deepEqual(f.renderer.toWorld(1, 1), { x: 160, y: 120 });
  } finally { f.restore(); }
});

// A context that remembers the last color painted on each garden pixel.
function paintingFixture(form, lineage) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const pixels = new Map();
  const capture = () => new Proxy({ globalAlpha: 1, globalCompositeOperation: "source-over", fillStyle: "", fillRect(x, y, w, h) {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) pixels.set(`${x + i},${y + j}`, this.fillStyle);
  } }, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
  const offscreen = () => new Proxy({ globalAlpha: 1 }, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: { createElement: () => ({ width: 160, height: 120, getContext: offscreen }) } });
  const sprites = Object.fromEntries(Object.entries(assets[form]).map(([name, data]) => [name, { ...data, image: {} }]));
  const main = capture();
  return {
    pixels,
    renderer: createRenderer({ width: 160, height: 120, getContext: () => main }, sprites, lineage, form),
    at: (x, y) => pixels.get(`${x},${y}`),
    restore() {
      if (previous) Object.defineProperty(globalThis, "document", previous);
      else delete globalThis.document;
    },
  };
}

test("milestone rewards stand against the fence and the lantern glows only after dark", () => {
  const f = paintingFixture("bulbasaur", "bulbasaur");
  try {
    const pet = new Companion("bulbasaur");
    f.renderer.resize(370, 1);
    f.renderer.draw(pet, "day", false, "summer", { rewards: [] });
    const bare = [...f.pixels].filter(([, color]) => color === "#c9473f" || color === "#e2bd8a").length;
    assert.equal(bare, 0, "nothing earned, nothing drawn");
    f.pixels.clear();
    f.renderer.draw(pet, "day", false, "summer", { rewards: ["bench", "lantern", "bunting"] });
    const painted = [...f.pixels].filter(([, color]) => ["#c9473f", "#e2bd8a", "#fbe9b0"].includes(color)).map(([key]) => key.split(",").map(Number));
    assert.ok(painted.length > 20, "bench and lantern are drawn");
    assert.ok(painted.every(([, y]) => y <= 43), "all of it behind the walkable grass");
    assert.ok([...f.pixels].some(([key, color]) => color === "#f19ab4" && Number(key.split(",")[1]) === 27), "bunting hangs from the rail");
    assert.equal([...f.pixels].filter(([, color]) => color === "#ffb347").length, 0, "no glow by day");
    f.pixels.clear();
    f.renderer.draw(pet, "night", false, "summer", { rewards: ["lantern"] });
    assert.ok([...f.pixels].some(([, color]) => color === "#ffb347"), "the lantern glows at night");
    assert.ok([...f.pixels].some(([, color]) => color === "#f4f1d8"), "and the moon is up");
  } finally { f.restore(); }
});
