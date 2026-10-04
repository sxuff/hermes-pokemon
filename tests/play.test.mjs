import test from "node:test";
import assert from "node:assert/strict";
import { Companion } from "../src/behavior.js";
import { HOME, POND, TREE, SPOTS, walkable, inPond } from "../src/world.js";

const speciesIds = ["bulbasaur", "charmander", "squirtle"];
const scenery = {
  tree: { point: { x: TREE.x, y: TREE.canopyY }, destination: SPOTS.shade },
  pond: { point: { x: POND.x, y: POND.y }, destination: SPOTS.bank },
  flowers: { point: SPOTS.flowers, destination: SPOTS.flowers },
};
function rng(seed = 31) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}
function advance(pet, seconds) {
  for (let i = 0; i < seconds * 20; i++) pet.tick(0.05);
}
function until(pet, predicate, seconds = 30) {
  for (let i = 0; i < seconds * 20 && !predicate(); i++) pet.tick(0.05);
  assert.ok(predicate(), `condition not reached in ${seconds}s: ${pet.state}, ${pet.ball?.phase}`);
}
function firstInvitation(species = "bulbasaur") {
  const pet = new Companion(species, rng());
  until(pet, () => pet.inviting, 180);
  pet.drain();
  return pet;
}

for (const species of speciesIds) {
  test(`${species}: invitations are finite, infrequent and add no autonomous memories`, () => {
    const pet = new Companion(species, rng());
    const starts = [], gestures = new Set();
    let started = null, sawRoll = false;
    for (let i = 0; i < 24000; i++) {
      pet.tick(0.05);
      assert.ok(walkable(pet) || (pet.swimming && inPond(pet)));
      if (pet.inviting) {
        if (started === null) {
          started = pet.time;
          starts.push(started);
        }
        assert.equal(pet.state, "inviting");
        assert.equal(pet.busy, false, "the user can accept the offered toy");
        assert.equal(pet.fetching, false, "an invitation is separate from an active fetch");
        assert.ok(pet.time - started < 20, "an unattended invitation finishes promptly");
        assert.ok(pet.ball?.invitation);
        for (const field of ["x", "y", "z", "spin"]) assert.ok(Number.isFinite(pet.ball[field]), field);
        assert.ok(walkable(pet.ball), "the toy remains in the garden");
        if (pet.ball.phase === "invitation-roll") sawRoll = true;
        gestures.add(pet.anim.name);
      } else if (started !== null) {
        assert.equal(pet.ball, null);
        started = null;
      }
    }
    assert.ok(starts.length >= 3 && starts.length <= 13, `${starts.length} invitations in twenty quiet minutes`);
    assert.ok(starts[0] >= 45);
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 90);
    assert.ok(sawRoll, "the toy is nudged toward the viewer");
    assert.ok(gestures.has("LookUp"));
    assert.ok(gestures.has(species === "bulbasaur" ? "Nod" : "Hop"));
    if (species === "squirtle") assert.ok(gestures.has("Rotate"));
    if (species === "bulbasaur") assert.ok(!gestures.has("Hop"), "Bulbasaur's invitation stays gentle");
    assert.deepEqual(pet.drainMemory(), []);
  });

  test(`${species}: Ball accepts an invitation smoothly at every toy phase`, () => {
    for (const phase of ["carried", "invitation-lower", "invitation-roll", "rest"]) {
      const pet = firstInvitation(species);
      until(pet, () => pet.ball?.phase === phase);
      const before = { x: pet.ball.x, y: pet.ball.y, z: pet.ball.z, spin: pet.ball.spin };
      assert.ok(pet.throwBall(), phase);
      assert.equal(pet.inviting, false);
      assert.equal(pet.fetching, true);
      assert.deepEqual({ x: pet.ball.x, y: pet.ball.y, z: pet.ball.z, spin: pet.ball.spin }, before, "the toy does not jump when accepted");
      assert.deepEqual(pet.drainMemory(), [{ type: "interaction", kind: "ball" }]);
      const ball = pet.ball;
      assert.equal(pet.throwBall(), false);
      assert.equal(pet.ball, ball);
      until(pet, () => !pet.fetching, 20);
      assert.equal(pet.ball, null);
      assert.ok(Math.hypot(pet.x - HOME.x, pet.y - HOME.y) < 0.1);
    }
  });

  test(`${species}: user actions dismiss invitations and leave no abandoned toy`, () => {
    for (const action of ["pet", "giveTreat", "callTo", "notice", "investigate", "reset", "reduced"]) {
      const pet = firstInvitation(species);
      until(pet, () => pet.ball?.phase === "invitation-roll");
      if (action === "reduced") pet.setReduced(true);
      else if (action === "investigate") pet.investigate(scenery.tree.point, "tree");
      else pet[action]({ x: 50, y: 92 });
      assert.equal(pet.inviting, false, action);
      assert.equal(pet.ball, null, action);
      assert.ok(!pet.plan.some((step) => step.state === "inviting"), action);
      advance(pet, 25);
      assert.equal(pet.ball, null, action);
      assert.equal(pet.treat, null, action);
      assert.ok(walkable(pet) || (pet.swimming && inPond(pet)), action);
    }
  });

  test(`${species}: queued welcome runs after the invitation despite Hermes cues`, () => {
    const pet = firstInvitation(species);
    assert.ok(pet.welcomeBack());
    assert.equal(pet.welcomeBack(), false);
    assert.equal(pet.pendingGreeting, true);
    for (let frame = 0; frame < 400 && pet.inviting; frame++) {
      const step = pet.step;
      pet.react("completed");
      pet.react("working");
      pet.react("waiting");
      assert.equal(pet.step, step);
      pet.tick(0.05);
    }
    assert.equal(pet.inviting, false);
    until(pet, () => pet.greetingActive);
    assert.equal(pet.pendingGreeting, false);
    assert.equal(pet.ball, null);
    assert.deepEqual(pet.drainMemory(), [{ type: "interaction", kind: "greeting" }]);
    until(pet, () => !pet.greetingActive);
  });

  test(`${species}: scenery investigations approach clear ground and complete`, () => {
    for (const [kind, { point, destination }] of Object.entries(scenery)) {
      const pet = new Companion(species, rng());
      assert.ok(pet.investigate(point, kind));
      assert.equal(pet.state, "investigating");
      for (let i = 0; i < 400 && pet.state === "investigating"; i++) {
        pet.tick(0.05);
        assert.ok(walkable(pet), `${kind} never enters the obstacle`);
        assert.equal(pet.swimming, false);
      }
      assert.equal(pet.state, "idle");
      assert.equal(pet.investigationTarget, null);
      assert.deepEqual({ x: pet.x, y: pet.y }, destination);
      const emitted = pet.drain();
      const expected = kind === "flowers" ? (species === "bulbasaur" ? "tend" : "petals")
        : kind === "tree" && species === "bulbasaur" ? "leaves"
        : kind === "pond" && species === "squirtle" ? "pond-rings" : null;
      if (expected) assert.ok(emitted.some((event) => event.type === expected), `${species} ${kind}: ${expected}`);
      assert.ok(pet.drainMemory().some((event) => event.type === "interaction" && event.kind === "call"));
    }
  });

  test(`${species}: reduced-motion investigations are brief glances in place`, () => {
    for (const [kind, { point }] of Object.entries(scenery)) {
      const pet = new Companion(species, rng());
      pet.setReduced(true);
      assert.ok(pet.investigate(point, kind));
      for (let i = 0; i < 80; i++) {
        pet.tick(0.05);
        assert.deepEqual({ x: pet.x, y: pet.y }, HOME);
        assert.equal(pet.animClock, 0);
      }
      assert.notEqual(pet.state, "investigating");
      assert.equal(pet.investigationTarget, null);
      assert.deepEqual(pet.drain(), []);
    }
  });
}

