import test from "node:test";
import assert from "node:assert/strict";
import { signal } from "../src/signal.js";
import { createHermesBridge } from "../src/hermes.js";
import { Companion, ELSEWHERE_COOLDOWN } from "../src/behavior.js";
import { toolKind, TOOL_COOLDOWN } from "../src/tools.js";
import { weatherForDate, resolveWeather, isLateNight, RAIN_CHANCE, showersForDate, SHOWER_MINUTES } from "../src/weather.js";
import { animMeta } from "../src/anim-meta.generated.js";
import { daysTogether, dueMilestone, milestoneName, rewardsFor, REWARDS, saplingStage, saplingLabel, untidyFor, SAPLING, PILE } from "../src/milestones.js";
import { Visitors, VISITORS, eligibleVisitors } from "../src/visitors.js";
import { createPersistence, validateMemory } from "../src/persistence.js";
import { createCompanionMemory } from "../src/companion-memory.js";
import { DECOR_SLOTS, MAX_PLACED } from "../src/keepsakes.js";
import { walkable } from "../src/world.js";

const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const settle = (pet, seconds = 1) => { for (let t = 0; t < seconds; t += 0.05) pet.tick(0.05); };
function idlePet(species = "charmander", options = {}) {
  const pet = new Companion(species, seq(0.99, 0.5), options);
  pet.start([{ kind: "pose", anim: "Idle", duration: 30, state: "idle" }]);
  return pet;
}
function bridgeHarness() {
  const focus = signal("s1"), busy = signal({});
  const handlers = new Map();
  const ctx = { onEvent: (type, fn) => { handlers.set(type, fn); return () => handlers.delete(type); }, onDispose() {} };
  const bridge = createHermesBridge({ state: { focusedSessionId: focus, busyBySession: busy } }, ctx);
  const fire = (type, payload, extra = {}) => handlers.get(type)?.({ type, payload, session_id: "s1", ...extra });
  return { bridge, fire, busy };
}

// ---- 1. What Hermes is doing ---------------------------------------------------------------
test("tool names map to three garden reactions; unknown tools and clarify get none", () => {
  assert.equal(toolKind("web_search"), "web");
  assert.equal(toolKind("browser_exec"), "web");
  assert.equal(toolKind("terminal"), "terminal");
  assert.equal(toolKind("execute_code"), "terminal");
  assert.equal(toolKind("write_file"), "files");
  assert.equal(toolKind("patch"), "files");
  for (const name of ["read_file", "clarify", "memory", "", null, 42, "terminalx"]) assert.equal(toolKind(name), null);
});
test("the bridge reports tool kinds without disturbing the working state", () => {
  const h = bridgeHarness();
  h.busy.set({ s1: true });
  const before = h.bridge.activity.get();
  h.fire("tool.start", { name: "web_search", tool_id: "a" });
  assert.equal(h.bridge.tool.get().kind, "web");
  assert.equal(h.bridge.activity.get(), before, "working state untouched");
  h.fire("tool.start", { name: "read_file", tool_id: "b" });
  assert.equal(h.bridge.tool.get().kind, "web", "unknown tools do not emit");
  h.fire("tool.start", { name: "terminal", tool_id: "c" }, { replayed: true });
  assert.equal(h.bridge.tool.get().kind, "web", "replays are ignored");
  h.fire("tool.start", { name: "terminal", tool_id: "d" }, { session_id: "other" });
  assert.equal(h.bridge.tool.get().kind, "web", "other sessions are ignored");
  h.fire("tool.start", { name: "clarify", tool_id: "q" });
  assert.equal(h.bridge.activity.get().kind, "waiting", "clarify still asks a question");
});
test("tool reactions are rate-limited and never interrupt play", () => {
  const pet = idlePet();
  assert.ok(pet.reactToTool("terminal"));
  assert.equal(pet.state, "curious");
  settle(pet, 3);
  assert.equal(pet.reactToTool("files"), false, "cooldown holds");
  for (let t = 0; t < TOOL_COOLDOWN; t += 0.05) pet.tick(0.05);
  pet.throwBall();
  assert.equal(pet.reactToTool("web"), false, "fetch is never interrupted");
  assert.ok(pet.fetching);
  const quiet = idlePet();
  quiet.setReduced(true);
  assert.equal(quiet.reactToTool("web"), false, "extra quiet mode stays still");
});
test("each tool kind has its own gesture and ends facing you", () => {
  for (const [kind, state] of [["web", "scouting"], ["terminal", "curious"], ["files", "digging"]]) {
    const pet = idlePet("bulbasaur");
    assert.ok(pet.reactToTool(kind));
    assert.equal(pet.state, state);
    settle(pet, 12);
    assert.ok(walkable(pet), `${kind} keeps the pet on walkable ground`);
  }
});

