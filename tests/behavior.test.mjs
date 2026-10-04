import test from "node:test";
import assert from "node:assert/strict";
import { Companion, START } from "../src/behavior.js";
import { SPECIES } from "../src/species.js";
import { SPOTS, directionTo, findPath, inPond, walkable, clear } from "../src/world.js";

function advance(pet, seconds) {
  for (let i = 0; i < seconds * 20; i++) pet.tick(0.05);
}
function rng(seed = 31) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

test("directions match SpriteCollab row order (down, down-right, right … down-left)", () => {
  assert.equal(directionTo(0, 1), 0);
  assert.equal(directionTo(1, 1), 1);
  assert.equal(directionTo(1, 0), 2);
  assert.equal(directionTo(1, -1), 3);
  assert.equal(directionTo(0, -1), 4);
  assert.equal(directionTo(-1, -1), 5);
  assert.equal(directionTo(-1, 0), 6);
  assert.equal(directionTo(-1, 1), 7);
});
test("paths go around the pond in a few straight legs", () => {
  const from = { x: 92, y: 90 },
    to = { x: 140, y: 50 };
  const path = findPath(from, to);
  assert.ok(path.length > 0 && path.length <= 6, `legs: ${path.length}`);
  assert.deepEqual(path.at(-1), to);
  let prev = from;
  for (const point of path) {
    assert.ok(clear(prev, point), `blocked leg ${JSON.stringify(prev)} → ${JSON.stringify(point)}`);
    prev = point;
  }
  assert.deepEqual(findPath(START, { x: 116, y: 63 }), []);
  for (const spot of Object.values(SPOTS)) assert.ok(walkable(spot), JSON.stringify(spot));
});
test("paths connect exact destinations without cutting tree or pond corners", () => {
  for (const to of [{ x: 32, y: 55 }, { x: 138, y: 54 }]) {
    const path = findPath(START, to);
    assert.ok(path.length);
    assert.deepEqual(path.at(-1), to);
    let previous = START;
    for (const next of path) {
      assert.ok(clear(previous, next));
      for (let i = 0; i <= 500; i++) {
        const t = i / 500;
        assert.ok(walkable({ x: previous.x + (next.x - previous.x) * t, y: previous.y + (next.y - previous.y) * t }));
      }
      previous = next;
    }
  }
});
test("segment clearance rejects a subpixel trunk crossing missed by one-pixel samples", () => {
  const from = { x: 55.620516250198946, y: 109.61359128431118 };
  const to = { x: 33.28349396133958, y: 55.820032112216595 };
  assert.ok(walkable(from) && walkable(to));
  assert.equal(clear(from, to), false);
  const path = findPath(from, to);
  assert.ok(path.length > 1);
  let previous = from;
  for (const next of path) { assert.ok(clear(previous, next)); previous = next; }
});
for (const species of Object.keys(SPECIES)) {
  test(`${species}: ten minutes of life stay in bounds and include its favorite place`, () => {
    const pet = new Companion(species, rng()),
      states = new Set();
    for (let i = 0; i < 12000; i++) {
      pet.tick(0.05);
      states.add(pet.state);
      assert.ok(walkable(pet) || (pet.swimming && inPond(pet)), `${pet.state} ${pet.x},${pet.y}`);
      assert.ok(Number.isFinite(pet.x) && Number.isFinite(pet.y));
      assert.ok(pet.dir >= 0 && pet.dir < 8);
    }
    const favorite = { bulbasaur: "resting", charmander: "basking", squirtle: "watching" }[species];
    for (const state of ["idle", "walking", "sleeping", "playing", favorite]) assert.ok(states.has(state), state);
    if (species === "squirtle") assert.ok(states.has("swimming"));
    pet.drain();
  });
  test(`${species}: fetch returns the ball despite repeated clicks and Hermes cues`, () => {
    const pet = new Companion(species, rng());
    assert.ok(pet.throwBall());
    const ball = pet.ball;
    let carried = false;
    for (let i = 0; i < 400 && pet.fetching; i++) {
      assert.equal(pet.throwBall(), false);
      assert.equal(pet.giveTreat(), false);
      pet.pet();
      pet.react("completed");
      pet.tick(0.05);
      if (pet.ball) assert.equal(pet.ball, ball);
      if (pet.ball?.phase === "carried") carried = true;
    }
    assert.ok(carried, "ball was picked up");
    assert.equal(pet.fetching, false);
    assert.equal(pet.ball, null);
    assert.ok(Math.hypot(pet.x - START.x, pet.y - START.y) < 1);
    assert.ok(pet.throwBall());
  });
  test(`${species}: a berry is walked to, eaten and cleared`, () => {
    const pet = new Companion(species, rng(7));
    assert.ok(pet.giveTreat());
    assert.equal(pet.throwBall(), false);
    let ate = false;
    for (let i = 0; i < 300 && pet.treat; i++) {
      pet.tick(0.05);
      if (pet.state === "eating" && pet.anim.name === "Eat") ate = true;
    }
    assert.ok(ate);
    assert.equal(pet.treat, null);
  });
}
test("pet clicks coalesce and the reaction ends normally", () => {
  const pet = new Companion("bulbasaur", rng());
  assert.ok(pet.pet());
  for (let i = 0; i < 50; i++) assert.equal(pet.pet(), false);
  assert.equal(pet.state, "petting");
  advance(pet, 4);
  assert.notEqual(pet.state, "petting");
  assert.equal(pet.bubble, null);
});
test("petting a sleeping Pokémon wakes it gently first", () => {
  const pet = new Companion("charmander", rng());
  pet.start(pet.napPlan(false));
  advance(pet, 2);
  assert.equal(pet.state, "sleeping");
  pet.pet();
  assert.equal(pet.state, "waking");
  assert.equal(pet.anim.name, "Wake");
});
test("Hermes cues never cancel a fetch or a nap", () => {
  const pet = new Companion("squirtle", rng());
  pet.start(pet.napPlan(false));
  advance(pet, 2);
  pet.react("working");
  assert.equal(pet.state, "sleeping");
  assert.equal(pet.bubble.kind, "dots");
  const awake = new Companion("squirtle", rng());
  awake.react("completed");
  assert.equal(awake.state, "celebrating");
  assert.ok(awake.drain().some((e) => e.type === "confetti"));
});
test("calling to the grass walks over and faces you", () => {
  const pet = new Companion("bulbasaur", rng());
  assert.ok(pet.callTo({ x: 30, y: 100 }));
  advance(pet, 4.5);
  assert.ok(Math.hypot(pet.x - 30, pet.y - 100) < 1);
  assert.ok(!pet.callTo({ x: 116, y: 63 }) || walkable(pet.path.at(-1) || pet));
});
test("walking eases in and out instead of starting at full speed", () => {
  const pet = new Companion("charmander", rng());
  pet.callTo({ x: 20, y: 60 });
  pet.tick(0.05);
  const early = pet.speed;
  advance(pet, 1);
  assert.ok(early < pet.speed, `${early} < ${pet.speed}`);
});
test("reset cancels fetch atomically", () => {
  const pet = new Companion("squirtle", rng());
  pet.throwBall();
  advance(pet, 1);
  pet.reset();
  assert.equal(pet.state, "idle");
  assert.equal(pet.ball, null);
  assert.deepEqual(pet.path, []);
  assert.equal(pet.x, START.x);
});
test("reduced motion disables autonomous travel and still completes a fetch", () => {
  const pet = new Companion("charmander", rng());
  pet.setReduced(true);
  advance(pet, 100);
  assert.equal(pet.x, START.x);
  assert.equal(pet.y, START.y);
  pet.throwBall();
  advance(pet, 3);
  assert.equal(pet.ball, null);
  assert.equal(pet.fetching, false);
});
test("hidden time cannot cause a catch-up jump", () => {
  const pet = new Companion("bulbasaur", rng());
  pet.callTo({ x: 20, y: 60 });
  const before = { x: pet.x, y: pet.y };
  pet.tick(600);
  assert.ok(Math.hypot(pet.x - before.x, pet.y - before.y) <= 2.5);
});
