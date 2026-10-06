import test from "node:test";
import assert from "node:assert/strict";
import { signal } from "../src/signal.js";
import { createHermesBridge, LONG_TURN_MS } from "../src/hermes.js";
import { Companion, COMPANY_SPOT, BREAK_STREAK } from "../src/behavior.js";
import { seasonForDate, resolveSeason } from "../src/seasons.js";
import { KEEPSAKES, findKeepsake, FIND_CHANCE } from "../src/keepsakes.js";
import { recordArrival, usualMinute, expectedNow, isArrival, usualTimes, MIN_DAYS, ARRIVAL_GAP_MS } from "../src/rhythm.js";
import { createCompanionMemory } from "../src/companion-memory.js";
import { createPersistence, validateRecord } from "../src/persistence.js";
import { POND, SPOTS, TREE, walkable, inPond } from "../src/world.js";

const speciesIds = ["bulbasaur", "charmander", "squirtle"];
function rng(seed = 31) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}
const advance = (pet, seconds) => { for (let i = 0; i < seconds * 20; i++) pet.tick(0.05); };
function until(pet, predicate, seconds = 30) {
  for (let i = 0; i < seconds * 20 && !predicate(); i++) pet.tick(0.05);
  assert.ok(predicate(), `condition not reached in ${seconds}s: ${pet.state}`);
}
function bridgeFixture() {
  let clock = 1_000_000;
  const state = { focusedSessionId: signal("a"), busyBySession: signal({}), focusedSessionProfile: signal("default") };
  const events = new Map();
  const ctx = { onDispose() {}, onEvent: (type, fn) => { events.set(type, fn); return () => events.delete(type); } };
  const bridge = createHermesBridge({ state }, ctx, { now: () => clock });
  return {
    state, bridge,
    advance(ms) { clock += ms; },
    busy(value) { state.busyBySession.set({ a: value }); },
    complete(status, extra = {}) { events.get("message.complete")?.({ type: "message.complete", session_id: "a", profile: "default", payload: { status }, ...extra }); },
  };
}

// ---- 1. long turns -----------------------------------------------------------------------
test("bridge reports turn start and marks only turns past the threshold as long", () => {
  const f = bridgeFixture();
  f.busy(true);
  const started = f.bridge.activity.get();
  assert.equal(started.kind, "working");
  assert.equal(typeof started.since, "number");
  f.advance(LONG_TURN_MS - 1);
  f.complete("complete");
  assert.equal(f.bridge.activity.get().kind, "completed");
  assert.equal(f.bridge.activity.get().long, false);
  f.busy(false);
  f.busy(true);
  f.advance(LONG_TURN_MS);
  f.complete("complete");
  assert.equal(f.bridge.activity.get().long, true);
  assert.equal(f.bridge.activity.get().duration, LONG_TURN_MS);
});

for (const species of speciesIds) {
  test(`${species}: keeps company during a long turn, then gives a bigger cheer`, () => {
    const pet = new Companion(species, rng());
    advance(pet, 2);
    pet.beginCompany();
    until(pet, () => pet.state === "company" && pet.step?.anim === "Sit", 20);
    assert.ok(Math.hypot(pet.x - COMPANY_SPOT.x, pet.y - COMPANY_SPOT.y) < 3, "sits beside the user");
    // It stays put across several plan cycles while the turn is still running.
    advance(pet, 25);
    assert.equal(pet.state, "company");
    assert.ok(Math.hypot(pet.x - COMPANY_SPOT.x, pet.y - COMPANY_SPOT.y) < 3);
    pet.drain();
    pet.react("completed", { long: true });
    assert.equal(pet.companyActive, false);
    assert.equal(pet.state, "proud");
    const effects = pet.drain().map((e) => e.type);
    assert.ok(effects.includes("confetti") && effects.includes("sparkle"));
    until(pet, () => pet.state !== "proud", 20);
  });
}

test("long-turn company waits for fetch to finish instead of interrupting it", () => {
  const pet = new Companion("charmander", rng());
  advance(pet, 1);
  assert.ok(pet.throwBall());
  pet.beginCompany();
  assert.ok(pet.busy, "fetch keeps going");
  assert.notEqual(pet.state, "company");
  until(pet, () => pet.state === "company", 40);
});

