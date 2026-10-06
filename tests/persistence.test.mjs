import test from "node:test";
import assert from "node:assert/strict";
import {
  createPersistence,
  validateRecord,
  validateMemory,
  DEFAULT_MEMORY,
  cleanName,
} from "../src/persistence.js";
import { DEFAULT_PROGRESSION } from "../src/progression.js";

function storageWith(record) {
  let saved = record;
  const writes = [];
  return {
    get: (_key, fallback) => saved ?? fallback,
    set: (_key, value) => {
      saved = structuredClone(value);
      writes.push(saved);
    },
    writes,
  };
}

test("selection, nickname and preference survive store reconstruction", () => {
  const db = new Map(),
    storage = {
      get: (k, fallback) => db.get(k) || fallback,
      set: (k, v) => db.set(k, structuredClone(v)),
    };
  const first = createPersistence(storage);
  first.update({ species: "squirtle", nickname: "Pebble", motion: "reduced" });
  first.update({ sky: "night" });
  assert.deepEqual(createPersistence(storage).get().record, {
    version: 5,
    species: "squirtle",
    nickname: "Pebble",
    motion: "reduced",
    sky: "night",
    season: "auto",
    hemisphere: "north",
    weather: "auto",
    memories: {},
    progression: {},
  });
});
test("old saves migrate without losing the companion or the user's sky and motion", () => {
  for (const version of [1, 2, 3, 4]) {
    const record = validateRecord({ version, species: "charmander", nickname: "Dario", motion: "reduced", sky: "night" });
    assert.deepEqual(record, { version: 5, species: "charmander", nickname: "Dario", motion: "reduced", sky: "night", season: "auto", hemisphere: "north", weather: "auto", memories: {}, progression: {} });
  }
  assert.equal(validateRecord({ version: 1, species: "bulbasaur" }).sky, "auto");
  assert.equal(validateRecord({ version: 2, species: "squirtle", sky: "midnight" }).sky, "auto");
});
test("loading an old save and making no-op updates never rewrites storage", () => {
  const storage = storageWith({ version: 2, species: "charmander", nickname: "Dario", motion: "reduced", sky: "night" });
  const store = createPersistence(storage);
  let notifications = 0;
  store.subscribe(() => notifications++);
  assert.equal(store.update({ nickname: "Dario" }), false);
  assert.equal(store.remember("charmander", {}), false);
  assert.equal(store.remember("charmander", { ignored: "noise" }), false);
  assert.equal(storage.writes.length, 0);
  assert.equal(notifications, 0);
  assert.equal(store.remember("charmander", { favoriteSpot: "sun", lastSeenAt: 1_000 }), true);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.writes[0].version, 5);
  assert.equal(storage.writes[0].nickname, "Dario");
  assert.equal(store.remember("charmander", { lastSeenAt: 1_000, favoriteSpot: "sun" }), false);
  assert.equal(store.update({ sky: "night", motion: "reduced" }), false);
  assert.equal(storage.writes.length, 1);
  assert.equal(notifications, 1);
});
test("memories survive starter switches and reconstruction without crossing species", () => {
  const storage = storageWith(null);
  const store = createPersistence(storage);
  store.update({ species: "charmander", nickname: "Dario", sky: "night", motion: "reduced" });
  store.remember("charmander", { favoriteSpot: "sun", lastSeenAt: 8_000, lastInteraction: { kind: "berry", at: 7_000 } });
  store.remember("charmander", { lastGreetingAt: 5_000 });
  store.update({ species: "squirtle", nickname: "Pebble" });
  store.remember("squirtle", { favoriteSpot: "bank", lastInteraction: { kind: "ball", at: 9_000 } });
  const next = createPersistence(storage);
  assert.deepEqual(next.getMemory("charmander"), {
    ...DEFAULT_MEMORY, favoriteSpot: "sun", lastSeenAt: 8_000, lastGreetingAt: 5_000, lastInteraction: { kind: "berry", at: 7_000 },
  });
  assert.deepEqual(next.getMemory("squirtle"), {
    ...DEFAULT_MEMORY, favoriteSpot: "bank", lastInteraction: { kind: "ball", at: 9_000 },
  });
  assert.deepEqual(next.getMemory("bulbasaur"), DEFAULT_MEMORY);
  assert.equal(next.get().record.nickname, "Pebble");
  assert.equal(next.get().record.sky, "night");
  assert.equal(next.get().record.motion, "reduced");
  const snapshot = next.getMemory("charmander");
  snapshot.favoriteSpot = "bank";
  snapshot.lastInteraction.kind = "pet";
  assert.equal(next.getMemory("charmander").favoriteSpot, "sun");
  assert.equal(next.getMemory("charmander").lastInteraction.kind, "berry");
});
test("memory validation rejects unknown keys, species, interactions and malformed timestamps", () => {
  const record = validateRecord({
    version: 3,
    memories: {
      pikachu: { favoriteSpot: "sun" },
      charmander: { favoriteSpot: "__proto__", lastInteraction: { kind: "battle", at: 1 }, lastSeenAt: "today", lastGreetingAt: -1 },
      squirtle: { favoriteSpot: "bank", lastInteraction: { kind: "call", at: 0 }, lastSeenAt: 0, lastGreetingAt: 0 },
    },
  });
  assert.deepEqual(Object.keys(record.memories), ["charmander", "squirtle"]);
  assert.deepEqual(record.memories.charmander, DEFAULT_MEMORY);
  assert.deepEqual(record.memories.squirtle.lastInteraction, { kind: "call", at: 0 });
  for (const badTime of [-1, Infinity, NaN, 8.64e15 + 1, 1e20, "100", null, new Date()]) {
    const memory = validateMemory({ lastSeenAt: badTime, lastGreetingAt: badTime, lastInteraction: { kind: "pet", at: badTime } });
    assert.deepEqual(memory, DEFAULT_MEMORY);
  }
  const storage = storageWith(record);
  const store = createPersistence(storage);
  for (const species of ["__proto__", "toString", "pikachu", null]) {
    assert.equal(store.remember(species, { favoriteSpot: "sun" }), false);
    assert.deepEqual(store.getMemory(species), DEFAULT_MEMORY);
  }
  assert.equal(store.remember("bulbasaur", null), false);
  assert.equal(storage.writes.length, 0);
});
test("bad records, arbitrary species and invalid nicknames are normalized", () => {
  for (const raw of [
    null,
    {},
    "broken",
    { version: 0 },
    { version: 1, species: "__proto__", motion: "nonsense" },
  ]) {
    assert.equal(validateRecord(raw).species, null);
    assert.equal(validateRecord(raw).motion, "system");
  }
  assert.equal(cleanName(" \u0000 ", "bulbasaur"), "Bulbasaur");
  assert.equal([...cleanName("🌱".repeat(50), "bulbasaur")].length, 24);
});
test("future saves are preserved", () => {
  const futureRecord = { version: 99, species: "eevee", nickname: "Future friend", memories: { future: "data" } };
  const storage = storageWith(futureRecord);
  const store = createPersistence(storage);
  store.update({ species: "bulbasaur" });
  store.remember("bulbasaur", { favoriteSpot: "shade", lastSeenAt: 100 });
  store.awardXp("bulbasaur", "pet", 100);
  store.addTogetherTime("bulbasaur", 30, 100);
  assert.equal(storage.writes.length, 0);
  assert.deepEqual(storage.get(), futureRecord);
  assert.equal(store.getMemory("bulbasaur").favoriteSpot, "shade");
  assert.match(store.get().warning, /newer/);
});
test("storage failures leave the toy playable with an honest warning", () => {
  const store = createPersistence({
    get: () => {
      throw Error();
    },
    set: () => {
      throw Error();
    },
  });
  store.update({ species: "charmander", nickname: "Ember" });
  assert.equal(store.get().record.nickname, "Ember");
  assert.match(store.get().warning, /Could not save/);
});

