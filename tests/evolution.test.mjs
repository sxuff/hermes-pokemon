import test from "node:test";
import assert from "node:assert/strict";
import { Companion } from "../src/behavior.js";
import { EVOLUTION_LEVELS, FORMS, SPECIES, formFor } from "../src/species.js";
import { animMeta } from "../src/anim-meta.generated.js";
import { HOME, SPOTS, POND, walkable, inPond } from "../src/world.js";

function rng(seed = 31) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}
function advance(pet, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 20); i++) pet.tick(0.05);
}
function until(pet, condition, seconds = 30) {
  for (let i = 0; i < seconds * 20 && !condition(); i++) pet.tick(0.05);
  assert.ok(condition(), `condition not reached: ${pet.form} ${pet.state}`);
}

test("nine appearances retain three personality lineages and canonical evolution levels", () => {
  assert.deepEqual(Object.keys(SPECIES), ["bulbasaur", "charmander", "squirtle"]);
  assert.deepEqual(EVOLUTION_LEVELS, { bulbasaur: [16, 32], charmander: [16, 36], squirtle: [16, 36] });
  assert.equal(Object.keys(FORMS).length, 9);
  for (const form of Object.values(FORMS)) {
    assert.equal(formFor(form.lineage, form.stage), form.id);
    const pet = new Companion(form.lineage, rng(), { form: form.id, favoriteSpot: "flowers", position: SPOTS.bank });
    assert.equal(pet.form, form.id);
    assert.equal(pet.species, form.lineage);
    assert.equal(pet.favoriteSpot, "flowers");
    assert.deepEqual({ x: pet.x, y: pet.y }, SPOTS.bank);
    pet.reset();
    assert.equal(pet.form, form.id, "position reset does not devolve a companion");
    assert.deepEqual({ x: pet.x, y: pet.y }, HOME);
    assert.equal(pet.favoriteSpot, "flowers");
  }
});

test("restored form and position inputs cannot cross lineages or enter obstacles", () => {
  for (const form of ["charizard", "__proto__", "missing", null]) {
    const pet = new Companion("bulbasaur", rng(), { form, favoriteSpot: "shade", position: POND });
    assert.equal(pet.form, "bulbasaur");
    assert.deepEqual({ x: pet.x, y: pet.y }, SPOTS.shade);
  }
  const pet = new Companion("squirtle", rng(), { form: "blastoise", position: { x: NaN, y: Infinity } });
  assert.deepEqual({ x: pet.x, y: pet.y }, HOME);
  for (const stage of [-1, 3, 1.5, "1", "__proto__", null]) assert.equal(formFor("bulbasaur", stage), "bulbasaur");
  assert.equal(formFor("missing", 1), null);
});