test("a normal completion after company is an ordinary cheer, and company ends on failure too", () => {
  const pet = new Companion("bulbasaur", rng());
  pet.beginCompany();
  until(pet, () => pet.state === "company", 20);
  pet.react("completed", { long: false });
  assert.equal(pet.state, "celebrating");
  pet.beginCompany();
  until(pet, () => pet.state === "company", 20);
  pet.react("failed", { reason: "error", streak: 1 });
  assert.equal(pet.companyActive, false);
  assert.equal(pet.state, "steady");
});

// ---- 2. failed turns ---------------------------------------------------------------------
test("bridge counts consecutive errors; success and focus changes reset; Stop is not an error", () => {
  const f = bridgeFixture();
  f.complete("error");
  assert.deepEqual([f.bridge.activity.get().kind, f.bridge.activity.get().streak], ["failed", 1]);
  f.complete("interrupted");
  assert.deepEqual([f.bridge.activity.get().reason, f.bridge.activity.get().streak], ["interrupted", 1]);
  f.complete("error");
  assert.equal(f.bridge.activity.get().streak, 2);
  f.complete("complete");
  f.complete("error");
  assert.equal(f.bridge.activity.get().streak, 1);
  f.state.focusedSessionId.set("b");
  f.state.focusedSessionId.set("a");
  f.complete("error");
  assert.equal(f.bridge.activity.get().streak, 1);
  // Replays never count.
  f.complete("error", { replayed: true });
  assert.equal(f.bridge.activity.get().streak, 1);
});

test("a failed turn gets a quiet look: no bubble, no confetti", () => {
  for (const reason of ["error", "interrupted"]) {
    const pet = new Companion("squirtle", rng());
    advance(pet, 1);
    pet.drain();
    pet.react("failed", { reason, streak: 1 });
    assert.equal(pet.state, reason === "error" ? "steady" : "stopped");
    assert.equal(pet.bubble, null);
    assert.ok(!pet.drain().some((e) => ["confetti", "sparkle"].includes(e.type)));
  }
});

test("a rough patch brings the ball over once, never during reduced motion, with a cooldown", () => {
  const pet = new Companion("charmander", rng());
  advance(pet, 1);
  pet.react("failed", { reason: "error", streak: 1 });
  until(pet, () => pet.state !== "steady", 10);
  assert.notEqual(pet.state, "offering");
  pet.react("failed", { reason: "error", streak: BREAK_STREAK });
  until(pet, () => pet.state === "offering", 15);
  assert.ok(pet.ball?.invitation, "carries the ball over");
  until(pet, () => !pet.inviting, 30);
  pet.react("failed", { reason: "error", streak: BREAK_STREAK + 1 });
  advance(pet, 20);
  assert.notEqual(pet.state, "offering", "cooldown prevents nagging");

  const quiet = new Companion("charmander", rng());
  quiet.setReduced(true);
  quiet.react("failed", { reason: "error", streak: 5 });
  advance(quiet, 20);
  assert.notEqual(quiet.state, "offering");
  // A user's Stop never prompts a break.
  const stopped = new Companion("charmander", rng());
  stopped.react("failed", { reason: "interrupted", streak: 5 });
  assert.equal(stopped.breakPending, false);
});

test("the break offer never wakes a napping companion; it waits for the nap to end", () => {
  const pet = new Companion("charmander", rng(5));
  pet.start(pet.napPlan(false));
  until(pet, () => pet.asleep, 10);
  pet.react("failed", { reason: "error", streak: BREAK_STREAK });
  assert.equal(pet.breakPending, true);
  advance(pet, 5);
  assert.equal(pet.asleep, true, "still sleeping");
  until(pet, () => pet.state === "offering", 40);
});
test("the break offer waits for fetch and does not cancel it", () => {
  const pet = new Companion("bulbasaur", rng());
  advance(pet, 1);
  assert.ok(pet.throwBall());
  pet.react("failed", { reason: "error", streak: BREAK_STREAK });
  assert.ok(pet.fetching);
  until(pet, () => pet.state === "offering", 40);
});