test("v3 memories and preferences survive the first progression write", () => {
  const memory = { favoriteSpot: "sun", lastInteraction: { kind: "berry", at: 1_000 }, lastSeenAt: 2_000, lastGreetingAt: 0 };
  const upgraded = { ...memory, keepsakes: [], arrivals: [], metAt: 0, milestones: [], placed: [] };
  const storage = storageWith({ version: 3, species: "charmander", nickname: "Dario", motion: "reduced", sky: "night", memories: { charmander: memory } });
  const store = createPersistence(storage);
  assert.deepEqual(store.getProgression("charmander"), DEFAULT_PROGRESSION);
  assert.equal(storage.writes.length, 0);
  assert.equal(store.awardXp("charmander", "berry", 3_000), 5);
  const restored = createPersistence(storage);
  assert.deepEqual(restored.getMemory("charmander"), upgraded);
  assert.equal(restored.get().record.nickname, "Dario");
  assert.equal(restored.get().record.motion, "reduced");
  assert.equal(restored.get().record.sky, "night");
  assert.equal(restored.get().record.version, 5);
  assert.equal(restored.getProgression("charmander").xp, 5);
});

test("XP cooldowns survive reload and clock rollback, while lineages stay independent", () => {
  const storage = storageWith(null);
  let store = createPersistence(storage);
  store.update({ species: "bulbasaur", nickname: "Sprout" });
  assert.equal(store.awardXp("bulbasaur", "pet", 1_000), 2);
  store = createPersistence(storage);
  assert.equal(store.awardXp("bulbasaur", "pet", 1_000), 0);
  assert.equal(store.awardXp("bulbasaur", "pet", 500), 0);
  assert.equal(store.awardXp("bulbasaur", "pet", 30_999), 0);
  assert.equal(store.awardXp("bulbasaur", "pet", 31_000), 2);
  store.update({ species: "squirtle", nickname: "Brook" });
  assert.equal(store.awardXp("squirtle", "pet", 1_000), 2);
  const next = createPersistence(storage);
  assert.equal(next.getProgression("bulbasaur").xp, 4);
  assert.equal(next.getProgression("squirtle").xp, 2);
  assert.deepEqual(next.getProgression("charmander"), DEFAULT_PROGRESSION);
  const snapshot = next.getProgression("bulbasaur");
  snapshot.rewardedAt.pet = 0;
  assert.equal(next.getProgression("bulbasaur").rewardedAt.pet, 31_000);
});

