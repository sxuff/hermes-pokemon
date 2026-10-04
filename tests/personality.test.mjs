import test from "node:test";
import assert from "node:assert/strict";
import { Companion } from "../src/behavior.js";
import { HOME, SPOTS, inPond, walkable } from "../src/world.js";

function rng(seed = 31) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}
function advance(pet, seconds) {
  for (let i = 0; i < seconds * 20; i++) pet.tick(0.05);
}
function until(pet, condition, seconds = 30) {
  for (let i = 0; i < seconds * 20 && !condition(); i++) pet.tick(0.05);
  assert.ok(condition(), `condition not reached from ${pet.state}`);
}

for (const species of ["bulbasaur", "charmander", "squirtle"]) {
  test(`${species}: welcome walks home, looks at the viewer and hops once`, () => {
    const pet = new Companion(species, rng(), { favoriteSpot: "shade" });
    assert.equal(pet.x, SPOTS.shade.x);
    assert.ok(pet.welcomeBack());
    assert.equal(pet.welcomeBack(), false);
    let hops = 0, previous;
    for (let i = 0; i < 300 && pet.greetingActive; i++) {
      const step = pet.step;
      if (step !== previous && pet.anim.name === "Hop") {
        hops++;
        assert.equal(pet.dir, 0);
        assert.ok(Math.hypot(pet.x - HOME.x, pet.y - HOME.y) < 0.1);
      }
      previous = step;
      const bubble = pet.bubble;
      pet.react("working");
      pet.react("completed");
      pet.react("waiting");
      assert.equal(pet.step, step, "Hermes cannot replace a welcome step");
      assert.equal(pet.bubble, bubble, "Hermes cannot overwrite the welcome cue");
      pet.tick(0.05);
      assert.ok(walkable(pet));
    }
    assert.equal(pet.greetingActive, false);
    assert.equal(hops, 1);
    assert.deepEqual(pet.drainMemory(), [{ type: "interaction", kind: "greeting" }]);
  });

  test(`${species}: signature moment stays on land and emits its own effect`, () => {
    const pet = new Companion(species, rng());
    pet.start(pet.signaturePlan());
    const events = [], states = new Set();
    for (let i = 0; i < 240; i++) {
      states.add(pet.state);
      pet.tick(0.05);
      events.push(...pet.drain());
      assert.ok(walkable(pet) || (pet.swimming && inPond(pet)));
    }
    const [state, type] = { bulbasaur: ["tending", "tend"], charmander: ["warming", "warm"], squirtle: ["rippling", "pond-rings"] }[species];
    assert.ok(states.has(state));
    const effect = events.find((event) => event.type === type);
    assert.ok(effect);
    if (species === "squirtle") assert.ok(inPond(effect), "ring effect is in the water");
    assert.deepEqual(pet.drainMemory(), [], "autonomous life does not replace user memories");
  });
}

for (const action of ["throwBall", "giveTreat", "pet", "swim"]) {
  test(`welcome waits for ${action} to finish and coalesces repeated requests`, () => {
    const pet = new Companion("squirtle", rng());
    if (action === "swim") {
      Object.assign(pet, SPOTS.bank);
      pet.start(pet.swimPlan(SPOTS.bank));
      until(pet, () => pet.swimming);
    } else pet[action]();
    const step = pet.step;
    assert.ok(pet.welcomeBack());
    for (let i = 0; i < 10; i++) assert.equal(pet.welcomeBack(), false);
    assert.equal(pet.step, step);
    assert.equal(pet.greetingActive, false);
    assert.equal(pet.pendingGreeting, true);
    assert.ok(!pet.drainMemory().some((event) => event.kind === "greeting"));
    until(pet, () => pet.greetingActive);
    assert.equal(pet.pendingGreeting, false);
    assert.equal(pet.busy, false);
    assert.equal(pet.swimming, false);
    assert.ok(walkable(pet));
    assert.deepEqual(pet.drainMemory(), [{ type: "interaction", kind: "greeting" }]);
    until(pet, () => !pet.greetingActive);
    advance(pet, 30);
    assert.ok(!pet.drainMemory().some((event) => event.kind === "greeting"));
  });
}