// ---- 3. seasons --------------------------------------------------------------------------
test("seasons follow whole calendar months and flip for the Southern Hemisphere", () => {
  const at = (month) => new Date(2026, month, 15);
  assert.deepEqual([2, 5, 8, 11].map((m) => seasonForDate(at(m))), ["spring", "summer", "autumn", "winter"]);
  assert.deepEqual([2, 5, 8, 11].map((m) => seasonForDate(at(m), "south")), ["autumn", "winter", "spring", "summer"]);
  assert.equal(seasonForDate(at(1)), "winter");
  assert.equal(seasonForDate(at(9)), "autumn");
  assert.equal(resolveSeason("winter", "south", at(5)), "winter", "a pinned season ignores the date");
  assert.equal(resolveSeason("auto", "north", at(9)), "autumn");
  assert.equal(resolveSeason("bogus", "north", at(5)), "summer");
});

test("each starter has its own seasonal habit, only in its season", () => {
  const cases = [
    ["bulbasaur", "spring", "blossoms"],
    ["charmander", "winter", "tail-warming"],
    ["squirtle", "autumn", "leaf-watching"],
    ["squirtle", "winter", "snow-watching"],
  ];
  for (const [species, season, state] of cases) {
    const pet = new Companion(species, rng(), { season });
    const plan = pet.seasonalPlan();
    assert.ok(plan?.some((s) => s.state === state), `${species} ${season}`);
    pet.season = "summer";
    assert.equal(pet.seasonalPlan(), null, `${species} has no habit in summer`);
  }
  const seen = new Set();
  const pet = new Companion("charmander", rng(7), { season: "winter" });
  for (let i = 0; i < 20 * 900; i++) {
    pet.tick(0.05);
    seen.add(pet.state);
    assert.ok(walkable(pet) || (pet.swimming && inPond(pet)));
  }
  assert.ok(seen.has("tail-warming"), "winter habit shows up in normal life");
});

// ---- 4. keepsakes ------------------------------------------------------------------------
test("keepsakes are seasonal, place-bound, collected once each", () => {
  const always = () => 0;
  assert.equal(findKeepsake("tree", "winter", new Set(), always), "pinecone");
  assert.equal(findKeepsake("tree", "winter", new Set(["pinecone"]), always), null);
  assert.equal(findKeepsake("pond", "summer", new Set(), () => FIND_CHANCE), null, "chance gates finds");
  for (const [id, k] of Object.entries(KEEPSAKES)) {
    for (const season of k.seasons || ["spring", "summer", "autumn", "winter"]) {
      const owned = new Set(Object.keys(KEEPSAKES).filter((other) => other !== id));
      assert.equal(findKeepsake(k.place, season, owned, always), id);
    }
  }
});

test("exploring together can find a keepsake that is saved and survives reload", () => {
  const storage = new Map();
  const store = createPersistence({ get: (k, f) => storage.get(k) ?? f, set: (k, v) => storage.set(k, structuredClone(v)) });
  store.update({ species: "squirtle", nickname: "Pebble" });
  let found = null;
  for (let seed = 1; seed < 200 && !found; seed++) {
    const pet = new Companion("squirtle", rng(seed), { season: "summer" });
    advance(pet, 25);
    if (!pet.investigate({ x: POND.x, y: POND.y }, "pond")) continue;
    until(pet, () => pet.state !== "investigating" && !pet.busy, 40);
    if (pet.keepsakes.size) {
      const memory = createCompanionMemory({ store, species: "squirtle", pet, now: () => 5_000 });
      memory.flush();
      found = [...pet.keepsakes][0];
    }
  }
  assert.ok(found, "some seed finds a keepsake");
  assert.equal(KEEPSAKES[found].place, "pond");
  const reloaded = createPersistence({ get: (k, f) => storage.get(k) ?? f, set() {} });
  assert.deepEqual(reloaded.getMemory("squirtle").keepsakes, [found]);
  assert.equal(reloaded.collect("squirtle", found), false, "never collected twice");
  assert.deepEqual(validateRecord({ version: 5, memories: { squirtle: { keepsakes: ["pebble", "pebble", "gold-bar", 7] } } }).memories.squirtle.keepsakes, ["pebble"]);
});

