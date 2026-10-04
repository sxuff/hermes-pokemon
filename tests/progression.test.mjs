import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROGRESSION, XP_MAX, levelFromXp, progressionOf, evolutionLevel, canEvolve, rewardInteraction, advanceTogetherTime } from "../src/progression.js";

test("levels start at five, advance every thirty XP and stop at fifty", () => {
  assert.equal(levelFromXp(0), 5);
  assert.equal(levelFromXp(29), 5);
  assert.equal(levelFromXp(30), 6);
  assert.equal(levelFromXp(330), 16);
  assert.equal(levelFromXp(XP_MAX), 50);
  assert.equal(levelFromXp(1e20), 50);
  for (const invalid of [-1, NaN, Infinity, "330", null]) assert.equal(levelFromXp(invalid), 5);
});

test("evolution uses each lineage's threshold and never happens from XP alone", () => {
  for (const [lineage, finalLevel] of [["bulbasaur", 32], ["charmander", 36], ["squirtle", 36]]) {
    assert.equal(evolutionLevel(lineage, 0), 16);
    assert.equal(evolutionLevel(lineage, 1), finalLevel);
    assert.equal(evolutionLevel(lineage, 2), null);
    assert.equal(canEvolve(lineage, { xp: 329, stage: 0 }), false);
    assert.equal(canEvolve(lineage, { xp: 330, stage: 0 }), true);
    const finalXp = (finalLevel - 5) * 30;
    assert.equal(canEvolve(lineage, { xp: finalXp - 1, stage: 1 }), false);
    assert.equal(canEvolve(lineage, { xp: finalXp, stage: 1 }), true);
    assert.equal(canEvolve(lineage, { xp: XP_MAX, stage: 2 }), false);
    assert.equal(progressionOf({ xp: XP_MAX, stage: 0 }, lineage).stage, 0);
    assert.equal(progressionOf({ xp: finalXp, stage: 1 }, lineage).stage, 1);
    assert.equal(progressionOf({ xp: 329, stage: 2 }, lineage).stage, 0);
    assert.equal(progressionOf({ xp: 330, stage: 2 }, lineage).stage, 1);
  }
  assert.equal(canEvolve("ivysaur", { xp: XP_MAX }), false);
});

test("each accepted interaction has an independent cooldown, including timestamp zero", () => {
  for (const [kind, amount, cooldown] of [["pet", 2, 30_000], ["ball", 8, 60_000], ["berry", 5, 60_000], ["call", 2, 30_000]]) {
    const first = rewardInteraction(null, "bulbasaur", kind, 0);
    assert.equal(first.gained, amount);
    assert.equal(rewardInteraction(first.progress, "bulbasaur", kind, cooldown - 1).gained, 0);
    assert.equal(rewardInteraction(first.progress, "bulbasaur", kind, cooldown).gained, amount);
  }
  const pet = rewardInteraction(null, "bulbasaur", "pet", 100_000);
  assert.equal(rewardInteraction(pet.progress, "bulbasaur", "pet", 1_000).gained, 0);
  assert.equal(rewardInteraction(pet.progress, "bulbasaur", "ball", 100_000).gained, 8);
  assert.equal(pet.progress.xp, 2);
});

test("active-time rewards use supplied seconds, retain fractional carry and bound long chunks", () => {
  const long = advanceTogetherTime(null, "squirtle", 86_400, 1_000_000);
  assert.equal(long.gained, 0);
  assert.equal(long.progress.togetherSeconds, 30);
  const after = advanceTogetherTime(long.progress, "squirtle", 30, 2_000_000);
  assert.equal(after.gained, 3);
  assert.equal(after.progress.togetherSeconds, 0);
  let progress = DEFAULT_PROGRESSION;
  for (let i = 0; i < 600; i++) progress = advanceTogetherTime(progress, "squirtle", 0.1, i).progress;
  assert.equal(progress.xp, 3);
  assert.ok(progress.togetherSeconds < 1e-8);
  for (const seconds of [0, -1, NaN, Infinity, "30"])
    assert.deepEqual(advanceTogetherTime(progress, "squirtle", seconds, 9_999_999).progress, progress);
});

test("level cap limits partial rewards and stops accumulating time or cooldown writes", () => {
  const raw = { xp: XP_MAX - 1, stage: 1, togetherSeconds: 59 };
  const pet = rewardInteraction(raw, "charmander", "ball", 1_000);
  assert.equal(pet.gained, 1);
  assert.equal(pet.progress.xp, XP_MAX);
  assert.equal(pet.progress.stage, 1);
  assert.equal(pet.progress.togetherSeconds, 0);
  const time = advanceTogetherTime(raw, "charmander", 1, 1_000);
  assert.equal(time.gained, 1);
  assert.equal(time.progress.togetherSeconds, 0);
  assert.deepEqual(rewardInteraction(pet.progress, "charmander", "pet", 100_000), { progress: pet.progress, gained: 0 });
  assert.deepEqual(advanceTogetherTime(time.progress, "charmander", 30, 100_000), { progress: time.progress, gained: 0 });
});

test("malformed saves cannot invent progression, invalid dates or unknown reward keys", () => {
  const progress = progressionOf({ xp: -1, stage: 99, rewardedAt: { pet: 1e20, ball: -1, berry: "100", call: Infinity, battle: 0 }, togetherSeconds: 60 }, "bulbasaur");
  assert.deepEqual(progress, DEFAULT_PROGRESSION);
  assert.deepEqual(progressionOf({ xp: XP_MAX, stage: 2 }, "__proto__"), DEFAULT_PROGRESSION);
  assert.equal(progressionOf({ xp: 30.9 }, "bulbasaur").xp, 30);
  for (const at of [-1, Infinity, NaN, 1e20, "100", null]) {
    assert.equal(rewardInteraction(null, "bulbasaur", "pet", at).gained, 0);
    assert.deepEqual(advanceTogetherTime(null, "bulbasaur", 30, at).progress, DEFAULT_PROGRESSION);
  }
});
