import test from "node:test";
import assert from "node:assert/strict";
import { Ambient, phaseForHour, moonPhase, moonIllumination, DAYLIGHT, PHASES } from "../src/ambient.js";
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

// ---- Day length and the moon ----------------------------------------------------------------
test("day length follows the season while the old hours remain the default", () => {
  assert.equal(phaseForHour(19.2), "dusk");
  assert.equal(phaseForHour(19.2, "summer"), "day", "summer evenings are long");
  assert.equal(phaseForHour(19.2, "winter"), "night", "winter nights come early");
  assert.equal(phaseForHour(5.2, "summer"), "dawn");
  assert.equal(phaseForHour(5.2, "winter"), "night");
  assert.equal(phaseForHour(8.5, "winter"), "dawn");
  for (const season of Object.keys(DAYLIGHT)) {
    const { dawn, dusk } = DAYLIGHT[season];
    assert.ok(dawn[0] < dawn[1] && dawn[1] < dusk[0] && dusk[0] < dusk[1] && dusk[1] <= 24, season);
    let previous = "night";
    for (let h = 0; h < 24; h += 0.25) {
      const now = phaseForHour(h, season);
      assert.ok(PHASES.includes(now));
      if (now !== previous) assert.equal(PHASES[(PHASES.indexOf(previous) + 1) % 4], now, `${season} ${h}: ${previous} → ${now}`);
      previous = now;
    }
  }
});
test("the moon keeps its real phase and a new moon leaves the pond dark", () => {
  assert.ok(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14))) < 0.01, "reference new moon");
  const full = moonPhase(new Date(Date.UTC(2000, 0, 21, 4, 40)));
  assert.ok(Math.abs(full - 0.5) < 0.02, `full moon ${full}`);
  const later = moonPhase(new Date(Date.UTC(2026, 9, 8)));
  assert.ok(later >= 0 && later < 1);
  assert.equal(moonPhase(new Date(NaN)), 0.5, "an invalid date shows a full moon rather than failing");
  assert.ok(moonIllumination(0) < 0.001 && Math.abs(moonIllumination(0.5) - 1) < 0.001 && Math.abs(moonIllumination(0.25) - 0.5) < 0.001);
  const paint = () => {
    const pixels = new Map();
    const c = new Proxy({ globalAlpha: 1, globalCompositeOperation: "source-over", fillStyle: "", fillRect(x, y, w, h) {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) pixels.set(`${x + i},${y + j}`, this.fillStyle);
    } }, { get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
    return { c, pixels };
  };
  const litPixels = (phase, flip = false) => {
    const ambient = new Ambient(() => 0.4);
    ambient.moon = { phase, flip };
    const { c, pixels } = paint();
    ambient.drawLights(c, "night", null, true);
    const lit = [...pixels].filter(([key, color]) => color === "#f4f1d8" && key.split(",")[1] <= 11);
    return lit.map(([key]) => Number(key.split(",")[0]));
  };
  assert.equal(litPixels(0).length, 0, "new moon: no lit disk");
  assert.ok(litPixels(0.5).length >= 50, "full moon: the whole disk, minus two craters");
  const waxing = litPixels(0.25), waning = litPixels(0.75);
  assert.ok(waxing.length > 15 && waxing.length < 40 && waxing.every((x) => x >= 133), "first quarter lights the right half");
  assert.ok(waning.every((x) => x <= 133), "last quarter lights the left half");
  assert.ok(litPixels(0.25, true).every((x) => x <= 133), "southern skies see it mirrored");
  const reflection = (phase) => {
    const ambient = new Ambient(() => 0.4);
    ambient.moon = { phase, flip: false };
    const { c, pixels } = paint();
    ambient.drawLights(c, "night", null, true);
    return [...pixels].filter(([key, color]) => color === "#f4f1d8" && key.split(",")[1] > 40).length;
  };
  assert.equal(reflection(0), 0, "no moon, no reflection");
  assert.ok(reflection(0.5) > 0);
});