test("reset and motion toggles never bypass the invitation cadence", () => {
  const pet = firstInvitation();
  const first = pet.time;
  pet.reset();
  for (let i = 0; i < 5; i++) {
    advance(pet, 12);
    assert.equal(pet.inviting, false);
    pet.reset();
    pet.setReduced(true);
    pet.setReduced(false);
  }
  until(pet, () => pet.inviting, 180);
  assert.ok(pet.time - first >= 90);
  pet.welcomeBack();
  pet.setReduced(true);
  assert.equal(pet.ball, null);
  assert.equal(pet.inviting, false);
  until(pet, () => pet.greetingActive);
  until(pet, () => !pet.greetingActive);
  for (let i = 0; i < 24000; i++) {
    pet.tick(0.05);
    assert.equal(pet.inviting, false);
    assert.equal(pet.ball, null);
  }
});

test("recent user attention and Hermes cues postpone spontaneous invitations", () => {
  for (const action of ["pet", "hermes"]) {
    const pet = new Companion("charmander", rng());
    for (let i = 0; i < 30; i++) {
      if (action === "pet") pet.pet();
      else pet.react("working");
      for (let frame = 0; frame < 200; frame++) {
        pet.tick(0.05);
        assert.equal(pet.inviting, false, action);
      }
    }
    const quietAt = pet.time;
    until(pet, () => pet.inviting, 100);
    assert.ok(pet.time - quietAt >= 25, "at least 35 seconds since the final interaction");
  }
});