// ---- 2. Rainy days ----------------------------------------------------------------------------
test("rain comes as short showers picked from the date, never all day", () => {
  let showery = 0;
  for (let d = 0; d < 1000; d++) {
    const date = new Date(2026, 0, 1 + d, 12);
    assert.deepEqual(showersForDate(date, "winter"), []);
    const showers = showersForDate(date, "spring");
    // Same schedule whatever time of day it is asked.
    assert.deepEqual(showers, showersForDate(new Date(2026, 0, 1 + d, 23, 59), "spring"));
    if (showers.length) showery++;
    assert.ok(showers.length <= 3);
    for (const [start, end] of showers) {
      assert.ok(end - start >= SHOWER_MINUTES[0] && end - start <= SHOWER_MINUTES[1], `shower ${end - start} min`);
      // Inside each shower it rains; a minute after it ends, it does not (unless another starts).
      const inside = new Date(2026, 0, 1 + d, Math.floor(start / 60), start % 60);
      assert.equal(weatherForDate(inside, "spring"), "rain");
    }
    let rainyMinutes = 0;
    for (let m = 0; m < 1440; m += 1) if (weatherForDate(new Date(2026, 0, 1 + d, 0, m), "spring") === "rain") rainyMinutes++;
    assert.ok(rainyMinutes <= 3 * SHOWER_MINUTES[1], `rained ${rainyMinutes} minutes`);
  }
  assert.ok(Math.abs(showery / 1000 - RAIN_CHANCE.spring) < 0.05, `showery share ${showery / 1000}`);
  assert.equal(resolveWeather("rain", "winter"), "rain", "a pinned choice wins");
  assert.equal(resolveWeather("clear", "spring"), "clear");
  assert.equal(weatherForDate(new Date(NaN), "spring"), "clear");
});
test("each starter meets the rain its own way", () => {
  const expected = { squirtle: "puddling", charmander: "sheltering", bulbasaur: "soaking" };
  for (const [species, state] of Object.entries(expected)) {
    const pet = new Companion(species, () => 0.1);
    pet.weather = "rain";
    pet.start(pet.rainPlan());
    const seen = new Set();
    for (let t = 0; t < 40; t += 0.05) { pet.tick(0.05); seen.add(pet.state); }
    assert.ok(seen.has(state), `${species} shows ${state}`);
    assert.ok(walkable(pet));
  }
});
test("Charmander never basks in the sun while it rains", () => {
  const pet = new Companion("charmander", () => 0.1);
  pet.weather = "rain";
  assert.ok(!pet.favoritePlan().some((s) => s.state === "basking"));
});

// ---- 3. Late night ------------------------------------------------------------------------------
test("late night is 1am to 5am local time", () => {
  assert.equal(isLateNight(new Date(2026, 9, 6, 0, 59)), false);
  assert.equal(isLateNight(new Date(2026, 9, 6, 1, 0)), true);
  assert.equal(isLateNight(new Date(2026, 9, 6, 4, 59)), true);
  assert.equal(isLateNight(new Date(2026, 9, 6, 5, 0)), false);
});
test("late at night it yawns, naps, and may doze beside you during a long turn", () => {
  const pet = new Companion("squirtle", seq(0.2, 0.1, 0.3));
  pet.lateNight = true;
  const states = new Set();
  for (let t = 0; t < 240; t += 0.05) { pet.tick(0.05); states.add(pet.state); }
  assert.ok(states.has("sleepy") || states.has("sleeping"), [...states].join(","));
  const company = new Companion("charmander", () => 0.1);
  company.lateNight = true;
  company.start([{ kind: "pose", anim: "Idle", duration: 1, state: "idle" }]);
  company.beginCompany();
  const seen = new Set();
  for (let t = 0; t < 60; t += 0.05) { company.tick(0.05); seen.add(company.state); }
  assert.ok(seen.has("dozing"), [...seen].join(","));
});
test("a dozing companion sleeps through work cues but wakes to cheer a finished turn", () => {
  const pet = new Companion("bulbasaur", () => 0.1);
  pet.lateNight = true;
  pet.start([{ kind: "pose", anim: "Idle", duration: 1, state: "idle" }]);
  pet.beginCompany();
  for (let t = 0; t < 60 && pet.state !== "dozing"; t += 0.05) pet.tick(0.05);
  assert.equal(pet.state, "dozing");
  pet.react("working", {});
  assert.equal(pet.state, "dozing", "work cue does not wake it");
  assert.equal(pet.bubble?.kind, undefined);
  pet.react("completed", { long: true });
  assert.equal(pet.step.anim, "Wake");
  settle(pet, 6);
  assert.notEqual(pet.state, "dozing");
});
test("daytime life is unchanged: no sleepy habits when it is not late", () => {
  const pet = new Companion("charmander", seq(0.1, 0.5, 0.9, 0.3));
  const states = new Set();
  for (let t = 0; t < 300; t += 0.05) { pet.tick(0.05); states.add(pet.state); }
  for (const s of ["sleepy", "dozing", "puddling", "sheltering", "soaking", "admiring"]) assert.ok(!states.has(s), s);
});

