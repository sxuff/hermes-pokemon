import test from "node:test";
import assert from "node:assert/strict";
import {
  createPersistence,
  validateRecord,
  validateMemory,
  DEFAULT_MEMORY,
  cleanName,
} from "../src/persistence.js";

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
    version: 3,
    species: "squirtle",
    nickname: "Pebble",
    motion: "reduced",
    sky: "night",
    memories: {},
  });
});
test("old saves migrate without losing the companion or the user's sky and motion", () => {
  for (const version of [1, 2]) {
    const record = validateRecord({ version, species: "charmander", nickname: "Dario", motion: "reduced", sky: "night" });
    assert.deepEqual(record, { version: 3, species: "charmander", nickname: "Dario", motion: "reduced", sky: "night", memories: {} });
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
  assert.equal(storage.writes[0].version, 3);
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
    favoriteSpot: "sun", lastSeenAt: 8_000, lastGreetingAt: 5_000, lastInteraction: { kind: "berry", at: 7_000 },
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