for (const form of Object.values(FORMS)) {
  test(`${form.name}: native timing, garden life, fetch and berries work with its own sheets`, () => {
    const pet = new Companion(form.lineage, rng(), { form: form.id });
    const hopSeconds = animMeta[form.id].anims.Hop.durations.reduce((sum, ticks) => sum + ticks, 0) / 60;
    pet.start([
      { kind: "pose", anim: "Hop", once: true, state: "playing" },
      { kind: "pose", anim: "Idle", duration: 1, state: "idle" },
    ]);
    let elapsed = 0;
    while (elapsed + 0.01 < hopSeconds - 0.0001) {
      pet.tick(0.01);
      elapsed += 0.01;
      assert.equal(pet.state, "playing");
    }
    pet.tick(0.02);
    assert.equal(pet.state, "idle", "single-play timing follows this form's own sprite sheet");
    for (let i = 0; i < 12000; i++) {
      pet.tick(0.05);
      assert.ok(walkable(pet) || (pet.swimming && inPond(pet)), `${form.id}: ${pet.state}`);
      assert.ok(animMeta[form.id].anims[pet.anim.name]);
      assert.ok(Number.isFinite(pet.animClock));
    }
    assert.ok(pet.throwBall());
    until(pet, () => !pet.fetching, 30);
    assert.equal(pet.ball, null);
    assert.ok(pet.giveTreat());
    until(pet, () => !pet.treat);
    assert.ok(walkable(pet));
    assert.equal(pet.form, form.id);
  });

  test(`${form.name}: evolution is explicit, finite and produces one commit signal`, () => {
    const pet = new Companion(form.lineage, rng(), { form: form.id, position: SPOTS.meadow });
    if (form.stage === 2) {
      assert.equal(pet.canEvolve, false);
      assert.equal(pet.beginEvolution(), false);
      assert.deepEqual(pet.drainEvolution(), []);
      return;
    }
    assert.equal(pet.canEvolve, true);
    assert.ok(pet.beginEvolution());
    assert.equal(pet.state, "evolving");
    assert.equal(pet.evolving, true);
    assert.equal(pet.busy, true);
    assert.equal(pet.canEvolve, false);
    assert.equal(pet.beginEvolution(), false);
    for (const action of ["pet", "throwBall", "giveTreat", "callTo", "notice", "investigate", "welcomeBack"]) {
      const step = pet.step;
      assert.equal(pet[action](SPOTS.flowers, "flowers"), false, action);
      assert.equal(pet.step, step, action);
    }
    const step = pet.step;
    pet.react("working");
    pet.react("completed");
    pet.react("waiting");
    assert.equal(pet.step, step);
    until(pet, () => !pet.evolving, 3);
    assert.equal(pet.form, form.id, "the UI owns the persisted form commit");
    assert.equal(pet.canEvolve, false, "an undelivered completion cannot trigger another transition");
    assert.deepEqual(pet.drainEvolution(), [{ ...SPOTS.meadow }]);
    assert.deepEqual(pet.drainEvolution(), []);
    assert.deepEqual(pet.drainMemory(), [], "the transition does not fabricate interactions or XP");
  });
}

test("evolution waits for existing activity to settle", () => {
  for (const action of ["throwBall", "giveTreat", "pet", "welcomeBack", "investigate", "sleep", "swim", "invite"]) {
    const pet = new Companion("squirtle", rng());
    if (action === "sleep") {
      pet.start(pet.napPlan(false));
      until(pet, () => pet.asleep);
    } else if (action === "swim") {
      Object.assign(pet, SPOTS.bank);
      pet.start(pet.swimPlan(SPOTS.bank));
    } else if (action === "invite") until(pet, () => pet.inviting, 180);
    else pet[action](SPOTS.flowers, "flowers");
    const step = pet.step;
    assert.equal(pet.canEvolve, false, action);
    assert.equal(pet.beginEvolution(), false, action);
    assert.equal(pet.step, step, action);
    until(pet, () => pet.canEvolve, 50);
    assert.ok(pet.beginEvolution(), action);
  }
});

test("reset and disposal cancellation discard incomplete and undelivered transitions", () => {
  for (const action of ["reset", "cancelEvolution"]) {
    for (const seconds of [0.7, 3]) {
      const pet = new Companion("bulbasaur", rng());
      pet.beginEvolution();
      advance(pet, seconds);
      pet[action]();
      advance(pet, 4);
      assert.equal(pet.evolving, false);
      assert.deepEqual(pet.drainEvolution(), []);
      assert.equal(pet.form, "bulbasaur");
    }
  }
});

test("reduced-motion evolution stays still, including a toggle midway through", () => {
  for (const reducedAtStart of [false, true]) {
    const pet = new Companion("charmander", rng(), { position: SPOTS.sun });
    pet.setReduced(reducedAtStart);
    pet.beginEvolution();
    if (!reducedAtStart) advance(pet, 0.7);
    pet.setReduced(true);
    while (pet.evolving && pet.time < 3) {
      assert.equal(pet.anim.name, "Idle");
      assert.deepEqual({ x: pet.x, y: pet.y }, SPOTS.sun);
      assert.equal(pet.animClock, 0);
      pet.tick(0.05);
    }
    assert.equal(pet.evolving, false);
    assert.deepEqual(pet.drain(), [], "no flashing or moving particle effect is emitted");
    assert.deepEqual(pet.drainEvolution(), [{ ...SPOTS.sun }]);
  }
});