test("together-time carry survives reload without awarding elapsed absence", () => {
  const storage = storageWith(null);
  let store = createPersistence(storage);
  assert.equal(store.addTogetherTime("bulbasaur", 30, 0), 0);
  assert.equal(store.getProgression("bulbasaur").togetherSeconds, 30);
  store = createPersistence(storage);
  assert.equal(store.getProgression("bulbasaur").xp, 0);
  assert.equal(store.addTogetherTime("bulbasaur", 0, 999_999_999), 0);
  assert.equal(store.addTogetherTime("bulbasaur", 30, 999_999_999), 3);
  assert.equal(store.getProgression("bulbasaur").togetherSeconds, 0);
  assert.equal(store.getProgression("squirtle").xp, 0);
});

test("evolution requires earned level and explicit consent, preserving nickname and lineage", () => {
  const storage = storageWith({ version: 4, species: "bulbasaur", nickname: "Sprout", progression: { bulbasaur: { xp: 328, stage: 0 } } });
  const store = createPersistence(storage);
  assert.equal(store.evolve("bulbasaur"), false);
  assert.equal(store.awardXp("bulbasaur", "pet", 0), 2);
  assert.equal(store.getProgression("bulbasaur").stage, 0);
  assert.equal(store.evolve("bulbasaur"), true);
  assert.equal(store.getProgression("bulbasaur").stage, 1);
  assert.equal(store.evolve("bulbasaur"), false);
  const restored = createPersistence(storage);
  assert.equal(restored.get().record.species, "bulbasaur");
  assert.equal(restored.get().record.nickname, "Sprout");
  assert.equal(restored.getProgression("bulbasaur").stage, 1);
});

test("invalid or throttled progression calls make no writes", () => {
  const storage = storageWith(null), store = createPersistence(storage);
  for (const species of ["ivysaur", "pikachu", "__proto__", null]) {
    assert.equal(store.awardXp(species, "pet", 0), 0);
    assert.equal(store.addTogetherTime(species, 30, 0), 0);
    assert.equal(store.evolve(species), false);
    assert.deepEqual(store.getProgression(species), DEFAULT_PROGRESSION);
  }
  for (const kind of ["greeting", "working", "completed", "invitation", "__proto__"])
    assert.equal(store.awardXp("bulbasaur", kind, 0), 0);
  assert.equal(store.addTogetherTime("bulbasaur", -1, 0), 0);
  assert.equal(storage.writes.length, 0);
  assert.equal(store.awardXp("bulbasaur", "pet", 0), 2);
  const count = storage.writes.length;
  assert.equal(store.awardXp("bulbasaur", "pet", 29_999), 0);
  assert.equal(store.addTogetherTime("bulbasaur", 0, 30_000), 0);
  assert.equal(store.evolve("bulbasaur"), false);
  assert.equal(storage.writes.length, count);
});