test("explicit interactions and reset cancel a welcome without resurrecting it", () => {
  for (const action of ["throwBall", "giveTreat", "pet", "callTo", "notice", "reset"]) {
    const pet = new Companion("bulbasaur", rng(), { favoriteSpot: "shade" });
    pet.welcomeBack();
    pet[action]({ x: 70, y: 90 });
    assert.equal(pet.greetingActive, false, action);
    assert.equal(pet.pendingGreeting, false, action);
    assert.notEqual(pet.state, "greeting", action);
    assert.ok(!pet.plan.some((step) => step.state === "greeting"), action);
  }
  const pet = new Companion("bulbasaur", rng());
  pet.throwBall();
  pet.welcomeBack();
  assert.equal(pet.throwBall(), false, "a second ball is still rejected");
  assert.equal(pet.pendingGreeting, false, "even a busy interaction dismisses the queued welcome");
  advance(pet, 25);
  assert.ok(!pet.drainMemory().some((event) => event.kind === "greeting"));
});

test("a reduced-motion welcome acknowledges the user in place and completes", () => {
  const pet = new Companion("charmander", rng(), { favoriteSpot: "sun" });
  pet.setReduced(true);
  const from = { x: pet.x, y: pet.y };
  pet.welcomeBack();
  for (let i = 0; i < 100 && pet.greetingActive; i++) {
    assert.equal(pet.anim.name, "Idle");
    pet.tick(0.05);
    assert.equal(pet.animClock, 0);
    assert.deepEqual({ x: pet.x, y: pet.y }, from);
  }
  assert.equal(pet.greetingActive, false);
  pet.throwBall();
  until(pet, () => !pet.fetching, 4);
  pet.giveTreat();
  until(pet, () => !pet.treat, 6);
});

test("switching reduced motion on during a deferred welcome safely finishes fetch", () => {
  const pet = new Companion("squirtle", rng());
  pet.throwBall();
  pet.welcomeBack();
  advance(pet, 0.6);
  pet.setReduced(true);
  until(pet, () => pet.greetingActive);
  assert.equal(pet.ball, null);
  until(pet, () => !pet.greetingActive);
  assert.ok(walkable(pet));
});

test("berries are anticipated before eating, and a returned ball is held up proudly", () => {
  const pet = new Companion("charmander", rng());
  pet.giveTreat();
  const treat = pet.treat;
  assert.equal(pet.state, "anticipating");
  advance(pet, 0.3);
  assert.equal(pet.state, "anticipating");
  assert.equal(pet.giveTreat(), false);
  assert.equal(pet.treat, treat);
  until(pet, () => !pet.treat);
  pet.throwBall();
  until(pet, () => pet.state === "presenting" && pet.anim.name === "LookUp");
  assert.equal(pet.ball.phase, "carried");
  assert.equal(pet.throwBall(), false);
  advance(pet, 0.3);
  assert.equal(pet.ball.phase, "carried");
  until(pet, () => !pet.fetching);
  assert.equal(pet.ball, null);
});

test("a berry near the top boundary keeps both food and eater on walkable ground", () => {
  for (const reduced of [false, true]) {
    const pet = new Companion("bulbasaur", () => 0.75);
    Object.assign(pet, { x: 109, y: 44 });
    pet.setReduced(reduced);
    assert.ok(pet.giveTreat());
    const food = { x: pet.treat.x, y: pet.treat.y };
    assert.ok(walkable(food));
    let reached = false;
    for (let i = 0; i < 400 && pet.treat; i++) {
      pet.tick(0.05);
      assert.ok(walkable(pet), `${reduced ? "reduced" : "normal"}: ${pet.x},${pet.y}`);
      if (pet.anim.name === "Eat") {
        reached = true;
        assert.ok(Math.hypot(pet.x - food.x, pet.y - (food.y - 4)) < 0.1, "eats beside the actual berry");
      }
    }
    assert.ok(reached);
    assert.equal(pet.treat, null);
  }
});