// ---- 4. Wild visitors ---------------------------------------------------------------------------
test("visitors suit the hour, season and weather", () => {
  assert.deepEqual(eligibleVisitors("night", "winter", "clear"), ["hoothoot"]);
  assert.ok(eligibleVisitors("day", "summer", "clear").includes("caterpie"));
  assert.ok(!eligibleVisitors("day", "autumn", "clear").includes("caterpie"));
  assert.deepEqual(eligibleVisitors("day", "summer", "rain"), []);
  assert.deepEqual(eligibleVisitors("day", "winter", "clear"), []);
});
test("a visit arrives, stays a while, leaves, and the next one waits minutes", () => {
  const v = new Visitors(() => 0.5);
  const env = { phase: "day", season: "summer", weather: "clear", reduced: false };
  let arrived = null, left = null, t = 0;
  for (; t < 400 && !left; t += 0.05) {
    v.tick(0.05, env);
    for (const e of v.drain()) {
      if (e.type === "arrived") arrived = { ...e, t };
      if (e.type === "left") left = { ...e, t };
    }
  }
  assert.ok(arrived, "someone visited");
  assert.ok(left && left.t > arrived.t, "and left again");
  assert.ok(left.t - arrived.t >= 8, "stayed a little while");
  assert.equal(v.current, null);
  assert.ok(v.nextAt - v.time >= 150, "the next visit is minutes away");
});
test("visitors never come in the still garden of extra quiet mode", () => {
  const v = new Visitors(() => 0.5);
  v.summon({ phase: "day", season: "summer", weather: "clear" }, "pidgey");
  v.tick(0.05, { phase: "day", season: "summer", weather: "clear", reduced: true });
  assert.equal(v.current, null);
  for (let t = 0; t < 600; t += 0.1) v.tick(0.1, { phase: "day", season: "summer", weather: "clear", reduced: true });
  assert.equal(v.current, null);
});
test("every visitor's resting spot is open ground or the pond", () => {
  for (const [id, info] of Object.entries(VISITORS)) {
    if (!info.pond) assert.ok(walkable(info.to) || info.flies, `${id} rests on walkable ground`);
  }
});
test("the companion turns to watch a visitor but never drops play to do it", () => {
  const pet = idlePet("squirtle");
  assert.ok(pet.watchVisitor({ species: "magikarp", x: 122, y: 65 }));
  assert.equal(pet.state, "visitor");
  assert.match(pet.caption, /Magikarp/);
  const busy = idlePet();
  busy.throwBall();
  assert.equal(busy.watchVisitor({ species: "pidgey", x: 88, y: 49 }), false);
  assert.equal(idlePet().watchVisitor({ species: "mew", x: 1, y: 1 }), false);
});

// ---- 5. Keepsakes as decorations ------------------------------------------------------------------
test("only found keepsakes can be placed, up to the slot limit, and they persist", () => {
  const data = new Map();
  const storage = { get: (k, d) => (data.has(k) ? structuredClone(data.get(k)) : d), set: (k, v) => data.set(k, structuredClone(v)) };
  const store = createPersistence(storage);
  store.update({ species: "squirtle" });
  assert.equal(store.togglePlaced("squirtle", "pebble"), false, "not found yet");
  for (const id of ["pebble", "shell", "acorn", "petal", "feather"]) store.collect("squirtle", id);
  for (const id of ["pebble", "shell", "acorn", "petal"]) assert.ok(store.togglePlaced("squirtle", id));
  assert.equal(store.togglePlaced("squirtle", "feather"), false, `only ${MAX_PLACED} at once`);
  assert.ok(store.togglePlaced("squirtle", "shell"), "can be put back");
  assert.deepEqual(createPersistence(storage).getMemory("squirtle").placed, ["pebble", "acorn", "petal"]);
  assert.deepEqual(validateMemory({ keepsakes: ["pebble"], placed: ["pebble", "shell", "nope"] }).placed, ["pebble"]);
});
test("decoration slots sit on open, walkable ground", () => {
  for (const slot of DECOR_SLOTS) assert.ok(walkable(slot), JSON.stringify(slot));
});
test("it sometimes goes over to check on a keepsake you set out", () => {
  const pet = new Companion("bulbasaur", seq(0.95, 0.2, 0.5), { keepsakes: ["pebble"], placed: ["pebble"] });
  const seen = new Set();
  for (let t = 0; t < 400; t += 0.05) { pet.tick(0.05); seen.add(pet.state); if (pet.state === "admiring") break; }
  assert.ok(seen.has("admiring"));
  assert.match(pet.caption, /smooth pebble/);
  assert.deepEqual(new Companion("bulbasaur", Math.random, { placed: ["pebble"] }).placed, [], "unfound keepsakes are ignored");
});