test("investigations do not interrupt fetch, berries, swimming or petting", () => {
  for (const action of ["throwBall", "giveTreat", "pet", "swim"]) {
    const pet = new Companion("squirtle", rng());
    if (action === "swim") {
      Object.assign(pet, SPOTS.bank);
      pet.start(pet.swimPlan(SPOTS.bank));
    } else pet[action]();
    pet.drainMemory();
    const step = pet.step, ball = pet.ball, treat = pet.treat;
    assert.equal(pet.investigate(scenery.pond.point, "pond"), false, action);
    assert.equal(pet.step, step, action);
    assert.equal(pet.ball, ball, action);
    assert.equal(pet.treat, treat, action);
    assert.deepEqual(pet.drainMemory(), []);
  }
});

test("a repeated scenery click and motion toggle cannot teleport an investigation", () => {
  const pet = new Companion("bulbasaur", rng());
  pet.investigate(scenery.tree.point, "tree");
  const step = pet.step;
  assert.equal(pet.investigate(scenery.tree.point, "tree"), false);
  assert.equal(pet.step, step, "rapid repeats coalesce");
  assert.ok(pet.investigationTarget);
  until(pet, () => pet.step.kind === "walk");
  advance(pet, 0.4);
  const here = { x: pet.x, y: pet.y };
  pet.setReduced(true);
  advance(pet, 4);
  assert.deepEqual({ x: pet.x, y: pet.y }, here);
  assert.equal(pet.investigationTarget, null);
  assert.equal(pet.investigate({ x: NaN, y: 30 }, "tree"), false);
  for (const kind of ["missing", "__proto__", "constructor", "toString", null]) {
    assert.equal(pet.investigate(scenery.tree.point, kind), false);
  }
  assert.ok(pet.investigate(SPOTS.flowers, "flower"));
});

test("a sleeping pet wakes for scenery and can switch to a quiet glance before walking", () => {
  const pet = new Companion("charmander", rng());
  pet.start(pet.napPlan(false));
  until(pet, () => pet.asleep);
  assert.ok(pet.investigate(scenery.pond.point, "pond"));
  assert.equal(pet.state, "waking");
  const here = { x: pet.x, y: pet.y };
  pet.setReduced(true);
  assert.equal(pet.state, "investigating");
  advance(pet, 4);
  assert.deepEqual({ x: pet.x, y: pet.y }, here);
  assert.equal(pet.investigationTarget, null);
});

test("mixed play, greetings, scenery and reduced-motion changes remain bounded", () => {
  for (const species of speciesIds) {
    for (let seed = 1; seed <= 20; seed++) {
      const random = rng(seed), pet = new Companion(species, random);
      for (let frame = 0; frame < 4000; frame++) {
        if (random() < 0.02) {
          switch (Math.floor(random() * 10)) {
            case 0: pet.throwBall(); break;
            case 1: pet.giveTreat(); break;
            case 2: pet.pet(); break;
            case 3: pet.welcomeBack(); break;
            case 4: pet.callTo({ x: 10 + random() * 140, y: 44 + random() * 68 }); break;
            case 5: pet.investigate(scenery.pond.point, "pond"); break;
            case 6: pet.investigate(scenery.tree.point, "tree"); break;
            case 7: pet.setReduced(!pet.reduced); break;
            case 8: pet.reset(); break;
            case 9: pet.react("completed"); break;
          }
        }
        pet.tick(0.05);
        assert.ok(walkable(pet) || (pet.swimming && inPond(pet)), `${species} seed ${seed}: ${pet.state} ${pet.x},${pet.y}`);
        assert.ok(pet.events.length <= 64);
        assert.ok(pet.memoryEvents.length <= 32);
        assert.ok(!pet.ball?.invitation || pet.inviting);
      }
      until(pet, () => !pet.busy && !pet.inviting && !pet.pendingGreeting && !pet.greetingActive && pet.state !== "investigating", 50);
    }
  }
});