test("clicks are noticed before travel, and scenery glances leave busy plans alone", () => {
  const pet = new Companion("bulbasaur", rng());
  pet.callTo({ x: 30, y: 100 });
  assert.equal(pet.step.kind, "turn");
  assert.deepEqual({ x: pet.x, y: pet.y }, HOME);
  advance(pet, 0.1);
  assert.deepEqual({ x: pet.x, y: pet.y }, HOME);
  assert.ok(pet.notice({ x: 30, y: 60 }));
  assert.equal(pet.state, "noticing");
  assert.equal(pet.notice({ x: 30, y: 60 }), false);
  until(pet, () => pet.state !== "noticing");
  for (const action of ["throwBall", "giveTreat", "nap", "swim"]) {
    const other = new Companion("squirtle", rng());
    if (action === "nap") {
      other.start(other.napPlan(false));
      until(other, () => other.asleep);
    } else if (action === "swim") {
      Object.assign(other, SPOTS.bank);
      other.start(other.swimPlan(SPOTS.bank));
    } else other[action]();
    const step = other.step;
    assert.equal(other.notice({ x: 30, y: 60 }), false, action);
    assert.equal(other.step, step, action);
  }
});

test("accepted attention learns a resting place without autonomous overwrite", () => {
  const pet = new Companion("bulbasaur", rng(), { favoriteSpot: "bank" });
  pet.reset();
  assert.deepEqual({ x: pet.x, y: pet.y }, HOME, "reset always returns home");
  assert.equal(pet.favoriteSpot, "bank");
  assert.ok(pet.callTo(SPOTS.flowers));
  assert.deepEqual(pet.drainMemory(), [{ type: "interaction", kind: "call" }, { type: "favorite", spot: "flowers" }]);
  until(pet, () => pet.state === "idle");
  assert.ok(pet.pet());
  assert.equal(pet.pet(), false);
  assert.deepEqual(pet.drainMemory(), [{ type: "interaction", kind: "pet" }]);
  advance(pet, 5);
  pet.start(pet.napPlan(true));
  until(pet, () => pet.asleep);
  assert.deepEqual({ x: pet.x, y: pet.y }, SPOTS.flowers);
  advance(pet, 600);
  assert.equal(pet.favoriteSpot, "flowers");
  assert.deepEqual(pet.drainMemory(), []);
  const restored = new Companion("bulbasaur", rng(), { favoriteSpot: pet.favoriteSpot });
  assert.deepEqual({ x: restored.x, y: restored.y }, SPOTS.flowers);
});

test("memory validates restored spots, excludes rejected interactions and stays bounded", () => {
  for (const favoriteSpot of ["__proto__", "constructor", "missing", null]) {
    const pet = new Companion("squirtle", rng(), { favoriteSpot });
    assert.equal(pet.favoriteSpot, null);
    assert.deepEqual({ x: pet.x, y: pet.y }, HOME);
  }
  const pet = new Companion("squirtle", rng());
  pet.throwBall();
  pet.drainMemory();
  pet.throwBall();
  pet.giveTreat();
  pet.callTo(SPOTS.shade);
  assert.deepEqual(pet.drainMemory(), []);
  pet.reset();
  for (let i = 0; i < 100; i++) pet.callTo(i % 2 ? SPOTS.shade : SPOTS.flowers);
  assert.ok(pet.drainMemory().length <= 32);
  assert.deepEqual(pet.drainMemory(), []);
  assert.equal(pet.callTo({ x: NaN, y: 0 }), false);
  assert.equal(pet.notice({ x: 0, y: Infinity }), false);
  assert.ok(walkable(pet));
});