// ---- 6. Milestones --------------------------------------------------------------------------------
test("days together count local calendar days", () => {
  const met = new Date(2026, 0, 1, 23, 50).getTime();
  assert.equal(daysTogether(met, new Date(2026, 0, 2, 0, 10).getTime()), 1);
  assert.equal(daysTogether(met, new Date(2026, 0, 31, 9).getTime()), 30);
  assert.equal(daysTogether(0, Date.now()), 0);
  assert.equal(milestoneName(30), "30 days together");
  assert.equal(milestoneName(365), "One year together");
  assert.equal(milestoneName(730), "2 years together");
});
test("each milestone is celebrated once, and stale ones are recorded quietly", () => {
  const met = new Date(2026, 0, 1, 12).getTime();
  const day = (n) => new Date(2026, 0, 1 + n, 12).getTime();
  assert.equal(dueMilestone(met, [], day(29)).celebrate, null);
  const first = dueMilestone(met, [], day(30));
  assert.equal(first.celebrate, 30);
  assert.deepEqual(first.celebrated, [30]);
  assert.equal(dueMilestone(met, first.celebrated, day(31)).celebrate, null, "never twice");
  const late = dueMilestone(met, [], day(120));
  assert.equal(late.celebrate, null, "a long break never replays old milestones");
  assert.deepEqual(late.celebrated, [30, 100]);
  assert.equal(dueMilestone(met, [30, 100], day(366)).celebrate, 365);
});
function returnAfter(days) {
  const data = new Map();
  const storage = { get: (k, d) => (data.has(k) ? structuredClone(data.get(k)) : d), writes: 0, set(k, v) { this.writes++; data.set(k, structuredClone(v)); } };
  let clock = new Date(2026, 0, 1, 12).getTime();
  const store = createPersistence(storage);
  store.update({ species: "charmander" });
  const pet = idlePet();
  const controller = createCompanionMemory({ store, species: "charmander", pet, now: () => clock });
  controller.setPresent(true);
  const met = store.getMemory("charmander").metAt;
  controller.setPresent(false);
  clock = new Date(2026, 0, 1 + days, 12).getTime();
  const before = storage.writes;
  controller.setPresent(true);
  return { store, pet, met, start: new Date(2026, 0, 1, 12).getTime(), writes: storage.writes - before };
}
test("presence starts the day count and queues a due milestone without an extra save", () => {
  const due = returnAfter(30), control = returnAfter(29);
  assert.equal(due.met, due.start, "counting starts at the first visit");
  assert.equal(due.writes, control.writes, "a milestone adds no save beyond an ordinary return");
  assert.deepEqual(due.store.getMemory("charmander").milestones, [30]);
  assert.deepEqual(control.store.getMemory("charmander").milestones, []);
  assert.equal(due.store.getMemory("charmander").metAt, due.met, "first meeting never moves");
  // The welcome-back greeting comes first; the celebration follows right after it.
  assert.equal(due.pet.state, "greeting");
  const order = [];
  for (let t = 0; t < 20 && !order.includes("milestone"); t += 0.05) {
    due.pet.tick(0.05);
    if (order.at(-1) !== due.pet.state) order.push(due.pet.state);
  }
  assert.ok(order.includes("milestone"), order.join(" > "));
  assert.match(due.pet.caption, /30 days together/);
});

