import test from "node:test";
import assert from "node:assert/strict";
import { createCompanionMemory } from "../src/companion-memory.js";
import { createPersistence } from "../src/persistence.js";

function harness(saved) {
  let clock = 1_000_000, greetings = 0;
  const writes = [], events = [];
  const store = createPersistence({ get: () => saved, set: (key, value) => writes.push(structuredClone(value)) });
  const pet = { drainMemory: () => events.splice(0), welcomeBack: () => { greetings++; return true; } };
  const create = () => createCompanionMemory({ store, species: "bulbasaur", pet, now: () => clock });
  const controller = create();
  const start = new Date(clock);
  return { controller, create, store, writes, events, arrivalDay: Math.floor((clock - start.getTimezoneOffset() * 60_000) / 86_400_000), arrivalMinute: start.getHours() * 60 + start.getMinutes(), get greetings() { return greetings; }, advance(ms) { clock += ms; }, get now() { return clock; } };
}
test("first visit, quick tab switches and reload do not manufacture a welcome", () => {
  const h = harness();
  h.controller.setPresent(true);
  assert.equal(h.greetings, 0);
  h.advance(20_000); h.controller.setPresent(false);
  h.advance(10_000); h.controller.setPresent(true);
  h.controller.dispose();
  const replacement = h.create(); replacement.setPresent(true);
  assert.equal(h.greetings, 0);
});
test("qualified return reserves cooldown once even when greeting is deferred", () => {
  const h = harness();
  h.controller.setPresent(true); h.controller.setPresent(false);
  h.advance(60_000); h.controller.setPresent(true);
  assert.equal(h.greetings, 1);
  assert.equal(h.store.getMemory("bulbasaur").lastGreetingAt, h.now);
  h.controller.setPresent(true);
  h.controller.setPresent(false); h.advance(60_000); h.controller.setPresent(true);
  assert.equal(h.greetings, 1);
  h.controller.setPresent(false); h.advance(300_000); h.controller.setPresent(true);
  assert.equal(h.greetings, 2);
});
test("hidden mount and hidden unmount preserve original departure", () => {
  const h = harness();
  h.controller.setPresent(false); h.controller.dispose();
  assert.equal(h.writes.length, 0);
  const next = h.create(); next.setPresent(true);
  h.advance(1000); next.setPresent(false);
  const departed = h.store.getMemory("bulbasaur").lastSeenAt;
  h.advance(60_000); next.dispose();
  assert.equal(h.store.getMemory("bulbasaur").lastSeenAt, departed);
});
test("presence checkpoints are sparse and stop while away", () => {
  const h = harness(); h.controller.setPresent(true);
  for (let i = 0; i < 299; i++) { h.advance(100); h.controller.checkpoint(); }
  assert.equal(h.writes.length, 1);
  h.advance(100); h.controller.checkpoint();
  assert.equal(h.writes.length, 2);
  h.controller.setPresent(false);
  const count = h.writes.length;
  h.advance(60_000); h.controller.checkpoint();
  assert.equal(h.writes.length, count);
});
test("flush batches meaningful moments per species and never persists simulation state", () => {
  const h = harness(); h.controller.setPresent(true);
  h.events.push({ type: "interaction", kind: "ball" }, { type: "favorite", spot: "shade" }, { type: "interaction", kind: "pet" });
  h.controller.flush();
  assert.deepEqual(h.store.getMemory("bulbasaur"), { favoriteSpot: "shade", lastInteraction: { kind: "pet", at: h.now }, lastSeenAt: h.now, lastGreetingAt: 0, keepsakes: [], arrivals: [[h.arrivalDay, h.arrivalMinute]], metAt: h.now, milestones: [], placed: [] });
  assert.equal(h.store.getMemory("squirtle").lastInteraction, null);
  assert.equal(h.store.getProgression("bulbasaur").xp, 10);
  assert.equal(h.store.getProgression("squirtle").xp, 0);
  const count = h.writes.length;
  h.controller.flush(); assert.equal(h.writes.length, count);
});
test("fresh controller survives effect replay and disposed controller cannot drain its events", () => {
  const h = harness(); h.controller.setPresent(true); h.controller.dispose();
  const next = h.create(); next.setPresent(true);
  h.events.push({ type: "interaction", kind: "berry" });
  h.controller.flush(); h.controller.dispose();
  assert.equal(h.events.length, 1);
  next.flush();
  assert.equal(h.store.getMemory("bulbasaur").lastInteraction.kind, "berry");
  next.setPresent(false); h.advance(60_000); next.setPresent(true);
  assert.equal(h.greetings, 1);
});
test("actual deferred greeting stores its occurrence after cooldown reservation", () => {
  const h = harness(); h.controller.setPresent(true); h.controller.setPresent(false);
  h.advance(90_000); h.controller.setPresent(true);
  assert.equal(h.store.getMemory("bulbasaur").lastInteraction, null);
  h.advance(10_000); h.events.push({ type: "interaction", kind: "greeting" }); h.controller.flush();
  assert.equal(h.store.getMemory("bulbasaur").lastInteraction.at, h.now);
  assert.equal(h.store.getMemory("bulbasaur").lastGreetingAt, h.now);
  assert.equal(h.store.getProgression("bulbasaur").xp, 0);
});

test("together-time saves small active batches and resumes without offline XP", () => {
  const h = harness(); h.controller.setPresent(true);
  for (let i = 0; i < 180; i++) { h.advance(250); h.controller.tick(.25); }
  h.controller.setPresent(false);
  assert.equal(h.store.getProgression("bulbasaur").xp, 0);
  assert.equal(h.store.getProgression("bulbasaur").togetherSeconds, 45);
  const count = h.writes.length;
  h.advance(86_400_000);
  for (let i = 0; i < 240; i++) h.controller.tick(.25);
  assert.equal(h.writes.length, count);
  h.controller.dispose();
  const next = h.create(); next.setPresent(true);
  for (let i = 0; i < 60; i++) { h.advance(250); next.tick(.25); }
  next.setPresent(false);
  assert.equal(h.store.getProgression("bulbasaur").xp, 3);
  assert.equal(h.store.getProgression("bulbasaur").togetherSeconds, 0);
  next.dispose();
  next.tick(60);
  assert.equal(h.store.getProgression("bulbasaur").xp, 3);
});

test("passive growth does not write per frame or accept long unrendered steps", () => {
  const h = harness(); h.controller.setPresent(true);
  for (let i = 0; i < 119; i++) h.controller.tick(.25);
  assert.equal(h.writes.length, 1);
  h.controller.tick(.25);
  assert.equal(h.writes.length, 2);
  h.controller.tick(3600);
  h.controller.tick(Infinity);
  h.controller.tick(-1);
  h.controller.dispose();
  assert.equal(h.store.getProgression("bulbasaur").xp, 0);
  assert.equal(h.store.getProgression("bulbasaur").togetherSeconds, 30.25);
});

test("synchronous disposal during a growth write consumes active time exactly once", () => {
  for (const seconds of [15, 30]) {
    const h = harness(); h.controller.setPresent(true);
    const unsubscribe = h.store.subscribe(() => h.controller.dispose());
    for (let i = 0; i < seconds * 4; i++) h.controller.tick(.25);
    h.controller.dispose();
    unsubscribe();
    assert.equal(h.store.getProgression("bulbasaur").xp, 0);
    assert.equal(h.store.getProgression("bulbasaur").togetherSeconds, seconds);
  }
});