// ---- 5. arrival rhythm -------------------------------------------------------------------
const nine = (day, minute = 0) => new Date(2026, 9, day, 9, minute).getTime();
test("arrival times are learned per day and recognized only after enough days", () => {
  let arrivals = [];
  for (const day of [1, 2]) arrivals = recordArrival(arrivals, nine(day, day * 5));
  assert.equal(usualMinute(arrivals, 9 * 60), null, `needs ${MIN_DAYS} days`);
  arrivals = recordArrival(arrivals, nine(3, 20));
  arrivals = recordArrival(arrivals, nine(3, 25));
  assert.equal(arrivals.length, 3, "one arrival per day per window");
  const usual = usualMinute(arrivals, 9 * 60 + 10);
  assert.ok(usual >= 9 * 60 + 5 && usual <= 9 * 60 + 20);
  assert.equal(usualMinute(arrivals, 15 * 60), null, "afternoons are unknown");
  assert.deepEqual(usualTimes(arrivals).length, 1);
});

test("an arrival needs a real absence; at the usual time it is already waiting in its spot", () => {
  let arrivals = [];
  for (const day of [1, 2, 3]) arrivals = recordArrival(arrivals, nine(day));
  const at = nine(4, 10);
  const memory = { lastSeenAt: at - ARRIVAL_GAP_MS, lastGreetingAt: 0, arrivals };
  assert.equal(isArrival(memory, at), true);
  assert.equal(expectedNow(memory, at), true);
  assert.equal(expectedNow({ ...memory, lastSeenAt: at - 60_000 }, at), false, "a quick tab switch is not an arrival");
  assert.equal(expectedNow(memory, nine(4) + 6 * 3_600_000), false, "not at an unusual time");

  const pet = new Companion("bulbasaur", rng(), { favoriteSpot: "flowers" });
  advance(pet, 2);
  assert.ok(pet.awaitArrival());
  assert.deepEqual({ x: pet.x, y: pet.y }, SPOTS.flowers);
  assert.equal(pet.state, "expecting");
  until(pet, () => pet.bubble?.kind === "heart", 3);
});

test("presence learns arrivals in the same write and greets usual arrivals by waiting", () => {
  let clock = nine(1);
  const writes = [];
  const store = createPersistence({ get: () => null, set: (_k, v) => writes.push(v) });
  let welcomes = 0, waits = 0;
  const pet = { drainMemory: () => [], welcomeBack: () => { welcomes++; return true; }, awaitArrival: () => { waits++; return true; } };
  const memory = createCompanionMemory({ store, species: "bulbasaur", pet, now: () => clock });
  for (const day of [1, 2, 3, 4]) {
    clock = nine(day, 3);
    const before = writes.length;
    memory.setPresent(true);
    assert.ok(writes.length - before <= 2, "arrival learning adds no extra writes beyond presence/greeting");
    clock += 60_000;
    memory.setPresent(false);
  }
  assert.equal(store.getMemory("bulbasaur").arrivals.length, 4);
  assert.equal(waits, 1, "the 4th day at the usual time waits instead of walking over");
  assert.equal(welcomes, 2, "days 2 and 3 were ordinary welcome-backs");
});

// ---- whole-life fuzz with all new inputs --------------------------------------------------
test("new reactions mixed with play stay bounded and walkable", () => {
  for (const species of speciesIds) {
    for (let seed = 1; seed <= 12; seed++) {
      const random = rng(seed);
      const pet = new Companion(species, random, { season: ["spring", "summer", "autumn", "winter"][seed % 4] });
      for (let frame = 0; frame < 3000; frame++) {
        if (random() < 0.03) {
          switch (Math.floor(random() * 9)) {
            case 0: pet.throwBall(); break;
            case 1: pet.beginCompany(); break;
            case 2: pet.react("completed", { long: random() < 0.5 }); break;
            case 3: pet.react("failed", { reason: "error", streak: Math.floor(random() * 4) }); break;
            case 4: pet.react("failed", { reason: "interrupted", streak: 0 }); break;
            case 5: pet.investigate({ x: TREE.x, y: TREE.canopyY }, "tree"); break;
            case 6: pet.awaitArrival(); break;
            case 7: pet.setReduced(!pet.reduced); break;
            case 8: pet.react("working"); break;
          }
        }
        pet.tick(0.05);
        assert.ok(walkable(pet) || (pet.swimming && inPond(pet)), `${species} ${seed}: ${pet.state} ${pet.x},${pet.y}`);
        assert.ok(pet.events.length <= 64);
        assert.ok(pet.memoryEvents.length <= 32);
      }
      pet.endCompany();
      until(pet, () => !pet.busy && !pet.inviting && pet.state !== "company", 60);
    }
  }
});