// ---- Combined -----------------------------------------------------------------------------------
test("fuzz: rain, late nights, tools, visitors and decorations together stay on the ground", () => {
  let seed = 11;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (const species of ["bulbasaur", "charmander", "squirtle"]) {
    const pet = new Companion(species, random, { keepsakes: ["pebble", "acorn"], placed: ["pebble", "acorn"] });
    const visitors = new Visitors(random);
    for (let i = 0; i < 6000; i++) {
      pet.weather = i % 1500 < 700 ? "rain" : "clear";
      pet.lateNight = i % 2000 > 1300;
      if (i % 97 === 0) pet.reactToTool(["web", "terminal", "files"][i % 3]);
      if (i % 450 === 0) pet.beginCompany();
      if (i % 450 === 300) pet.react("completed", { long: true });
      if (i % 800 === 0) pet.queueMilestone(30);
      if (i % 1100 === 0) pet.throwBall();
      visitors.tick(0.05, { phase: "day", season: "summer", weather: pet.weather, reduced: false });
      for (const e of visitors.drain()) if (e.type === "arrived") pet.watchVisitor(e);
      pet.tick(0.05);
      assert.ok(pet.swimming || walkable(pet), `${species} off the ground at ${i}: ${pet.x},${pet.y} ${pet.state}`);
      assert.ok(pet.events.length <= 64 && pet.memoryEvents.length <= 32);
    }
  }
});

