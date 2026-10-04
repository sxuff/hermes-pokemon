import test from "node:test";
import assert from "node:assert/strict";
import { Ambient } from "../src/ambient.js";
import { SPOTS, POND } from "../src/world.js";

const pet = { ...SPOTS.meadow };
const events = [
  { type: "tend", ...SPOTS.flowers },
  { type: "warm", ...SPOTS.sun },
  { type: "pond-rings", x: SPOTS.bank.x, y: POND.y + POND.ry - 3 },
];
const reactions = (ambient) => [...ambient.particles, ...ambient.blooms, ...ambient.ripples];
function advance(ambient, seconds, reduced = false) {
  for (let i = 0; i < seconds * 20; i++) ambient.tick(0.05, "day", reduced);
}

test("each signature produces a visible reaction near the requested location", () => {
  for (const event of events) {
    const ambient = new Ambient(() => 0.4);
    ambient.handle(event, pet);
    const effect = reactions(ambient);
    assert.ok(effect.length > 0, event.type);
    for (const piece of effect) {
      assert.ok(Number.isFinite(piece.x) && Number.isFinite(piece.y), event.type);
      assert.ok(Math.hypot(piece.x - event.x, piece.y - event.y) < 16, `${event.type} remains near its action`);
    }
    if (event.type === "tend") assert.ok(ambient.blooms.length > 0, "flower tending leaves a temporary bloom");
    if (event.type === "warm") assert.ok(ambient.particles.some((p) => p.kind === "warmth"), "warming uses its gentle glow");
    if (event.type === "pond-rings") assert.ok(ambient.ripples.some((ripple) => ripple.deliberate), "pond play creates its own ripples");
  }
});

for (const reduced of [false, true]) {
  test(`signature effects expire completely in ${reduced ? "reduced" : "normal"} motion`, () => {
    const ambient = new Ambient(() => 0.4);
    for (const event of events) ambient.handle(event, pet);
    const original = new Set(reactions(ambient));
    assert.ok(original.size > 0);
    advance(ambient, 15, reduced);
    assert.ok(reactions(ambient).every((piece) => !original.has(piece)), "all initial delayed and visible reactions are released");
    assert.equal(ambient.blooms.length, 0);
    assert.ok(!ambient.ripples.some((ripple) => ripple.deliberate));
    assert.ok(!ambient.particles.some((p) => ["warmth", "petal", "drop"].includes(p.kind)));
  });
}

test("signature event bursts stay within a small garden effect budget", () => {
  for (const event of events) {
    const ambient = new Ambient(() => 0.4);
    for (let i = 0; i < 5000; i++) ambient.handle(event, pet);
    assert.ok(ambient.particles.length <= 128, `${event.type}: particles remain bounded without drawing`);
    assert.ok(ambient.ripples.length <= 32, `${event.type}: ripples remain bounded without drawing`);
    assert.ok(ambient.blooms.length <= 8, `${event.type}: flowers remain bounded without drawing`);
    advance(ambient, 15, true);
    assert.equal(reactions(ambient).length, 0, `${event.type}: a reduced-motion frame loop clears the burst`);
  }
});

test("reduced motion keeps signature effects still while allowing them to expire", () => {
  const ambient = new Ambient(() => 0.4);
  advance(ambient, 1);
  for (const event of events) ambient.handle(event, pet);
  const scene = { time: ambient.time, clouds: structuredClone(ambient.clouds), fireflies: structuredClone(ambient.fireflies) };
  const pieces = reactions(ambient).map((piece) => ({ piece, x: piece.x, y: piece.y, z: piece.z }));
  advance(ambient, 0.5, true);
  assert.deepEqual({ time: ambient.time, clouds: ambient.clouds, fireflies: ambient.fireflies }, scene);
  for (const { piece, x, y, z } of pieces) {
    assert.equal(piece.x, x);
    assert.equal(piece.y, y);
    assert.equal(piece.z, z);
  }
  assert.ok(ambient.ripples.length <= 1, "reduced mode shows a single still ring");
  advance(ambient, 15, true);
  assert.equal(reactions(ambient).length, 0);
});

test("continuous signature events do not accumulate under reduced motion", () => {
  const ambient = new Ambient(() => 0.4);
  for (let i = 0; i < 12000; i++) {
    for (const event of events) ambient.handle(event, pet);
    ambient.tick(0.05, "night", true);
    assert.ok(ambient.particles.length <= 128);
    assert.ok(ambient.blooms.length <= 8);
    assert.ok(ambient.ripples.length <= 1);
  }
  advance(ambient, 15, true);
  assert.equal(reactions(ambient).length, 0);
});

test("splash bursts cannot bypass the pond-play ripple budget", () => {
  const ambient = new Ambient(() => 0.4);
  ambient.handle(events[2], pet);
  for (let i = 0; i < 5000; i++) ambient.handle({ type: "splash", x: POND.x, y: POND.y }, pet);
  assert.ok(ambient.ripples.length <= 32, "all ripple producers honor the same bounded pool");
  assert.ok(ambient.particles.length <= 128);
  advance(ambient, 15, true);
  assert.equal(reactions(ambient).length, 0);
});

test("switching to reduced motion releases temporary butterflies and pet references", () => {
  const ambient = new Ambient(() => 0.4);
  for (let i = 0; i < 1000; i++) ambient.handle({ type: "butterfly" }, pet);
  assert.ok(ambient.butterflies.length <= 16, "play reactions cannot allocate unbounded butterflies");
  advance(ambient, 15, true);
  assert.ok(!ambient.butterflies.some((butterfly) => butterfly.orbit === pet), "temporary play butterflies release their pet reference even with motion off");
});