// ---- Variety -------------------------------------------------------------------------------------
test("every form has every extra gesture, as real art or its own nearest move", () => {
  const extras = ["LeapForth", "Tumble", "Trip", "Charge", "EventSleep", "Shake", "Withdraw", "Kick"];
  for (const [form, meta] of Object.entries(animMeta)) {
    if (!meta.anims.Sleep || !meta.anims.Laying) continue; // wild visitors
    for (const name of extras) assert.ok(meta.anims[name]?.durations?.length, `${form} ${name}`);
  }
  for (const starter of ["bulbasaur", "charmander", "squirtle"])
    for (const name of ["LeapForth", "Tumble", "Trip", "Charge", "EventSleep"]) assert.ok(!animMeta[starter].anims[name].source, `${starter} ${name} is real art`);
});
test("idle routines never repeat back to back, and pacing varies", () => {
  for (const species of ["bulbasaur", "charmander", "squirtle"]) {
    let seed = 7;
    const pet = new Companion(species, () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
    const routines = [], durations = new Set(), anims = new Set();
    let last = null;
    for (let t = 0; t < 3600; t += 0.05) {
      pet.tick(0.05);
      if (pet.lastRoutine && pet.lastRoutine !== last) { routines.push(pet.lastRoutine); last = pet.lastRoutine; }
      if (pet.anim?.name) anims.add(pet.anim.name);
      if (pet.step?.duration) durations.add(Math.round(pet.step.duration * 100));
      assert.ok(walkable(pet) || pet.swimming);
    }
    // lastRoutine changes on every pick, so consecutive entries can never match.
    for (let i = 1; i < routines.length; i++) assert.notEqual(routines[i], routines[i - 1]);
    assert.ok(routines.length > 20, `${species} picked ${routines.length} routines`);
    for (const name of ["LeapForth", "Tumble"]) assert.ok(anims.has(name), `${species} used ${name} within an hour`);
    assert.ok(durations.size > 30, "durations vary");
  }
});
test("showers fade in and out instead of switching on", async () => {
  const { Ambient } = await import("../src/ambient.js");
  const a = new Ambient();
  a.tick(0.05, "day", false, "autumn", "rain");
  assert.ok(a.rainLevel > 0 && a.rainLevel < 0.05, "starts faint");
  for (let t = 0; t < 10; t += 0.05) a.tick(0.05, "day", false, "autumn", "rain");
  assert.ok(a.rainLevel > 0.4 && a.rainLevel < 0.6, "halfway after ten seconds");
  for (let t = 0; t < 15; t += 0.05) a.tick(0.05, "day", false, "autumn", "rain");
  assert.equal(a.rainLevel, 1);
  for (let t = 0; t < 10; t += 0.05) a.tick(0.05, "day", false, "autumn", "clear");
  assert.ok(a.rainLevel > 0.4 && a.rainLevel < 0.6, "eases off");
  for (let t = 0; t < 15; t += 0.05) a.tick(0.05, "day", false, "autumn", "clear");
  assert.equal(a.rainLevel, 0);
  a.tick(0.05, "day", true, "autumn", "rain");
  assert.equal(a.rainLevel, 1, "reduced motion: no fade animation");
});

// ---- 7. Other chats (v0.7) ---------------------------------------------------------------------
test("a finished turn in another session is a separate signal; the focused state never moves", () => {
  const h = bridgeHarness();
  h.busy.set({ s1: true });
  const before = h.bridge.activity.get();
  assert.equal(h.bridge.elsewhere.get().sequence, 0);
  h.fire("message.complete", { status: "complete" }, { session_id: "s2" });
  assert.equal(h.bridge.elsewhere.get().sequence, 1);
  assert.equal(h.bridge.elsewhere.get().session, "s2");
  assert.equal(h.bridge.activity.get(), before, "the focused session is still working");
  h.fire("message.complete", { status: "error" }, { session_id: "s2" });
  h.fire("message.complete", { status: "interrupted" }, { session_id: "s2" });
  h.fire("message.complete", { status: "complete" }, { session_id: "s2", replayed: true });
  h.fire("message.complete", { status: "complete" }, { session_id: undefined });
  assert.equal(h.bridge.elsewhere.get().sequence, 1, "errors, stops, replays and unknown sessions are ignored");
  h.fire("message.complete", { status: "complete" });
  assert.equal(h.bridge.elsewhere.get().sequence, 1, "the focused session's own finish is a cheer, not a glance");
  assert.equal(h.bridge.activity.get().kind, "completed");
});
test("the glance toward another chat is short, spaced out and never interrupts play", () => {
  const pet = idlePet();
  assert.ok(pet.noticeElsewhere());
  assert.equal(pet.state, "elsewhere");
  assert.equal(pet.bubble?.kind, "!");
  assert.match(pet.caption, /another chat/);
  settle(pet, 0.5);
  assert.equal(pet.dir, 6, "turns toward the session list");
  assert.equal(pet.noticeElsewhere(), false, "cooldown holds");
  for (let t = 0; t < 8 && pet.state === "elsewhere"; t += 0.05) pet.tick(0.05);
  assert.notEqual(pet.state, "elsewhere", "a glance is short");
  assert.equal(pet.dir, 0, "ends facing you");
  assert.ok(walkable(pet));
  for (let t = 0; t < ELSEWHERE_COOLDOWN; t += 0.05) pet.tick(0.05);
  pet.throwBall();
  assert.equal(pet.noticeElsewhere(), false, "fetch is never interrupted");
  const quiet = idlePet();
  quiet.setReduced(true);
  assert.ok(quiet.noticeElsewhere(), "extra quiet mode still shows the bubble");
  assert.equal(quiet.bubble?.kind, "!");
  settle(quiet, 0.5);
  assert.equal(quiet.dir, 0, "but does not turn");
  const company = idlePet();
  company.beginCompany();
  settle(company, 8);
  assert.equal(company.state, "company");
  assert.ok(company.noticeElsewhere());
  settle(company, 8);
  assert.equal(company.state, "company", "keeps you company afterwards");
});

// ---- 8. Milestone rewards (v0.7) ----------------------------------------------------------------
test("milestones leave something permanent in the garden, derived from what is already saved", () => {
  assert.deepEqual(rewardsFor([]), []);
  assert.deepEqual(rewardsFor([30]), ["bench"]);
  assert.deepEqual(rewardsFor([30, 100]), ["bench", "lantern"]);
  assert.deepEqual(rewardsFor([30, 100, 365, 730]), ["bench", "lantern", "bunting"]);
  assert.deepEqual(rewardsFor([100]), ["bench", "lantern"], "a quietly recorded day 30 still earns its bench");
  assert.deepEqual(rewardsFor(["x", null, -5]), []);
  assert.deepEqual(rewardsFor(undefined), []);
  for (const [id, r] of Object.entries(REWARDS))
    if (r.x !== undefined) assert.ok(r.y < 44 && walkable({ x: r.x, y: r.y + 5 }), `${id} stands behind the grass with room in front`);
});
test("the companion visits what you have earned: the bench by day, the lantern after dark", () => {
  const pet = idlePet("bulbasaur");
  assert.deepEqual(pet.rewardPlan(), [], "nothing earned yet");
  pet.rewards = ["bench", "lantern"];
  pet.phase = "day";
  const day = pet.rewardPlan();
  assert.ok(day.some((s) => s.state === "bench") && !day.some((s) => s.state === "lanternlit"), "the lantern waits for dark");
  pet.phase = "night";
  let lantern = false;
  for (let i = 0; i < 20 && !lantern; i++) lantern = pet.rewardPlan().some((s) => s.state === "lanternlit");
  assert.ok(lantern);
  pet.rewards = ["bunting"];
  assert.deepEqual(pet.rewardPlan(), [], "bunting is only for looking at");
  for (const [rewards, phase, state, pattern] of [[["bench"], "day", "bench", /bench/], [["lantern"], "dusk", "lanternlit", /lantern light/]]) {
    const live = new Companion("squirtle", Math.random);
    live.rewards = rewards;
    live.phase = phase;
    live.start(live.rewardPlan());
    let reached = false;
    for (let t = 0; t < 40 && !reached; t += 0.05) {
      live.tick(0.05);
      assert.ok(walkable(live), `${state}: ${live.x},${live.y}`);
      if (live.state === state && live.anim.name === "Sit") {
        reached = true;
        assert.match(live.caption, pattern);
        assert.ok(Math.abs(live.x - REWARDS[rewards[0]].x) < 8 && live.y > 43, "sits in front of it");
      }
    }
    assert.ok(reached, `${state} reached`);
  }
});

// ---- 9. Visitors remembered, greeted in character, and old friends (v0.7) ----------------------
test("wild sightings are counted once per visit and survive validation; cameos are never logged", () => {
  const data = new Map();
  const storage = { get: (k, d) => (data.has(k) ? structuredClone(data.get(k)) : d), set: (k, v) => data.set(k, structuredClone(v)) };
  const store = createPersistence(storage);
  store.update({ species: "charmander" });
  const pet = idlePet();
  let clock = 1_700_000_000_000;
  const controller = createCompanionMemory({ store, species: "charmander", pet, now: () => clock });
  controller.setPresent(true);
  assert.ok(pet.watchVisitor({ species: "pidgey", x: 88, y: 49, name: "Pidgey" }));
  controller.flush();
  assert.deepEqual(store.getMemory("charmander").sightings, { pidgey: { count: 1, firstAt: clock, lastAt: clock } });
  clock += 60_000;
  pet.start([{ kind: "pose", anim: "Idle", duration: 30, state: "idle" }]);
  pet.watchVisitor({ species: "pidgey", x: 88, y: 49, name: "Pidgey" });
  controller.flush();
  assert.deepEqual(store.getMemory("charmander").sightings.pidgey, { count: 2, firstAt: clock - 60_000, lastAt: clock });
  pet.start([{ kind: "pose", anim: "Idle", duration: 30, state: "idle" }]);
  assert.ok(pet.watchVisitor({ species: "cameo:squirtle", x: 40, y: 94, name: "Squirtle", cameo: true }));
  controller.flush();
  assert.deepEqual(Object.keys(store.getMemory("charmander").sightings), ["pidgey"], "an old friend is not a wild sighting");
  assert.deepEqual(validateMemory({ sightings: { pidgey: { count: 0, firstAt: 1, lastAt: 1 }, eevee: { count: 1, firstAt: 1, lastAt: 1 }, hoothoot: { count: 3, firstAt: 5, lastAt: 2 } } }).sightings,
    { hoothoot: { count: 3, firstAt: 5, lastAt: 5 } }, "bad counts and unknown species are dropped, times are ordered");
  assert.equal(store.sighting("charmander", "eevee", clock), false);
  controller.dispose();
});
test("each starter greets its own visitors in character and stays on the ground", () => {
  const cases = [["squirtle", "magikarp", /Splashing hello/], ["squirtle", "pidgey", /shell/], ["charmander", "caterpie", /Stamping/],
    ["charmander", "hoothoot", /Flame up/], ["bulbasaur", "pidgey", /from the grass/], ["bulbasaur", "caterpie", /Making friends/], ["bulbasaur", "magikarp", /Watching a wild Magikarp/]];
  for (const [species, visitor, pattern] of cases) {
    const pet = idlePet(species);
    assert.ok(pet.watchVisitor({ species: visitor, x: 60, y: 70, name: VISITORS[visitor].name }), `${species} ${visitor}`);
    assert.equal(pet.state, "visitor");
    assert.match(pet.caption, pattern);
    for (let t = 0; t < 15 && pet.state === "visitor"; t += 0.05) {
      pet.tick(0.05);
      assert.ok(walkable(pet), `${species} ${visitor} off the ground`);
    }
    assert.notEqual(pet.state, "visitor", `${species} ${visitor} finishes`);
    assert.equal(pet.dir, 0);
  }
  const quiet = idlePet("squirtle");
  quiet.setReduced(true);
  assert.ok(quiet.watchVisitor({ species: "magikarp", x: 120, y: 65, name: "Magikarp" }));
  assert.match(quiet.caption, /Splashing hello/);
  settle(quiet, 1);
  assert.equal(quiet.anim.name, "Idle", "extra quiet mode keeps still");
});
test("an old friend walks in by the flowers and the companion goes over to say hello", () => {
  const visitors = new Visitors(seq(0.1, 0.5));
  visitors.setCameos([{ lineage: "bulbasaur", form: "ivysaur", name: "Bulbasaur" }, { lineage: "nope" }, null]);
  assert.deepEqual(visitors.cameos, ["cameo:bulbasaur"]);
  assert.equal(visitors.summon({ phase: "day", season: "summer", weather: "rain" }, "cameo:bulbasaur"), true, "a forced cameo still works");
  assert.equal(visitors.current.sheet, "ivysaur", "drawn at the form it has reached");
  assert.equal(visitors.current.cameo, true);
  const arrived = [];
  for (let t = 0; t < 30 && !arrived.length; t += 0.05) {
    visitors.tick(0.05, { phase: "day", season: "summer", weather: "clear", reduced: false });
    arrived.push(...visitors.drain().filter((e) => e.type === "arrived"));
  }
  assert.equal(arrived.length, 1);
  assert.equal(arrived[0].name, "Bulbasaur");
  assert.ok(walkable({ x: arrived[0].x, y: arrived[0].y }), "stands on open ground");
  const pet = idlePet("charmander");
  assert.ok(pet.watchVisitor(arrived[0]));
  assert.match(pet.caption, /Saying hello to Bulbasaur/);
  let hop = false;
  for (let t = 0; t < 20 && pet.state === "visitor"; t += 0.05) {
    pet.tick(0.05);
    assert.ok(walkable(pet));
    if (pet.anim.name === "Hop") hop = true;
  }
  assert.ok(hop, "a hop hello");
  assert.ok(Math.hypot(pet.x - arrived[0].x, pet.y - arrived[0].y) < 24, "went over");
  // Left alone, the cameo stays a while and walks out the way it came.
  let left = false;
  for (let t = 0; t < 60 && !left; t += 0.05) {
    visitors.tick(0.05, { phase: "day", season: "summer", weather: "clear", reduced: false });
    left = visitors.drain().some((e) => e.type === "left");
  }
  assert.ok(left && visitors.current === null);
  // Unforced: cameos take their turn now and then, wild visitors otherwise, never in rain.
  const counts = { cameo: 0, wild: 0 };
  let seed = 3;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const v2 = new Visitors(random);
  v2.setCameos([{ lineage: "squirtle", form: "squirtle", name: "Squirtle" }]);
  for (let i = 0; i < 400; i++) {
    v2.current = null;
    v2.summon({ phase: "day", season: "summer", weather: "clear" });
    counts[v2.current.cameo ? "cameo" : "wild"]++;
  }
  assert.ok(counts.cameo > 60 && counts.cameo < 180, `cameo share ${counts.cameo}/400`);
  v2.current = null;
  assert.equal(v2.summon({ phase: "day", season: "summer", weather: "rain" }), false, "nobody comes in the rain");
});

// ---- 10. A sapling that grows, and leaves that gather while you are away (v0.7) ---------------
test("the sapling grows with days together and the pile size follows the days away", () => {
  assert.equal(saplingStage(0), 0);
  assert.equal(saplingStage(6), 0);
  assert.equal(saplingStage(7), 1);
  assert.equal(saplingStage(14), 2);
  assert.equal(saplingStage(60), 3);
  assert.equal(saplingStage(200), 4);
  assert.equal(saplingStage(365), 5);
  assert.equal(saplingStage(3000), 5);
  assert.equal(saplingStage(NaN), 0);
  assert.equal(saplingLabel(0), null);
  assert.match(saplingLabel(5), /blossoms/);
  assert.equal(untidyFor(6.9), 0);
  assert.equal(untidyFor(7), 1);
  assert.equal(untidyFor(14), 2);
  assert.equal(untidyFor(30), 3);
  assert.equal(untidyFor(NaN), 0);
  assert.ok(SAPLING.y < 44 && PILE.y > 44 && walkable(PILE), "the sapling stands behind the grass, the pile on it");
});
test("gathered leaves scatter on the first interaction and never on autonomous play", () => {
  const pet = new Companion("bulbasaur", seq(0.99, 0.5), { untidy: 2 });
  assert.equal(pet.untidy, 2);
  settle(pet, 20);
  assert.equal(pet.untidy, 2, "wandering does not tidy");
  assert.ok(!pet.drain().some((e) => e.type === "tidy"));
  pet.pet();
  assert.equal(pet.untidy, 0);
  const tidy = pet.drain().find((e) => e.type === "tidy");
  assert.ok(tidy && tidy.size === 2 && tidy.x === PILE.x);
  assert.deepEqual(new Companion("squirtle", Math.random, { untidy: 9 }).untidy, 0, "only the three sizes");
  assert.deepEqual(new Companion("squirtle", Math.random).untidy, 0);
});
