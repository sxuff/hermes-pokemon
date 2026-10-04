// Hermes Pokémon v0.4.0 — bundled sprites: CHUNSOFT / SpriteCollab. See CREDITS.md.

// src/plugin.jsx
import * as sdk from "@hermes/plugin-sdk";
import React2 from "react";

// src/App.jsx
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

// src/world.js
var WORLD = { width: 160, height: 120 };
var POND = { x: 116, y: 63, rx: 23, ry: 11 };
var TREE = { x: 27, y: 58, canopyY: 25 };
var SUN_PATCH = { x: 76, y: 56, rx: 19, ry: 8 };
var HOME = { x: 80, y: 102 };
var SPOTS = {
  shade: { x: 31, y: 70 },
  sun: { x: 76, y: 57 },
  bank: { x: 114, y: 82 },
  flowers: { x: 22, y: 98 },
  meadow: { x: 58, y: 84 }
};
var inEllipse = (p, e, grow = 0) => ((p.x - e.x) / (e.rx + grow)) ** 2 + ((p.y - e.y) / (e.ry + grow * 0.6)) ** 2 <= 1;
var OBSTACLES = [
  { ...POND, rx: POND.rx + 5, ry: POND.ry + 3 },
  { x: 138, y: 103, rx: 7, ry: 3 },
  // rock
  { x: TREE.x, y: TREE.y, rx: 7, ry: 4 },
  { x: 154, y: 114, rx: 14, ry: 9 }
  // bush
];
function walkable(p) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  if (p.x < 9 || p.x > 151 || p.y < 44 || p.y > 112) return false;
  return !OBSTACLES.some((obstacle) => inEllipse(p, obstacle));
}
var inPond = (p, margin = 0) => inEllipse(p, { ...POND, rx: POND.rx - margin, ry: POND.ry - margin * 0.6 });
var onTree = (p) => inEllipse(p, { x: TREE.x, y: TREE.canopyY, rx: 23, ry: 22 }) || Math.abs(p.x - TREE.x) < 6 && p.y > TREE.canopyY && p.y < TREE.y + 2;
function clear(a, b) {
  if (!walkable(a) || !walkable(b)) return false;
  return OBSTACLES.every((e) => {
    const x = (a.x - e.x) / e.rx, y = (a.y - e.y) / e.ry;
    const dx = (b.x - a.x) / e.rx, dy = (b.y - a.y) / e.ry;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(x * dx + y * dy) / length)) : 0;
    return (x + t * dx) ** 2 + (y + t * dy) ** 2 > 1;
  });
}
function nearestWalkable(p) {
  const q = { x: Math.round(p.x), y: Math.round(p.y) };
  if (walkable(q)) return q;
  for (let r = 2; r < 80; r += 2)
    for (let a = 0; a < 16; a++) {
      const c = { x: Math.round(q.x + Math.cos(a / 16 * Math.PI * 2) * r), y: Math.round(q.y + Math.sin(a / 16 * Math.PI * 2) * r) };
      if (walkable(c)) return c;
    }
  return { ...HOME };
}
var GRID = 4;
function findPath(from, to) {
  if (!walkable(from) || !walkable(to)) return [];
  if (clear(from, to)) return [{ x: to.x, y: to.y }];
  const cell = (p) => {
    const x = Math.round(p.x / GRID), y = Math.round(p.y / GRID), candidates = [];
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const c = { x: x + dx, y: y + dy }, q = { x: c.x * GRID, y: c.y * GRID };
        if (clear(p, q)) candidates.push({ ...c, distance: Math.hypot(p.x - q.x, p.y - q.y) });
      }
    return candidates.sort((a, b) => a.distance - b.distance)[0];
  };
  const key = (c) => c.x * 1e3 + c.y;
  const start = cell(from), goal = cell(to);
  if (!start || !goal) return [];
  const open = [start], came = /* @__PURE__ */ new Map([[key(start), null]]), cost = /* @__PURE__ */ new Map([[key(start), 0]]);
  const h = (c) => Math.hypot(c.x - goal.x, c.y - goal.y);
  let found = null;
  while (open.length && !found) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (cost.get(key(open[i])) + h(open[i]) < cost.get(key(open[best])) + h(open[best])) best = i;
    const current = open.splice(best, 1)[0];
    if (current.x === goal.x && current.y === goal.y) found = current;
    else
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const next = { x: current.x + dx, y: current.y + dy };
          if (!clear({ x: current.x * GRID, y: current.y * GRID }, { x: next.x * GRID, y: next.y * GRID })) continue;
          const g = cost.get(key(current)) + (dx && dy ? Math.SQRT2 : 1);
          if (g < (cost.get(key(next)) ?? Infinity)) {
            cost.set(key(next), g);
            came.set(key(next), current);
            open.push(next);
          }
        }
  }
  if (!found) return [];
  const cells = [];
  for (let c = found; c; c = came.get(key(c))) cells.unshift({ x: c.x * GRID, y: c.y * GRID });
  cells.unshift({ x: from.x, y: from.y });
  cells.push({ x: to.x, y: to.y });
  const path = [];
  let anchor = { x: from.x, y: from.y };
  for (let i = 1; i < cells.length; i++) {
    if (!clear(anchor, cells[i])) {
      path.push(cells[i - 1]);
      anchor = cells[i - 1];
    }
  }
  path.push(cells[cells.length - 1]);
  return path;
}
function directionTo(dx, dy) {
  if (!dx && !dy) return 0;
  const degrees = Math.atan2(dy, dx) * 180 / Math.PI;
  return (Math.round((90 - degrees) / 45) % 8 + 8) % 8;
}

// src/species.js
var SPECIES = {
  bulbasaur: {
    name: "Bulbasaur",
    number: "001",
    type: "Grass",
    trait: "A little shade seeker",
    detail: "Happiest under the old garden tree.",
    favorite: "shade",
    napSpot: "shade",
    speed: 15,
    glow: false
  },
  charmander: {
    name: "Charmander",
    number: "004",
    type: "Fire",
    trait: "Your pocket sunshine",
    detail: "Always finds the warmest patch of grass.",
    favorite: "sun",
    napSpot: "sun",
    speed: 19,
    glow: true
    // tail flame lights up the garden at night
  },
  squirtle: {
    name: "Squirtle",
    number: "007",
    type: "Water",
    trait: "A curious pond explorer",
    detail: "Likes to watch the ripples \u2014 and sometimes dives in.",
    favorite: "bank",
    napSpot: "bank",
    speed: 17,
    glow: false
  }
};

// src/anim-meta.generated.js
var animMeta = { "bulbasaur": { "shadowSize": 1, "anims": { "Idle": { "durations": [40, 6, 6], "rows": 8 }, "Walk": { "durations": [4, 4, 4, 4, 4, 4], "rows": 8 }, "Sleep": { "durations": [30, 35], "rows": 1 }, "Wake": { "durations": [8, 4, 12, 4, 10, 4], "rows": 8 }, "Laying": { "durations": [12], "rows": 8 }, "Hop": { "durations": [2, 1, 2, 3, 4, 4, 3, 2, 1, 2], "rows": 8 }, "Eat": { "durations": [6, 8, 6, 8], "rows": 1 }, "Nod": { "durations": [6, 8, 6], "rows": 8 }, "Pose": { "durations": [8, 1, 3, 2, 8], "rows": 8 }, "LookUp": { "durations": [6, 6], "rows": 1 }, "Sit": { "durations": [8, 8, 8], "rows": 1 }, "Rotate": { "durations": [2, 2, 2, 2, 2, 2, 2, 2, 2], "rows": 8 }, "DeepBreath": { "durations": [12, 6, 6, 6, 6, 6, 6, 10, 4], "rows": 1 } } }, "charmander": { "shadowSize": 1, "anims": { "Idle": { "durations": [12, 8, 8, 8], "rows": 8 }, "Walk": { "durations": [6, 8, 6, 8], "rows": 8 }, "Sleep": { "durations": [30, 35], "rows": 1 }, "Wake": { "durations": [8, 6, 14, 4, 10], "rows": 8 }, "Laying": { "durations": [12], "rows": 8 }, "Hop": { "durations": [2, 1, 2, 3, 4, 4, 3, 2, 1, 2], "rows": 8 }, "Eat": { "durations": [6, 8, 6, 8], "rows": 1 }, "Nod": { "durations": [6, 8, 6], "rows": 8 }, "Pose": { "durations": [12, 2, 8], "rows": 8 }, "LookUp": { "durations": [6, 6], "rows": 1 }, "Sit": { "durations": [8, 8, 8], "rows": 1 }, "Rotate": { "durations": [2, 2, 2, 2, 2, 2, 2, 2, 2], "rows": 8 }, "DeepBreath": { "durations": [12, 6, 6, 6, 6, 6, 6, 10, 4], "rows": 1 } } }, "squirtle": { "shadowSize": 1, "anims": { "Idle": { "durations": [30, 2, 2, 4, 4, 4, 2, 2], "rows": 8 }, "Walk": { "durations": [12, 8, 12, 8], "rows": 8 }, "Sleep": { "durations": [30, 35], "rows": 1 }, "Wake": { "durations": [8, 6, 10, 8, 10], "rows": 8 }, "Laying": { "durations": [12], "rows": 8 }, "Hop": { "durations": [2, 1, 2, 3, 4, 4, 3, 2, 1, 2], "rows": 8 }, "Eat": { "durations": [6, 8, 6, 8], "rows": 1 }, "Nod": { "durations": [6, 8, 6], "rows": 8 }, "Pose": { "durations": [12, 2, 8], "rows": 8 }, "LookUp": { "durations": [6, 6], "rows": 1 }, "Sit": { "durations": [8, 8, 8], "rows": 1 }, "Rotate": { "durations": [2, 2, 2, 2, 2, 2, 2, 2, 2], "rows": 8 }, "DeepBreath": { "durations": [12, 6, 6, 6, 6, 6, 6, 10, 4], "rows": 1 } } } };

// src/behavior.js
var TICKS = 60;
var ACCEL = 80;
var CAPTIONS = {
  idle: "Taking it all in",
  walking: "Exploring the garden",
  coming: "Coming over!",
  resting: "Watching the leaves drift",
  basking: "Soaking up the sunshine",
  watching: "Watching the ripples",
  swimming: "Paddling around the pond",
  sniffing: "Smelling the flowers",
  sleeping: "A very important little nap",
  waking: "Waking up slowly\u2026",
  playing: "Having a lovely time",
  petting: "That hit the spot!",
  attentive: "Keeping you company while Hermes works",
  celebrating: "A little cheer for a finished turn",
  waiting: "Hermes has a question for you",
  chasing: "On a very important mission",
  returning: "Bringing it back!",
  presenting: "Brought it back. Again?",
  anticipating: "Is that a berry for me?",
  eating: "Munch, munch\u2026",
  greeting: "There you are!",
  noticing: "You have my attention",
  tending: "Giving the flowers a little care",
  warming: "Warming those tiny paws",
  rippling: "One little ripple, then another",
  inviting: "Brought a ball. Want to play?",
  investigating: "Taking a closer look with you"
};
var FETCH = /* @__PURE__ */ new Set(["chasing", "returning", "presenting"]);
var Companion = class {
  constructor(species, random = Math.random, options = {}) {
    this.species = species;
    this.random = random;
    this.reduced = false;
    this.time = 0;
    this.lastPet = -Infinity;
    this.lastAttention = 0;
    this.nextInvitationAt = 60 + this.random() * 30;
    this.affection = 0;
    this.events = [];
    this.memoryEvents = [];
    this.favoriteSpot = Object.hasOwn(SPOTS, options.favoriteSpot) ? options.favoriteSpot : null;
    this.reset();
    if (this.favoriteSpot) Object.assign(this, SPOTS[this.favoriteSpot]);
  }
  reset() {
    Object.assign(this, { x: HOME.x, y: HOME.y, dir: 0, speed: 0, path: [], plan: [], step: null });
    Object.assign(this, { ball: null, treat: null, bubble: null, swimming: false, state: "idle" });
    this.invitationActive = false;
    this.investigationTarget = null;
    this.lastAttention = this.time;
    this.nextInvitationAt = Math.max(this.nextInvitationAt, this.time + 45);
    this.cancelGreeting();
    this.lastNotice = -Infinity;
    this.setAnim("Idle");
    this.start([{ kind: "pose", anim: "Idle", duration: 2, state: "idle" }]);
  }
  // ---- queries ---------------------------------------------------------------------------
  get fetching() {
    return Boolean(this.ball && !this.ball.invitation) || FETCH.has(this.state);
  }
  get inviting() {
    return this.invitationActive;
  }
  get busy() {
    return this.fetching || Boolean(this.treat);
  }
  get caption() {
    return CAPTIONS[this.state] || CAPTIONS.idle;
  }
  get asleep() {
    return this.state === "sleeping";
  }
  animLength(name, rate = 1) {
    const anim = animMeta[this.species].anims[name];
    return anim.durations.reduce((a, b) => a + b, 0) / TICKS / rate;
  }
  // ---- plan machinery --------------------------------------------------------------------
  setAnim(name, { once = false, rate = 1 } = {}) {
    if (this.anim?.name === name && !once && !this.anim.once) {
      this.anim.rate = rate;
      return;
    }
    this.anim = { name, once, rate };
    this.animClock = 0;
  }
  emit(type, extra = {}) {
    this.events.push({ type, x: this.x, y: this.y, dir: this.dir, ...extra });
    if (this.events.length > 64) this.events.shift();
  }
  drain() {
    return this.events.splice(0);
  }
  drainMemory() {
    return this.memoryEvents.splice(0);
  }
  remember(kind, point = this) {
    this.lastAttention = this.time;
    this.memoryEvents.push({ type: "interaction", kind });
    if (["pet", "berry", "call"].includes(kind)) {
      const nearest = Object.entries(SPOTS).map(([spot, p]) => ({ spot, distance: Math.hypot(p.x - point.x, p.y - point.y) })).sort((a, b) => a.distance - b.distance)[0];
      if (nearest.distance <= 13 && nearest.spot !== this.favoriteSpot) {
        this.favoriteSpot = nearest.spot;
        this.memoryEvents.push({ type: "favorite", spot: nearest.spot });
      }
    }
    if (this.memoryEvents.length > 32) this.memoryEvents.splice(0, this.memoryEvents.length - 32);
  }
  say(kind, seconds = 1.8) {
    this.bubble = { kind, start: this.time, until: this.time + seconds };
  }
  start(plan) {
    if (this.investigationTarget && !plan.some((step) => step.state === "investigating")) this.investigationTarget = null;
    this.plan = plan;
    this.next();
  }
  next() {
    this.step = this.plan.shift() || null;
    this.elapsed = 0;
    this.path = [];
    if (!this.step) return this.choose();
    const s = this.step;
    if (s.state) this.state = s.state;
    if (s.kind === "call") {
      s.fn.call(this);
      return this.next();
    }
    if (s.kind === "walk") {
      const to = typeof s.to === "function" ? s.to.call(this) : s.to;
      if (this.reduced) {
        Object.assign(this, { x: to.x, y: to.y, speed: 0 });
        return this.next();
      }
      this.path = s.direct ? [{ ...to }] : findPath(this, to);
      if (!this.path.length) return this.next();
      this.setAnim("Walk");
    } else if (s.kind === "turn") {
      this.turnTimer = 0;
      this.setAnim("Idle");
    } else if (s.kind === "pose") {
      if (s.dir !== void 0) this.dir = s.dir;
      this.setAnim(s.anim, { once: s.once, rate: s.rate || 1 });
      if (s.once && !s.duration) s.duration = this.animLength(s.anim, s.rate || 1);
      this.lookTimer = 1.5 + this.random() * 2;
    }
  }
  // ---- autonomous life -------------------------------------------------------------------
  choose() {
    if (this.pendingGreeting) return this.beginGreeting();
    if (!this.reduced && !this.busy && !this.swimming && this.time >= this.nextInvitationAt && this.time - this.lastAttention >= 35) {
      this.invitationActive = true;
      this.nextInvitationAt = this.time + 120 + this.random() * 60;
      return this.start(this.invitationPlan());
    }
    const r = this.random();
    let plan;
    if (this.reduced) {
      plan = r < 0.25 ? this.napPlan(false) : [{ kind: "pose", anim: "Idle", duration: 5 + this.random() * 4, state: "idle" }];
    } else if (r < 0.3) plan = this.favoritePlan();
    else if (r < 0.42) plan = this.signaturePlan();
    else if (r < 0.62) plan = this.wanderPlan();
    else if (r < 0.74) plan = this.napPlan(true);
    else if (r < 0.87) plan = this.playPlan();
    else plan = this.sniffPlan();
    if (!plan.length) plan = [{ kind: "pose", anim: "Idle", duration: 2, state: "idle" }];
    plan.push({ kind: "pose", anim: "Idle", duration: 1.5 + this.random() * 2.5, look: true, state: "idle" });
    this.start(plan);
  }
  wanderPlan() {
    let to = null;
    for (let i = 0; i < 12 && !to; i++) {
      const p = { x: 14 + Math.floor(this.random() * 132), y: 50 + Math.floor(this.random() * 60) };
      if (walkable(p) && Math.hypot(p.x - this.x, p.y - this.y) > 24) to = p;
    }
    return to ? [
      { kind: "walk", to, state: "walking" },
      { kind: "pose", anim: "Idle", duration: 2 + this.random() * 3, look: true, state: "idle" }
    ] : [];
  }
  favoritePlan() {
    const spot = SPOTS[SPECIES[this.species].favorite];
    const go = { kind: "walk", to: spot, state: "walking" };
    if (this.species === "bulbasaur") {
      return [
        go,
        { kind: "turn", dir: directionTo(TREE.x - spot.x, TREE.y - spot.y) },
        { kind: "pose", anim: "LookUp", duration: 3.5, state: "resting" },
        { kind: "call", fn: () => this.emit("leaves", { x: TREE.x + 4, y: TREE.canopyY + 8 }) },
        { kind: "pose", anim: "Sit", duration: 4 + this.random() * 3, state: "resting" },
        { kind: "turn", dir: 0 }
      ];
    }
    if (this.species === "charmander") {
      return [
        go,
        { kind: "turn", dir: 0 },
        { kind: "pose", anim: "DeepBreath", once: true, state: "basking" },
        { kind: "call", fn: () => this.emit("embers") },
        { kind: "pose", anim: "Laying", dir: 7, duration: 6 + this.random() * 5, state: "basking" },
        { kind: "pose", anim: "Wake", once: true, dir: 0, state: "basking" }
      ];
    }
    const plan = [
      go,
      { kind: "turn", dir: 4 },
      { kind: "pose", anim: "Sit", duration: 3 + this.random() * 3, state: "watching" }
    ];
    if (this.random() < 0.6) plan.push(...this.swimPlan(spot));
    return plan;
  }
  swimPlan(bank) {
    const entry = { x: bank.x, y: POND.y + POND.ry - 4 };
    const legs = [];
    for (let i = 0; i < 2 + Math.floor(this.random() * 2); i++) {
      let p;
      do
        p = { x: POND.x + (this.random() * 2 - 1) * (POND.rx - 8), y: POND.y + (this.random() * 2 - 1) * (POND.ry - 5) };
      while (!inPond(p, 5));
      legs.push({ kind: "walk", to: p, direct: true, speed: 10, state: "swimming" });
    }
    return [
      { kind: "pose", anim: "Hop", once: true, dir: 4, state: "swimming" },
      {
        kind: "call",
        fn() {
          Object.assign(this, { ...entry, swimming: true });
          this.emit("splash");
        }
      },
      ...legs,
      { kind: "walk", to: entry, direct: true, speed: 10, state: "swimming" },
      {
        kind: "call",
        fn() {
          this.emit("splash");
          Object.assign(this, { ...bank, swimming: false, dir: 0 });
        }
      },
      { kind: "pose", anim: "Hop", once: true, dir: 0, state: "playing" }
    ];
  }
  signaturePlan() {
    if (this.species === "bulbasaur") {
      return [
        { kind: "walk", to: SPOTS.flowers, state: "walking" },
        { kind: "turn", dir: 0, state: "tending" },
        { kind: "pose", anim: "Nod", once: true, rate: 0.7, state: "tending" },
        { kind: "call", fn: () => this.emit("tend", { ...SPOTS.flowers }) },
        { kind: "pose", anim: "Eat", duration: 2.2, rate: 0.6, state: "tending" },
        { kind: "pose", anim: "LookUp", duration: 1.5, state: "tending" },
        { kind: "pose", anim: "Nod", once: true, state: "tending" }
      ];
    }
    if (this.species === "charmander") {
      return [
        { kind: "walk", to: SPOTS.sun, state: "walking" },
        { kind: "turn", dir: 0, state: "warming" },
        { kind: "call", fn: () => this.emit("warm") },
        { kind: "pose", anim: "DeepBreath", once: true, rate: 0.8, state: "warming" },
        { kind: "pose", anim: "Pose", once: true, rate: 0.6, state: "warming" },
        { kind: "pose", anim: "Sit", duration: 2.5, state: "warming" }
      ];
    }
    return [
      { kind: "walk", to: SPOTS.bank, state: "walking" },
      { kind: "turn", dir: 4, state: "rippling" },
      { kind: "pose", anim: "Nod", once: true, rate: 0.7, state: "rippling" },
      { kind: "call", fn: () => this.emit("pond-rings", { x: SPOTS.bank.x, y: POND.y + POND.ry - 3 }) },
      { kind: "pose", anim: "Sit", duration: 2, state: "rippling" },
      { kind: "pose", anim: "Nod", once: true, rate: 0.7, state: "rippling" },
      { kind: "call", fn: () => this.emit("pond-rings", { x: SPOTS.bank.x + 4, y: POND.y + POND.ry - 4 }) },
      { kind: "pose", anim: "Sit", duration: 2, state: "rippling" },
      { kind: "turn", dir: 0 }
    ];
  }
  napPlan(travel) {
    const spot = SPOTS[this.favoriteSpot || SPECIES[this.species].napSpot];
    return [
      ...travel ? [{ kind: "walk", to: spot, state: "walking" }] : [],
      { kind: "turn", dir: 7 },
      { kind: "pose", anim: "Laying", duration: 1.2, state: "sleeping" },
      { kind: "pose", anim: "Sleep", rate: 0.5, duration: 10 + this.random() * 10, state: "sleeping" },
      ...this.wakePlan()
    ];
  }
  wakePlan() {
    return [
      { kind: "pose", anim: "Wake", once: true, dir: 0, state: "waking" },
      { kind: "pose", anim: "DeepBreath", once: true, state: "waking" }
    ];
  }
  playPlan() {
    return [
      { kind: "call", fn: () => this.emit("butterfly") },
      { kind: "pose", anim: "Rotate", once: true, rate: 0.7, state: "playing" },
      { kind: "pose", anim: "Hop", once: true, dir: 0, state: "playing" },
      { kind: "call", fn: () => this.say("note", 1.4) },
      { kind: "pose", anim: "Rotate", once: true, rate: 0.7, state: "playing" },
      { kind: "pose", anim: "Idle", duration: 0.8, state: "playing" }
    ];
  }
  sniffPlan() {
    return [
      { kind: "walk", to: SPOTS.flowers, state: "walking" },
      { kind: "turn", dir: 0 },
      { kind: "pose", anim: "Eat", rate: 0.6, duration: 2.2, state: "sniffing" },
      { kind: "call", fn: () => this.emit("petals") },
      { kind: "pose", anim: "Nod", once: true, state: "sniffing" }
    ];
  }
  invitationPlan() {
    const gentle = this.species === "bulbasaur", playful = this.species === "squirtle";
    const near = { x: HOME.x + (gentle ? -6 : playful ? 6 : 0), y: HOME.y - 8 };
    const rollTime = gentle ? 1.2 : playful ? 0.9 : 0.7;
    return [
      { kind: "call", fn() {
        this.ball = { x: this.x, y: this.y, z: 22, spin: 0, phase: "carried", invitation: true };
      } },
      { kind: "walk", to: near, speed: SPECIES[this.species].speed * (gentle ? 0.9 : playful ? 1.05 : 1.2), state: "inviting" },
      { kind: "turn", dir: 0, state: "inviting" },
      { kind: "call", fn() {
        Object.assign(this.ball, { from: { x: this.x, y: this.y }, target: { x: this.x + 2, y: this.y + 4 }, phase: "invitation-lower", t: 0 });
      } },
      { kind: "pose", anim: "Nod", once: true, rate: gentle ? 0.7 : 1.1, state: "inviting" },
      { kind: "call", fn() {
        const from = { x: this.ball.x, y: this.ball.y };
        Object.assign(this.ball, { from, target: { x: HOME.x, y: HOME.y + 6 }, phase: "invitation-roll", t: 0, rollTime });
      } },
      { kind: "pose", anim: "LookUp", duration: rollTime + 0.25, state: "inviting" },
      { kind: "call", fn: () => this.say("note", 1.6) },
      ...playful ? [{ kind: "pose", anim: "Rotate", once: true, rate: 0.85, state: "inviting" }] : [],
      { kind: "pose", anim: gentle ? "Nod" : "Hop", once: true, rate: gentle ? 0.65 : playful ? 1 : 1.25, dir: 0, state: "inviting" },
      { kind: "pose", anim: "Idle", duration: gentle ? 3.5 : 3, state: "inviting" },
      { kind: "call", fn() {
        this.ball = null;
        this.invitationActive = false;
      } },
      { kind: "pose", anim: "Idle", duration: 1.2, state: "idle" }
    ];
  }
  // ---- interactions ----------------------------------------------------------------------
  userAttention() {
    this.lastAttention = this.time;
    this.cancelGreeting();
    this.cancelInvitation();
  }
  cancelInvitation() {
    if (!this.inviting) return;
    this.invitationActive = false;
    if (this.ball?.invitation) this.ball = null;
    this.bubble = null;
    this.speed = 0;
    this.start([{ kind: "pose", anim: "Idle", duration: 0.6, state: "idle" }]);
  }
  cancelGreeting() {
    this.pendingGreeting = false;
    const wasGreeting = this.greetingActive;
    this.greetingActive = false;
    if (wasGreeting) this.start([{ kind: "pose", anim: "Idle", duration: 0.6, state: "idle" }]);
  }
  welcomeBack() {
    if (this.greetingActive || this.pendingGreeting) return false;
    if (this.busy || this.inviting || this.swimming || ["petting", "waking", "eating", "swimming"].includes(this.state)) {
      this.pendingGreeting = true;
      return true;
    }
    this.beginGreeting();
    return true;
  }
  beginGreeting() {
    this.pendingGreeting = false;
    this.greetingActive = true;
    this.remember("greeting");
    const wake = this.asleep ? this.wakePlan().slice(0, 1) : [];
    this.start([
      ...wake,
      { kind: "call", fn: () => this.say("note", 1.5) },
      ...this.reduced ? [] : [{ kind: "walk", to: HOME, speed: SPECIES[this.species].speed * 1.25, state: "greeting" }],
      { kind: "turn", dir: 0, state: "greeting" },
      { kind: "pose", anim: "Idle", duration: 0.45, state: "greeting" },
      { kind: "call", fn: () => this.say("heart", 1.7) },
      { kind: "pose", anim: this.reduced ? "Idle" : "Hop", duration: this.reduced ? 0.4 : void 0, once: !this.reduced, state: "greeting" },
      { kind: "pose", anim: "Idle", duration: 1.2, state: "greeting" },
      { kind: "call", fn() {
        this.greetingActive = false;
      } },
      { kind: "pose", anim: "Idle", duration: 1, state: "idle" }
    ]);
  }
  pet() {
    this.userAttention();
    if (this.time - this.lastPet < 0.6) return false;
    this.remember("pet");
    this.affection = this.time - this.lastPet < 4 ? this.affection + 1 : 1;
    this.lastPet = this.time;
    this.say("heart", 1.6);
    this.emit("hearts", { count: Math.min(4, this.affection) });
    if (this.busy || this.swimming) return true;
    const wake = this.asleep || this.state === "waking" ? [{ kind: "pose", anim: "Wake", once: true, dir: 0, state: "waking" }] : [];
    const happy = this.affection >= 3 ? [
      { kind: "pose", anim: "Hop", once: true, state: "petting" },
      { kind: "pose", anim: "Pose", once: true, state: "petting" }
    ] : [{ kind: "pose", anim: "Nod", once: true, rate: 0.8, state: "petting" }];
    this.start([...wake, { kind: "turn", dir: 0, state: "petting" }, ...happy, { kind: "pose", anim: "Idle", duration: 1, state: "petting" }]);
    return true;
  }
  throwBall() {
    const offered = this.inviting && this.ball ? { x: this.ball.x, y: this.ball.y, z: this.ball.z, spin: this.ball.spin } : null;
    this.userAttention();
    if (this.busy) return false;
    this.remember("ball");
    let target = null;
    for (let i = 0; i < 20 && !target; i++) {
      const p = { x: 16 + Math.floor(this.random() * 128), y: 54 + Math.floor(this.random() * 48) };
      if (walkable(p) && Math.hypot(p.x - this.x, p.y - this.y) > 34) target = p;
    }
    target ||= nearestWalkable({ x: this.x > 80 ? 30 : 130, y: 96 });
    const from = offered ? { x: offered.x, y: offered.y } : { x: HOME.x, y: 126 };
    const away = Math.hypot(target.x - from.x, target.y - from.y) || 1;
    const rest = nearestWalkable({ x: target.x + (target.x - from.x) / away * 7, y: target.y + (target.y - from.y) / away * 7 });
    this.ball = { x: from.x, y: from.y, z: offered?.z || 0, fromZ: offered?.z || 0, from, target, rest, phase: "flight", t: 0, spin: offered?.spin || 0 };
    if (this.reduced) Object.assign(this.ball, { x: rest.x, y: rest.y, phase: "rest" });
    this.say("!", 0.9);
    const wake = this.asleep ? this.wakePlan().slice(0, 1) : [];
    if (this.swimming || !walkable(this)) {
      this.emit("splash");
      Object.assign(this, nearestWalkable(this), { swimming: false });
    }
    this.start([
      ...wake,
      { kind: "turn", dir: directionTo(rest.x - this.x, rest.y - this.y), fast: true, state: "chasing" },
      { kind: "walk", to: rest, speed: 34, state: "chasing" },
      { kind: "wait", until: () => this.ball?.phase === "rest", anim: "Idle", state: "chasing", timeout: 3 },
      {
        kind: "call",
        fn() {
          if (this.ball) this.ball.phase = "carried";
          this.emit("dust");
        }
      },
      { kind: "pose", anim: "Hop", once: true, rate: 1.4, state: "returning" },
      { kind: "walk", to: HOME, speed: 30, state: "returning" },
      { kind: "turn", dir: 0, state: "presenting" },
      { kind: "pose", anim: "LookUp", duration: this.reduced ? 0.25 : 0.65, state: "presenting" },
      {
        kind: "call",
        fn() {
          this.ball = null;
          this.emit("sparkle", { y: this.y - 10 });
          this.say("sparkle", 1.4);
        }
      },
      { kind: "pose", anim: "Pose", once: true, state: "presenting" },
      { kind: "pose", anim: "Idle", duration: this.reduced ? 0.7 : 1.2, state: "presenting" }
    ]);
    return true;
  }
  giveTreat() {
    this.userAttention();
    if (this.busy) return false;
    this.remember("berry");
    if (this.swimming || !walkable(this)) Object.assign(this, nearestWalkable(this), { swimming: false });
    let spot = null;
    for (let i = 0; i < 20 && !spot; i++) {
      const a = this.random() * Math.PI * 2, p = { x: Math.round(this.x + Math.cos(a) * 22), y: Math.round(this.y + Math.sin(a) * 14) };
      if (walkable(p) && walkable({ x: p.x, y: p.y - 4 })) spot = p;
    }
    spot ||= { ...HOME };
    this.treat = { x: spot.x, y: spot.y, z: this.reduced ? 0 : 46, vz: 0, phase: this.reduced ? "rest" : "falling", bites: 0 };
    const wake = this.asleep ? this.wakePlan().slice(0, 1) : [];
    this.start([
      ...wake,
      { kind: "call", fn: () => this.say("!", 0.8) },
      { kind: "turn", dir: directionTo(spot.x - this.x, spot.y - this.y), state: "anticipating" },
      { kind: "pose", anim: "LookUp", duration: 0.55, state: "anticipating" },
      { kind: "pose", anim: "Nod", once: true, state: "anticipating" },
      { kind: "walk", to: { x: spot.x, y: spot.y - 4 }, speed: 24, state: "eating" },
      { kind: "wait", until: () => this.treat?.phase === "rest", anim: "Idle", state: "eating", timeout: 2 },
      { kind: "turn", dir: 0, state: "eating" },
      { kind: "pose", anim: "Eat", duration: 2.6, rate: 0.8, state: "eating" },
      {
        kind: "call",
        fn() {
          this.treat = null;
          this.say("heart", 1.4);
          this.emit("hearts", { count: 2 });
        }
      },
      { kind: "pose", anim: "Hop", once: true, state: "eating" },
      { kind: "pose", anim: "Idle", duration: 1, state: "eating" }
    ]);
    return true;
  }
  callTo(point) {
    this.userAttention();
    if (this.busy || this.swimming || ["petting", "celebrating"].includes(this.state)) return false;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    const to = nearestWalkable(point);
    this.remember("call", to);
    const wake = this.asleep ? this.wakePlan().slice(0, 1) : [];
    this.say("note", 1);
    this.start([
      ...wake,
      { kind: "turn", dir: directionTo(to.x - this.x, to.y - this.y), fast: true, state: "coming" },
      { kind: "pose", anim: "Idle", duration: 0.2, state: "coming" },
      { kind: "walk", to, speed: SPECIES[this.species].speed * 1.3, state: "coming" },
      { kind: "turn", dir: 0, state: "idle" },
      { kind: "pose", anim: "Idle", duration: 3, look: true, state: "idle" }
    ]);
    return true;
  }
  notice(point) {
    this.userAttention();
    if (this.busy || this.swimming || this.asleep || ["petting", "waking", "swimming", "eating"].includes(this.state)) return false;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || this.time - this.lastNotice < 0.4) return false;
    this.lastNotice = this.time;
    this.start([
      { kind: "turn", dir: directionTo(point.x - this.x, point.y - this.y), state: "noticing" },
      { kind: "pose", anim: "Idle", duration: 0.9, state: "noticing" },
      { kind: "turn", dir: 0, state: "noticing" },
      { kind: "pose", anim: "Idle", duration: 0.5, state: "idle" }
    ]);
    return true;
  }
  investigate(point, kind) {
    this.userAttention();
    if (this.busy || this.swimming || ["petting", "waking", "eating", "swimming"].includes(this.state)) return false;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || this.time - this.lastNotice < 0.4) return false;
    if (kind === "flower") kind = "flowers";
    if (!["tree", "pond", "flowers"].includes(kind)) return false;
    const spot = { tree: "shade", pond: "bank", flowers: "flowers" }[kind];
    this.lastNotice = this.time;
    this.remember("call", SPOTS[spot]);
    this.investigationTarget = { x: point.x, y: point.y };
    const wake = this.asleep ? this.wakePlan().slice(0, 1) : [];
    if (this.reduced) {
      this.start([...wake, ...this.investigationGlance()]);
      return true;
    }
    const to = SPOTS[spot], state = "investigating";
    const plan = [
      ...wake,
      { kind: "turn", dir: directionTo(to.x - this.x, to.y - this.y), fast: true, state },
      { kind: "pose", anim: "Idle", duration: 0.2, state },
      { kind: "walk", to, speed: SPECIES[this.species].speed * 1.1, state },
      { kind: "turn", dir: kind === "flowers" ? 0 : 4, state }
    ];
    if (kind === "tree") {
      plan.push({ kind: "pose", anim: "LookUp", duration: this.species === "bulbasaur" ? 1.8 : 1.1, state });
      if (this.species === "bulbasaur") plan.push({ kind: "call", fn: () => this.emit("leaves", { x: TREE.x + 4, y: TREE.canopyY + 8 }) });
      plan.push({ kind: "pose", anim: this.species === "charmander" ? "DeepBreath" : "Nod", once: true, state });
    } else if (kind === "pond") {
      plan.push({ kind: "pose", anim: "Nod", once: true, state });
      if (this.species === "squirtle") plan.push({ kind: "call", fn: () => this.emit("pond-rings", { x: SPOTS.bank.x, y: POND.y + POND.ry - 3 }) });
      plan.push({ kind: "pose", anim: this.species === "charmander" ? "LookUp" : "Sit", duration: this.species === "squirtle" ? 2 : 1.2, state });
    } else {
      plan.push({ kind: "pose", anim: "Eat", duration: this.species === "bulbasaur" ? 1.5 : 1, rate: 0.6, state });
      plan.push({ kind: "call", fn: () => this.emit(this.species === "bulbasaur" ? "tend" : "petals", { ...SPOTS.flowers }) });
      plan.push({ kind: "pose", anim: this.species === "squirtle" ? "Hop" : "Nod", once: true, state });
    }
    plan.push(
      { kind: "turn", dir: 0, state },
      { kind: "pose", anim: "Idle", duration: 0.7, state },
      { kind: "call", fn() {
        this.investigationTarget = null;
      } },
      { kind: "pose", anim: "Idle", duration: 0.5, state: "idle" }
    );
    this.start(plan);
    return true;
  }
  investigationGlance() {
    const point = this.investigationTarget;
    return [
      { kind: "turn", dir: directionTo(point.x - this.x, point.y - this.y), state: "investigating" },
      { kind: "pose", anim: "Idle", duration: 1.2, state: "investigating" },
      { kind: "call", fn() {
        this.investigationTarget = null;
      } },
      { kind: "pose", anim: "Idle", duration: 0.5, state: "idle" }
    ];
  }
  react(kind) {
    const bubble = { working: "dots", completed: "sparkle", waiting: "?" }[kind];
    if (!bubble) return;
    this.lastAttention = this.time;
    if (this.greetingActive || this.inviting) return;
    if (this.bubble?.kind === "heart" && this.bubble.until > this.time) return;
    this.say(bubble, kind === "working" ? 2.2 : 2);
    if (kind === "completed") this.emit("confetti", { y: this.y - 18 });
    if (this.busy || this.swimming || this.asleep || ["petting", "waking", "investigating"].includes(this.state)) return;
    const state = { working: "attentive", completed: "celebrating", waiting: "waiting" }[kind];
    const plan = [{ kind: "turn", dir: 0, state }];
    if (kind === "working") plan.push({ kind: "pose", anim: "Nod", once: true, rate: 0.8, state }, { kind: "pose", anim: "Idle", duration: 1.2, state });
    else if (kind === "completed")
      plan.push({ kind: "pose", anim: "Hop", once: true, state }, { kind: "pose", anim: "Pose", once: true, state });
    else plan.push({ kind: "pose", anim: "Idle", duration: 2, state });
    this.start(plan);
  }
  setReduced(value) {
    if (this.reduced === value) return;
    this.reduced = value;
    this.lastAttention = this.time;
    if (value) this.cancelInvitation();
    if (value && this.investigationTarget) {
      this.speed = 0;
      this.start(this.investigationGlance());
      return;
    }
    if (value && this.step?.kind === "walk") {
      const to = this.path.at(-1);
      if (to) Object.assign(this, { x: to.x, y: to.y });
      this.speed = 0;
      this.next();
    }
  }
  // ---- simulation ------------------------------------------------------------------------
  tick(dt) {
    dt = Math.max(0, Math.min(dt, 0.1));
    this.time += dt;
    this.elapsed += dt;
    if (this.bubble && this.time >= this.bubble.until) this.bubble = null;
    this.tickProps(dt);
    const s = this.step;
    if (!s) return this.choose();
    if (s.kind === "walk") {
      if (this.move(dt, s.speed || SPECIES[this.species].speed)) {
        this.speed = 0;
        this.next();
      }
    } else if (s.kind === "turn") {
      this.turnTimer += dt;
      if (this.dir === s.dir || this.reduced) {
        this.dir = s.dir;
        this.next();
      } else if (this.turnTimer >= (s.fast ? 0.04 : 0.08)) {
        this.turnTimer = 0;
        this.dir = (this.dir + ((s.dir - this.dir + 8) % 8 <= 4 ? 1 : 7)) % 8;
      }
    } else if (s.kind === "wait") {
      this.setAnim(s.anim);
      const b = this.ball;
      if (b && b.phase !== "carried" && Math.hypot(b.x - this.x, b.y - this.y) > 2) this.dir = directionTo(b.x - this.x, b.y - this.y);
      if (s.until() || this.elapsed >= s.timeout) this.next();
    } else if (s.kind === "pose") {
      if (s.look && !this.reduced) {
        this.lookTimer -= dt;
        if (this.lookTimer <= 0) {
          this.lookTimer = 1.4 + this.random() * 2.4;
          this.dir = this.dir === 0 ? [1, 7, 2, 6][Math.floor(this.random() * 4)] : 0;
        }
      }
      if (this.elapsed >= s.duration) this.next();
    }
    if (!this.reduced) this.animClock += dt * TICKS * this.anim.rate;
  }
  move(dt, maxSpeed) {
    let remaining = 0, prev = this;
    for (const p of this.path) {
      remaining += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    const braking = Math.sqrt(2 * ACCEL * remaining);
    this.speed = Math.min(maxSpeed, this.speed + ACCEL * dt, Math.max(6, braking));
    let distance = this.speed * dt;
    while (this.path.length && distance > 0) {
      const next = this.path[0], dx = next.x - this.x, dy = next.y - this.y, length = Math.hypot(dx, dy);
      if (length > 0.5) {
        const want = directionTo(dx, dy);
        this.turnTimer = (this.turnTimer || 0) + dt;
        if (want !== this.dir && this.turnTimer > 0.06) {
          this.turnTimer = 0;
          this.dir = (this.dir + ((want - this.dir + 8) % 8 <= 4 ? 1 : 7)) % 8;
        }
      }
      if (length <= distance) {
        Object.assign(this, { x: next.x, y: next.y });
        this.path.shift();
        distance -= length;
      } else {
        this.x += dx / length * distance;
        this.y += dy / length * distance;
        distance = 0;
      }
    }
    this.setAnim("Walk", { rate: Math.max(0.35, this.speed / 22) });
    return this.path.length === 0;
  }
  tickProps(dt) {
    const b = this.ball;
    if (b && b.phase === "flight") {
      b.t += dt / 0.75;
      const t2 = Math.min(1, b.t);
      b.x = b.from.x + (b.target.x - b.from.x) * t2;
      b.y = b.from.y + (b.target.y - b.from.y) * t2;
      b.z = (b.fromZ || 0) * (1 - t2) + Math.sin(t2 * Math.PI) * 30;
      b.spin += dt * 14;
      if (t2 >= 1) Object.assign(b, { phase: "bounce", z: 0, vz: 34, t: 0 });
    } else if (b && b.phase === "bounce") {
      b.t += dt;
      b.vz -= 160 * dt;
      b.z = Math.max(0, b.z + b.vz * dt);
      const roll = Math.min(1, b.t / 0.9);
      b.x = b.target.x + (b.rest.x - b.target.x) * roll;
      b.y = b.target.y + (b.rest.y - b.target.y) * roll;
      b.spin += dt * 8 * (1 - roll);
      if (b.z === 0 && b.vz < 0) {
        if (b.vz < -12) {
          b.vz = -b.vz * 0.45;
          this.emit("bounce", { x: b.x, y: b.y });
        } else b.vz = 0;
      }
      if (roll >= 1 && b.vz === 0) Object.assign(b, { phase: "rest", x: b.rest.x, y: b.rest.y });
    } else if (b && b.phase === "invitation-lower") {
      b.t = Math.min(1, b.t + dt / 0.28);
      b.x = b.from.x + (b.target.x - b.from.x) * b.t;
      b.y = b.from.y + (b.target.y - b.from.y) * b.t;
      b.z = 22 * (1 - b.t);
      if (b.t >= 1) b.phase = "rest";
    } else if (b && b.phase === "invitation-roll") {
      b.t = Math.min(1, b.t + dt / b.rollTime);
      const t2 = 1 - (1 - b.t) ** 2;
      b.x = b.from.x + (b.target.x - b.from.x) * t2;
      b.y = b.from.y + (b.target.y - b.from.y) * t2;
      b.spin += dt * 9 * (1 - b.t);
      if (b.t >= 1) b.phase = "rest";
    } else if (b && b.phase === "carried") {
      Object.assign(b, { x: this.x, y: this.y, z: 22 + Math.round(Math.sin(this.time * 8)) });
    }
    const t = this.treat;
    if (t && t.phase === "falling") {
      t.vz -= 220 * dt;
      t.z = Math.max(0, t.z + t.vz * dt);
      if (t.z === 0) {
        t.phase = "rest";
        this.emit("bounce", { x: t.x, y: t.y });
      }
    }
    if (t && this.state === "eating" && this.step?.anim === "Eat") t.bites = Math.min(3, Math.floor(this.elapsed / 0.8));
  }
};

// src/assets.generated.js
var assets = { "bulbasaur": { "Idle": { "width": 32, "height": 40, "durations": [40, 6, 6], "rows": 8, "anchors": [16, 24], "url": "data:image/png;base64,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" }, "Walk": { "width": 40, "height": 40, "durations": [4, 4, 4, 4, 4, 4], "rows": 8, "anchors": [20, 24, 20, 23, 20, 26, 20, 27, 20, 28, 20, 26, 20, 24, 21, 25, 22, 26, 23, 27, 24, 28, 25, 26, 20, 24, 20, 24, 21, 24, 22, 24, 23, 24, 24, 24, 20, 24, 22, 22, 23, 21, 24, 20, 25, 19, 25, 19, 20, 24, 20, 23, 20, 22, 20, 21, 20, 20, 20, 21, 20, 24, 18, 22, 17, 21, 16, 20, 15, 19, 15, 19, 20, 24, 20, 24, 19, 24, 18, 24, 17, 24, 16, 24, 20, 24, 19, 25, 18, 26, 17, 27, 16, 28, 15, 26], "url": "data:image/png;base64,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" }, "Sleep": { "width": 24, "height": 24, "durations": [30, 35], "rows": 1, "anchors": [12, 16], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAYAAAC8/X7cAAACkElEQVR4nO2Xr5OjMBTHv9zsH3DrKnHZddRFVlJ3cqvYunVY6nBFXt05pgq7jsrKOOqYOGQdf0JO0KQhEBbYPXOzb6ZDA+Hzvu/lxwsO5pkw2s5Mzhj+IPvHDLAo6wxlnUEIAbK/35/IsvKDnCAtQgQ50dmf5osgJ6KsMxHkRAQ5EWQP9f8LHIggJyItQlHWmSB7iLQIlR8b3zYC5gvilg0kLAa7cKwWPgAgok1by9Zc8QCAV+83fv3ZIPJDnK8nRDQG9Yg+0h8GIMo6Q1qErUDYhUNe398y1ZlVDO9vmXo+VrAmRtzEYbXw8ZQ4oB5RvljFVBB9Zl0D1KVqHgY5Ad81QOoRsIqpfufrqdUeI95I0J3t0pZ/nW9L0IMJv4GVKDlVkAPHNQcHB/LmFt8B2HPAm6L/LjAtGoFAw2Z+2yf1SDNdfd/KMbcoUdZZp5OZ8eP6ng05/HxnZbb4aRGCurQzajo3yAmOa9659vH1hoIDzWKNaNxykrBYgdIi7DhlFy4DsQUxOkGGaCu/tQZ08fpVWkRj6AJkW+4gkR9adDfi5fQ02dSloC5tJWS18CHrzRBfBqC2MVNwn+kjJfuptTJgUxI0lq9GQO+gv5CwuDNfdfjQPc0mJ2gsf3AbTdhwZlnFOvPXZnMSNIZvDUAWEADYLg+dZ73OJhSzoQRN4csAHFMkdSmeHzfYLg+w7Rzn6wlPP1/AKobkdPhoB+q8b0vQFP5D30sSrAuXEOqR5vxzy5LjWLfl1v3t8iDKul1pnx83yo88Y03ldwqZuYD0SmnWiduWN/ZbQMjaYasvc/h9D3tPlPpozBCv2H0JOq75V/Htjss6U+dzfO7sL/p+c/lTIhz9mTfT/jX/277tv7S/8dn5dOvjrPEAAAAASUVORK5CYII=" }, "Wake": { "width": 32, "height": 24, "durations": [8, 4, 12, 4, 10, 4], "rows": 8, "anchors": [16, 16], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAASRUlEQVR4nO2dK3MbyxaFl27dHxAzQzPZzGHDYjhhhkdIDgvTgRITk+ARM7ONfGCYBH3ZMJs5YoFhzj+YC6Td2tPT8360qrRWVeroWLLW2t09Mz2P/jwA1USx9f8DLylOS9LmA8fPbBX2x39qBrAN44x/Xakvn1zf8XqIh9cJ3j+ee4yQzuHJOy9PV7ni949nPLxOxBPY98P7xzPkv3EcY7iA/kymqm4ArQeo4g018N4/nl0Dr4uOMN8jg13+3ZyHCC6Chl9fPUfP9Se+32f/u+odr4cAgNv7EabBHMtojsvlAMH1sNSX/rfNAD++P2MZzRG9jRBcD7HFtsLXZ/sCwMPrJDHYol+RPfji4QKYhhO8/N7g5jwEACw3K2xniFFvehJr32U0x8vvDQBgGswRXASIfkXmZzqvQ3WnRz7rT3y/z/5//3hOtPV4PcTT1y2ity22s937O+8tpuEEy81KPpNbe5lGcQYAgKevWwwXyAwQXO9ClvRxeo/XQ7Nli6bB7nX0KwIAfPu8wnABBNdDRG+7RpfXNTOYmm1JDskgOV5+b0x7ZAzCqhkAf/UnMgD++t/VB1K3tLm00e39bsO7OQ+x3KwwDSf49nmV6180BYr1oTa4CDAN5rg5D3FzHmK8HmI7222NAEyDi2QA1JTpfCA54ESyBxT/p687/2k4MVmit628X/ZwbA7pLk2DucmyjOa4OhtJI5tBuNysEL1t8fJ7YwZCDfmqP5HBZ//LRqU3fskh37+famEZzWUnA2C3UVpHZqfyNoBeAuTJ7nQ9+K7ORonBJx0xDeZm0EkHVO2Im/MwVbMM9quzkdkDTYO5mYvv93SZg7DOnNhX/Xt5739pZy1dd3ARYDvbbXhyNAIOvnI0zFPuOUBWANH7xzO2sxWw2M3D6gTIUOLQJzn0XFzevzob4eY8RLTYmoG7nQHT13DfQCugWv8Pvn1eJfyX0RxPX7eZRwU9QFyH4wjbqnNin/WnfLX67n99nnN1NjJTMdnwH17NNCflWWbamfWmc+5lB7DDSAMo88IAZbyX0dw5BdDvXZ2NzHx0vN4NPD0vrzEHd558unR1NsJ4vdvTy4ng09et+d2rs5HuqKIMx1C/z/5P+Nsbv8huE50DQOn2LtwAug7g8n543Z1E6rm2TDGyBqTdETL1aNoRDwDu4hiPb39n+gIwA10PQj1dkasWJXIcQ/1e+197y0YMuC9K2Jm0bs7DwgyuN1IBsvY+bQRw+QPFxWbJ7ogKAy8zz4O8KjgatDQIfdff6wB0+cvO4+pshDiO8TgY4C6O8fPPv4W/rDPU3gB0AN0YZW76VA2QodKDziXX5boaGRJZgi/AZTjGY/ipMI/eYytVGgQe6+91ALr89YZ2eb/B4+yptL+W2hnUOwIAh5OeMnNh2xxA3Q0A0INgr+ALgB/PpTfGNjPcLcoNfu0tg7DmBuir/lYGYMO2j/PG2zKaF96FL+ufeQ5Qd8DbdysbDD5gvzfSl/GWmxV+fHcfijvIkNoT396PMA2z5+Ft+3uq/xj6P1W7TMckm+wIZGcjG4W+elV3A0gF+PZ5lTixkwJ1EC1r/tjkNry5dm77ax/XHiH6FTW5C2v89Y0ee/D34S8veq7/GPrfed/EdY7ielSkyVWgVAD7urQ+OYqtw2OLg9/kGC6Q2PNpD5c/0OgRhJQ/kJ4Gylzf9pcMbfp7qv9Y+j+VS3vKuYr8f9v+cRzH8cPrJH7/eI4fXifxeD20nzI0n1HvtfUkYDxcJDOM18N4uEh4mPcfXif6vTYypPwtD+PveK8T/77r99z/ubm0nyNDd2auz+S819i/RIYun0U/eX/P/Z+Zy/LrNEPfxR1jhlP29107RVEURVEURVEURVFNRI5NM9lXRdie3UvanFygHnxyfckFyszT2f0gcoFALhC5QIefkQukPkcuELlA5AKRCwSAXCBygcgFIheIXCBygerUv5f3/icXyMpBLhC5QOQCWSIXiFwg+Ry5QOQCASAXSEQuEMgFIheIXCBygcgFIheoaQZygcgFyhW5QOQCteRtMpALtM8hL8gFIhcIIBco5UEuELlA5AKRC0QuELlAnWU4eX9ygfov7hgznLK/79opiqIoiqIoiqIoimoicmyqy74SwjbsVmUgA7HjZ6VUBotSBrXh4xJZl9e9cyVoELXW1uc18K59ffZ/PFzs7jRr7Iq1xtngaupkKFwU33WAPO+Mf0ayHtcxEDtXcBHg5jxMcIIUL6eNHMdQv8/+B7BbU3G5HJgFOLf3u6eTXQv962QofBZIlvoF18m1rgCcq5T2j0+38uzLNJwAgHnYy3q2JZYleRkPQTXJkXfYNQ+J6TW6Io0safIkpOf6TQ5P/Z/w1pgV1/JPkfSJWrdcmKPwadCuAxR5u1g32xlkb5s5CNWilMpPQeYNPnvwa2/XyrmabeGz/lQGD/0P7I8swvd5+b1JrbnWT6u6Ht0uszHmToH0s9i6IzQPRhgxQkoDDodm1Dskpjp/Gk40ZMk0uqtozdGpy8MRto80unS+LPr+9nmFq7NRYuBnLRt1TBmK5L1+kaf+N3r5vUmhVqTNhwtkDn5BuZTJkItFMQFCFeC6XABg1xBXZ6MYFfcEghK5OQ+Ba7UIZL3b8oO1LHRYGR/XAJwGczxhlPp5juLhAqnBp+kKLjyKnnbYz8zL6qWnCphAj/Un5Kv/RbLByco6aX85+gTf5WhzaIfE7zuwLrZyjwBZAeQwHFwEZm+oeTFVAmRJvv/mPDRbvoCYpOFlT6MP/9GvKOFbdU8k89ub89AcCdTeFEB68XdwESQAWfZ0pM65gK/6tXz2P4CB7P2jt22K9yNTQACG0C0Z5Igs/YKc+kstiHHxXmzmjbzO4smU8DKeRXwb6fQiVk6NDLHgPDTzxoZd5UGyRA1ORn3Wn8oC9N7/CX8bfOValORaJQeg1Il5IR26KMB4PUzM/VwBKmqwpxnvtvrrw55Ib/muovU0RCR7zrLSNIXgIsB4vRt80WKE7Qz48THHzWuUuTA9+hXh7vofRJ9rnwh6rd+Wh/4XGT6Srsf+zowNPXGelDcVy70KJAHyDLNkr9yvehRQPBsA1akUWhWvSpi9ns31KcoQ/YqA/WD5Vt7PmcFj/SZDnf7XA7BB/zv9y4y9y09/GYzLYDAwR8usK2JV/j5AqQCyZzxwhYLUnLmsZCuu84co9GDcq2zjDwDE2xkMy9O1GN3ld7f5g59fgOh/laJmylP9mSrT/4YjFP7cD8D6/V/W06nlnTki5V0MKDwCANUOZfpQ7OALlT4CVPE205HbUWrw1dwTx3UGn2wEj7OnJt6A//orZxCZPfBijJ/fD1OvukeAIv8iemHRDcnCI4B9l7Eo0G7O1Q4bpqy34fX8c7gy0JQKYA/8PH8hQPz4/ozHMAJmqY/Uks/6q2YQ/fzzL4KPZ/xUv9OQDZXL/9FTrCyOUJ53KS6Qi/ni4sFoKnLZAFnecjc2izfjyuVAEtaeg1f1l43AekygN3+g1foBv/1vMmTxfjLOMVxqxgVyNcLlp78wGOx+1fW+FabxIADg9Hd5396PWmXxuAah9s8hJLf6PJSH+gG//e/0F2+ZXqssnT2WHu+DxA+vkziO4xSKQt4TbozjM428hwsY5o313fFwsfPX3hYzpzX/949np79de1f+Huo3GTz1f+L71ffG4/WwbZ/iIOqf870OQxU+i2550799HUv/2z87KvkM5btBTt3/WDJQFEVRFEVRFEVRFOUSmTbNZF/xYHt2L2lzFxfIVmF/lOECuQI4r0U7/nWlvnxyfcfroVmN1LN81a+98/J0di/Cws8A+37Q2JY4jmURT2GGqhtA6wGqeEMNPLXw2vkZtNcR5ntksMu/Oo8pt5Gj5/oT3++z/131ylO7t/cjQ8O4XA7MM1lFqrIeoDCAICuit93SwW2FheB5vkB6QYhjRZZ5dkYeFgPM38mK0eCRYI0ekQUasubU/pu8yO70RowiT/Unvt9n/8sSVWlrWTAkC5Zk4YvGuOw/k1t76RVSdgAAznWqNkemDTaNbNkiDZ8CdoQEvYILOLyumcHUbMvFANJ/lC1nEFbNAPirP5EB8Nf/rj6QuqXN7TXbwnGahpPCR7EL0Yj6UCsrvYQFo/kwwAEnImqyFhWq8wH3yiDZA4r/09c9wSycJNAmdbg8WfN6zQBaRrtVb/IEqAzC5WaF6G2Ll9+bxCPSFeWr/kQGn/0vG5WLwiHfLwv2l9E8xRCyl3O6lLcB9BIgT3an68EnKA4ZfNIR02BuBp10QNWOuDkPUzXLYL86G5k90DSYJ3AoQPYgrDMn9lX/Xt7734VV0XUHFwG2s92GJ0cj4OCrUSpZyj0HyAogev94xna2Aha7eVidABlKHPrslUiK+oWrs9EOJLXYmoG7nQHT13DfQCsDdiqpwbfPq4S/LPTIOiroAeI6HEfYVp0T+6w/5avVd//b6ww0rgZIUytsfhBqLohxzr3sAHYYFz+mKEAZ7zIMHJtX6eLpVMziPPl0SZbj2exKm51TcmngMdTvs/8T/lnLMO02sRYjlW7vwg2g6wAub8Fh6Lm2i0SsZXeEjTSpkWOXBcBdHOPx7e9MXwBmoOtBqKcrCnNSCs7luX6v/a+99V+kL7rfYk/Vbs7DwgyuN1IBqrCAqgZw+QPFxWbJ7ogKAy8zz4O8KsEFamEQ+q6/1wHo8pedx9XZ6IBZiWP8/PNv4S/rDLU3AB1AN0aZmz5VA2So9KBzyXW5rkaGRJbgC3AZjvEYfirM41icXtXfZ/29DkCXv97QLu83eJw9lfbXKkOkyD0CAIeTnqpkMn2NOi9Ajg6DYK/gC4Af6T8K0UeGu0W5wa+9ZRDWJWN4qr+VAdiw7VM0CC2bOtjEP/McoO6AdyEs8gIUyFABRAYV3k+G1J749n7kJEV05e+p/mPo/1TtMh2TbHm8IFHdDSAVQFOSdYEuPoy81xKcyVw7dyEK8zg5wuppiAmJ9Y0ee/D34S8veq7/GPrfed/EdY6SxQ8q8i68ImGb2sYAEFuHxxYHv8kxXCCx59MeLn+g0SMIKX/AjeZ2+UuGNv091X8s/Z/KpT3lXEX+v23/OI7jBPdlvB6mEBXyGfVeW08CxsNFMsN4PbTZN+b9h9eJfq+NDCl/y8P4O97rxL/v+j33f24u7efI0J2Z6zM57zX2L5Ghy2fRT97fc/9n5rL8Os3Qd3HHmOGU/X3XTlEURVEURVEURVFUE5Fj00z2VRG2Z/eSNicXqAefXF9ygTLzdHY/iFwgkAtELtDhZ+QCqc+RC0QuELlA5AIBIBeIXCBygcgFIheIXKA69e/lvf/JBbJykAtELhC5QJbIBSIXSD5HLhC5QADIBRKRCwRygcgFIheIXCBygcgFapqBXCBygXJFLhC5QC15mwzkAu1zyAtygcgFAsgFSnmQC0QuELlA5AKRC0QuUGcZTt6fXKD+izvGDKfs77t2iqIoiqIoiqIoiqKaiBybZrKvirA9u5e0OblAPfjk+pILlJmns/tB5AKBXCBygQ4/IxdIfY5cIHKByAUiFwgAuUDkApELRC4QuUDkAtWpfy/v/U8ukJWDXCBygcgFskQuELlA8jlygcgFAkAukIhcIJALRC4QuUDkApELRC5Q0wzkApELlCtygcgFasnbZCAXaJ9DXpALRC4QQC5QyoNcIHKByAUiF4hcIHKBOstw8v7kAvVf3DFmOGV/37VTFEVRFEVRFEVRFNVE5Ng0k31VhO3ZvaTNyQXqwSfXl1ygzDyd3Q8iFwjkApELdPgZuUDqc+QCkQtELhC5QADIBSIXiFwgcoHIBSIXqE79e3nvf3KBrBzkApELRC6QJXKByAWSz5ELRC4QAHKBROQCgVwgcoHIBSIXiFwgcoGaZiAXiFygXJELRC5QS94mA7lA+xzyglwgcoEAcoFSHuQCkQtELhC5QOQCkQvUWYaT9ycXqP/ijjHDKfv7rp2iKIqiKIqiKIqiqCYix6aZ7KsibM/uJW1OLlAPPrm+5AJl5unsfhC5QCAXiFygw8/IBVKfIxeIXCBygcgFAkAuELlA5AKRC0QuELlAderfy3v/kwtk5SAXiFwgcoEskQtELpB8jlwgcoEAkAskIhcI5AKRC0QuELlA5AKRC9Q0A7lA5ALlilwgcoFa8jYZyAXa55AX5AKRCwSQC5TyIBeIXCBygcgFIheIXKDOMpy8P7lA/Rd3jBlO2d937RRFURRFURRFURRFNdH/AVtdV2wcNgTAAAAAAElFTkSuQmCC" }, "Laying": { "width": 24, "height": 24, "durations": [12], "rows": 8, "anchors": [12, 16], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAADACAYAAAAeGqO6AAADlUlEQVR4nO2Yq3LjMBSG/3T2ATYssEwNS5lgYMoKNyhTtsw0YWY2DSvzBHnfIIWFYi7zmgWWed9AC5QjS5ZyqWc6IeefyeSi4//oYh19MfDNGl0RoyOxOhYY87u7ZF63JYoqcU31ai9QtyXoXWsNkcUTn0ug67YMflvtBQDg+XWJtUyRqxQP+QhyJi701TE5muuiSvRqL+wLgBZZ177aCy0y6KJKtMhgY1yzH+d6Le8l5L2EOijzwx7YPTWgUaiPxuv5fLLADo1n6E6RrtsSuTLDdiXvpTU4zjVylaLZdDHNBnj/fAumwxuB7amj6XhpP9dtiWazBbIGzQY2GRmrjya4nm6r2IJiOl6ibkuog8LL49b7DHQJaAQ9z3gCGgVNCylXKdYy9UZLiQCgqBL6HiTwzN8/3zyjc+qv1XyyCJLcuYEvj1trHluPvq7piDcCoFvUokqCaTon6lB/BHYNhhq61zjr4k8RgNHL4xa5SqEOCuqgMB0vgzkmU3VQdhO6bbF90K9+dpu700YX757Mfa61xt9/f061X6zQWmutiyrx6hH8GmNjnLZTJfx0kgsXDzKOGbBYNxZzEXNRl4gMmIuYiwIxF3ltzEVBzBDjmAGLdWPFdt01zBNjpaj62KJFZkqByz3HQ95yUVElVEou7pOAi+RM4CEf2RPs+dWU714SALg6ie19jHPqtvR4yOUkqlc4s+s9qphPFlBHrpEzYShBmt4TD80nC9PulGqqvNPxUqO3Ll6C9883QwfGA80GyGcpAEMQMXOgO3LrtgyS+Fx05Bo6OERmSE5kJpn8LY9H6tbrub0+co5HD5wY79CROh0vvc+neIq8+2zq8o1nTFrthf1+iaX6I9BFlQTn6lcYaT5Z2CQ0irN/QK4xp96vZWpH7sJCMEVuL64VsRRN2Vqm2MH8FkxRH0WA+NyeUp+Ngn3gGtI7cRC9k3KVYvfU0H+4KLoEtyntVtfo4ecvjEYmNNbu/oeIeAayNaeoEq21DpjIrUMnYq7SRSZa7cVg8692gsX6RvHzIn5e1CUiA35exM+LAvHzIq+NnxcFMUOMYwYs1o3FXMRc1CUiA+Yi5qJAzEVeG3NREDPEOGbAYt1YzEXMRV0iMmAuYi4KxFzktTEXBTFDjGMGLNaNxVzEXNQlIgPmIuaiQMxFXhtzURAzxDhmwGLdWMxFzEVdIjJgLmIuCsRc5LUxFwUxQ4xjBizWef0HDI9zfRHXZooAAAAASUVORK5CYII=" }, "Hop": { "width": 32, "height": 80, "durations": [2, 1, 2, 3, 4, 4, 3, 2, 1, 2], "rows": 8, "anchors": [16, 44], "url": "data:image/png;base64,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ZR5M7rOonW23P7oPQ6P4Fl887Nz+Kxp96rY9qUKv9c3499FtHFMEUQDk4xABwNZaXF+qsIDjIsA3d+hzWeVzHyy3Hzxh7XUtamfb7Y/msgjkSRXaVGn+HLoUTpkLwTvN9Nh/vhibnw9bGV+WYi0FsgzJmF8MAAQ3Fw8Y3ScMv/MUGF82br+NGs7a6ERdPN0O9tr+n24H6ETdSj8fxeVSxJxa86eo8czld5RSmWUxxnK0yto0vxxXYYnq5noO0ocqtO6Lg/xZ74BM9MuSI1kbaLEA4HIpFpFLzotAjpcirvWl6vw56BBYPvNAvsvwWz4VzfhMhCoFcil6c5g9X16JYr68DJEM0W2uhCCqWRAEAZ5uB0UFlaJD7W23P6r90f3qUluPvRYeldIFFyErYR57rfTnClfCZNqxkD/7FkF0qvan6WV3HhvXaYON1e9ztz+rpVhEjrgsAmkuV8LAYv7sdVpB/mRQYK0Ko8kEpYV3AFZhieqnFwIA2HkxDKDyozDn+ZOZb3N9PbIN982iB1H1vFiKCIf5k6n+HHIm+CmtBySiQl5UoWExf3YNEdV8ubLi0DPBK16JQUT1c70Sxnr+7F0FPvQzEYjo5LmuQmu28mdnAMafsU9nghNRvVyuhLGeP3uNAB19KhoRkdX82es0GMfX4yOi78tq/uw1AjzmTHAioirYzJ+9L4fl+ExwIvrGbOXP3heYlMte73MmuHFpbB4CE1EZVvNnr0NgpRTevqZ7XY/s7WuK9EIURETl2cyffUdoa/e46UNpjrhvIqJtrOWP758JQkRUhPlDRERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERESnRy2/iI72f647QHQACT01nLXRmoTyO5d9oRMWuO4AnR0Jhaq3LbUMPMTvif5l1Agxuk9stFfYB/nHcNbG29e0zraJaA82Riaq4Kvw78NZW80X46r7oFqTULUmoZovxmq+GKvWJFRhD0oppYazdh2jMd2HsAf91ZqEHAmeMB4Cn4ZDAgjzxRgFtzm67bAHKKWglMJ8MTYPPRWWI7PWJMRw1kZ0FVXU7LpO1EX8GaMfd3F32QQAPE6vEV1FCHuQPtmgR5+dqIu/z2NEjfTn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191Tw1k78/N8Mc58mb8zbktE50O1JqFS6Ym1Nvdv6/mz9dByOGuv1vzlzjw/h7PAiehotqeeasmfnVXg/KV15GKjRer4QBoi8kItVWjb+bMzAIuOrev+QBoi+p5s589ea4HzJz7mT4K09XkIREQ282evADRPetx0hVsLZ4ETEVnNn53nAcpko0wwysmG5jW/gMqvRUZEZD1/di+F+4xx/eMXgPTkQ0lj87MQpGELH0hDRN+Y7fzZ60Ro8wez/LxMV5gXLqjwLHAiIq/yZ9MJkPmLFfIEaCKqmhf5w3AjIleYP0RERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERPSNBa47QGdBLb/b3p6U8W9uu1Ta/7nuAFVCIRsOtbY9nLUxX4ylH1baAKDCHhD2gNYktNnWzn44apssYACevjoCaC+W+qCGszbCHhA1QgDAa/MDYQ822trYB/gRwFQxBuAZcRCCqjUJ8fY1RT/uIv6MzT5U0Q/VmoToTwfoNNuI3xN0mm0AQKfZzoegrZGZDwFMljAAT5vtAMq0lf9qTULcXTZxd9lEJ+oiuooApEFcVRhL6L19TQEA0VWEx+k13r6m+Ps81kFkaRTsQwCTRf9z3YEzUUcRYG3nkgACoMMH0CNB3Fw8qJJ90m3KffbjLkb3CYaztr6R2bbcRv5PBX3A29c0Ez5AGozxZbx226raNNspCmAA+Ps8xk88IHlJAzi6iiptuwCLQBXjCLA8m3NwerQlo6rl/BOGs3Zh+AFpAPXjbtk+qbAHKKUwX4wRf8b4+ecBQBq8T7cDAMDT7QA3Fw+4uXhYu4P4cz2gDhQkL2kIAcsgXN5n8gL0pwMkL2l/bI6CNwZwweOzuR1wDrJ6DMAKVbzxOw+gqBHiuh+gH6eHt3+fx4jfE4zuk8zt5A1A+tCJuvqQuGwID2dtJC9p4MXviQ4jADr8LB6G+xDAnIO0iMPocpSMyADg7rIph0Hyq1KHn61JiPg9QdQI0Ym6AICffx6QvKQ3GM7aeLodwDj80oeqpmV/Du2LCnvpXFd/OkDUWB1uSwj9fR6jH3d134SEhITRse0PZ6tDTwCZ4JXHnG9LyGF4J+oe277ug7zZSAjF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bmf9EMysvhYdFlcoSJ9YPRe5bQ6ORQA6O4+N33h9/wePjd+bTvIOnm4HSqn0dq/NDz04qZCV/Nn3hs4uCe9BFZbou3N9FoC1/Dn4ROjhrK2vyAJAn2xscwmYyazCmvN+RGTNvmFmfbBRdf7sUwTR83DmWly5HljRWtyqL0bgQRWWiNywmj97V4HNk4yB9Jw7c2G0zQsSsApL9L25zB/VmoQK6XG4ak1C1ZqEKuxBf8nvw15ajpbbV9X+cNZW88VYzRfjbferbzOctU/2CrVElOE6f6ADRRqZL8aZ761JqDth3r6qDmD/c33O4nMKiEhzmj969IX0irBqOGur1iRUw1lbKaXUcNbO/B7LpOYojIhKsp4/O+cAC086zF0QcfmJ9JnfszJLRGW5zh+dwJKu5nG2mbrye7k9R4BEVJIX+aOLC8bkoh52SsO2Gieib81q/uw6Ty6zEsNcfiJXhQVWa3HNFRo8F4+ISrKeP0fNAQK7r4jMOUAiKst2/uwcAcq6OzOFd63FldtXuCaYiL4f6/mzcwSYP7N6349fPIerxRKRW7bzZ5/RmZJPY9tnWClL0SxeEJGIvg+r+bP35bDkH9KZPKPRQ++biGgba/lzTEhtKy8z9IjIJuYPEREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREZEhcN0BOmlq+b3u7Uht+D23ZzrI/7nuAJWisDkMbLWlv4azNuaLsfyt1nZFaxJiOGujNQlt92Nrn2psmyr0P9cdoL2t7WDDWRvRVYSbiwcFe6MfBUCCDgAQf8Z4+5rqf9fZLgA83Q4gIdifDvDa+UC/H6A1CTG6T6oelRY+70+3AwBpAN9dNvH2NZW2OQo9IXyx/LcxgO4umwAgO6ON11LNF+NM4HWiru6DqeI+bGz35uIhE35/n8f4+ecBnWb6ZtCPuxjdJ1X0Ze8A/ugoXPcDRI1Q2q6ifaoBXyS/uQog3XY/7upfSNt5cpuqgmdbuxKAEn7xZ4zoKtIhCKShlLygTF98CGCqAecAy7E596ODIL8TAkB0Femvt6+ptTmwTpTu0KP7JBNKJvm79LuKfmxrtz8d6LAzyfMEoMzzsfV5N/sgAfz3eYz+dID4M8bdZRNh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z1MlItrFdv4cdDWY/CW5ZXKyNQnRmoSZz8flSchEVCUb+bMzAB8bv/W/JXGLOpGv1JzSNcGIyE+282eviyHI1VXyH7m39Tp9J3A1WCLyntX82TecFJB+2M7Hf//uvDEvREBEFbKWPwd/apT5mbk7Gj7m/omINqk8f4764HAAmc+8zTV67P0SEe1Saf6UCar8QmOGHhHVhflDRERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERE9J0FrjtAJ0ctv/u07Sjj3z71izz3f647QAdTyO7wtbY9X4wxnLWlHz5QrUmIsAeEvfRn1N83BbevCx2JAXhaXAaQmi/GNTe5kwp7wGvzAwAQNdIgrPn58SGA6UgMwNPhKoCUtB1/xujHXbx9TdGahPK32vsi/w57QKfZBpB+j98TdJpt9KeDuvrnQwBTCQxA/7kMIDVfjCHBG11F6ERd3F02cXfZNPuQ/7LWFwmXsAf8fR7j7WuKx+k1oqsIAPD2NdVhaKMP8CuAqSQG4OHqPMRxGUBqvhijH3fRj7uZP0jY3F02JZDQmoQw+mqlL3nxZ5wJOgmht69pRc2u98FxAG/sG+rdLs8GA/Awdc7BOQ+g+DNe+93NxQNuLh7wdDsAADzd6tEOfv55QPwZY74YQyllzokda+PoN3kB+tMBkpdVXyX44vdEfl9VRdiHAN7YN85BHu9/rjtwQmqfg9sUQGI4a68FUKfZxnwxxvWPX7juB0heoHB4EChz1Gm2LWEkAQgAo/sEMiICgH7cRfz+gKgRIsHRI6HM8x1dRYiuotVzMknbBdLAQyMTfPLcHPPYM30AoB+zBFtrEmJ0n6CPNICjifUA3tg/mYO8fg8QNUKglx6GV/DYvwU+QbsV7gSA3gFtPIeFYZsPIAlAAAUBlCBqhMf2UbcvgWMGobTRibr4+ScNurvLJoD0ENCcCzsyCPToFwA6UTfzR7NP+TCWNwMgHSEv/3bMa7Rx1Aekj1MCOOylBZCCAD627Y19Wn4PYMxBPjZ+4/X9H/SnA/28l3jtvxU+OdvtvRPklH1eXQZQpm3zMW4KZQmd0X2C1iTti+yMR4aAGs7a+s1GAtAc/eb7kn9zMp+PI4LAhwAu7JO0J294Zh/NbaHEm8+3wjnAzVzNwa0F0NPtILPzA6udUkYccjsAOvykQnkoebxPtwO8Nj8wBKDU5ocSvyeZ8DP7dQQ1X4x1wccMP2P+dY15ezOwpD+H2jX/KdtAdBXpfuXDD0BV1WCf5yBP2inOAda2FMvVHJyM7p5uB1BK4Q4BHpXCx3//Fvdzeei1FkDH7fs6QOaLMdB/3Hpb8zAcWI1A5d9lmCMtc06yNdl9v5n5wsMcNP9ptmfeXtq+u2xiVGIeFPB6DjLTz6WTGnGeVGeROwyAvf67nIPLtH39Z4rXl9HGADR3SAliMxCPnQMcztprh93bmIdmyQv09wPbPujwu6gP+T4fsa3sPf2wT38AHD0N4OEcZGE/W5NQv+kZI/+TyJaT6ORSZsOsKwBdFQEcBVCmD+aIUkJ2W7/yUwVHzIGp1iREJ+ri5uIBSim8BttHv0IC8+6yqfsXf8Z4bPxGEAT79sGHANb98GwOsrCfYQ/46Chc9wMdwiXmfmvnfQdRfxXWhyIA4CaA1vog/9g3kM0+HBOAh4x+Rf510nem1CHhB7gPYN0Px0Wgjf1afj+bKrTXnYObKuxBO8HNxYMebeUDq4LDkLoDaK19VfC4ZWczRyZVjn62PVZpZ8M2kG/n0PlX1wG81geRn37ZNSI15z8rGo2dZRXa5yLIxsMA2QHuLpu4mzV1IcJ4pyw1KetLEQBId6JDAij/u5KCIAiUUgqv7/+s7eR3s+xONpytTxUY85B7t/l0O1CtyTRTwZW2zQJFP+7uGmUc+toHNxcPOoA/npuInpuZ5/+QAA6CoNTJyI6KQEW2VqGjRnoEJKM/NKpq1j6f03nnYUC+CivzD9FVZFZhgdOcg9N92RRA5ikhMuLMVyKX/6d0H4x/Bxt+r/tk7nxlpgCKfmm+0VmcC85MPwDrAQxgnwA+uF1P5iB1f6Ttoumn/JGP+eZ/CqM/wN8Oul4JAfgxB6f7Yvy7rgA6lj5sthEQct91FMKKfmk5gH2ZgwROpwpdiq+dc12F1f2QfziagzuGzQDauw/GvysfnSml8Di9dvHYbAewD3OQuh8nUIUuzceO+VKFBdwUAapwsiem7snl55LYDmCXRaBMHzysQlfOyyKI65UQBhdFgCp4ubFVyOXjC5bFDVv9cFkEAvxaCWOdlwHoUxUW2Q0eMDaq5SWHYPysQ1A2AAfhR/bZDuBgdJ+oouAwV6HYDhePqtDW+DpS8KkKeygf5uDoPNU2B+lJFdq6MqcnbK1Glrh/fZ8eVWEPde5zcOSOzTlIn6rQG/u4/F5J/hx6OayiS8IruRSUfK/ocujB6D7B0+1An/Iil0naZJ8F6jUJjC+iKgVBEFg7sjhk+kmYo0W5dNvNxYOV8Ks6f45aorPpCiSyNKaCc/B0mydahSU6VT5UoQv7ZSN/9uncXmeDy3lD5jl4VYag45UQRN+Jq5UwhX0B7OXPrirwXh9MY6awrAsEKqtSsQpLVC8vqtCoIX+2zQHudUn45bE2+nE3cxn05KWy01CAzXNqQf7r6XaA6x+/EF1FvDQ40fHW9i0g/QQ6oL5rctrOn60jwF2XhJ8vxkheBkAv0aeeAKuGa/5waLFxxEhEpeiFAf2vrvXG6sifTeGw9zXJzAlJ6QBwepfGJqK92V6KWFv+7AzAfT8XIb9E5lSuBkFE3qktf4r+ePTZ4B6diExEp6nW/Cksghz6ubDCoxORiehE1Zk/hUWQY84GL+rEKSyGJiK/1Jk/RSPA4ObiQf/nj+cmosU4sxqjH3d33jnDj4iOUGv+bJub23g2uHnZdfluLoS28IlURPS91JI/u4Kp8MC7aJKyaBkaw4+ISrCeP5VcKl4unSM/56o3DEAiqpIX+aOUUqo1CRXSpFZKKTWctc3fERHZUEn+lE3H/BnhXIJGRHVh/hARERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERnQy1/CI6yv+57gDRkVRrEmI4awOrIKw7DBnAJy5w3QE6CbKT+7K9qNYkRPye6F9EjRAAMLpPgHr6qVqTEHeXTTzdDszf+/IcEZ0NlyMNNV+M1XDWNkdZ+b7k/2azr2o4ayullAp7UK1JqOaLsZovxqo1CVVrEtbxXKnWJFRhD/qrxrapQjwE9p+aL8a7DvWsB1B0FWE4a6M1CdGahJk2W5MQ88UYSikopRD2dJ+qpsJe2pfH6TUA4O6yiX7cRfwZoxN1LTS53ofhrI3X5geAdOT593ms2zaeGzoBDMAT4SiA1DJ4EX/GANLAubtsSh/0959/HvA4vcbHf/8iaoSV9iF/P/FnjPg9QdQI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" }, "Eat": { "width": 24, "height": 32, "durations": [6, 8, 6, 8], "rows": 1, "anchors": [12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAgCAYAAADtwH1UAAAEIUlEQVR4nO1YLZerSBC97Nkf8OKeHNcTN3HtdiTPrdwoGPccK4nDETm450JU5h+AzLp2iUtwkeOYf1AroHqapJNAZjJnZpd7DicEilu3+oOqAujR4/8Mp4MtXfhcz38CbQwJAEQMyDsBtS5QTLo7asPPuBb/Z9T/2zlyLxPYlAsAQOpuAQCzVQAvE9r5G0BeJpgLoRsAADblggN6F/6vqp9mq4A25YJEXJ0TEc1Wgf4vYtAbnJCXCRIxtA8iIhFX1/naW/i/gv6TO2D5nDf+b1+e9LXlcw55Jy7U/orQDTBVEbYhYfvyhNANoNYF1E69mf8r6D82AQQAal1gqiIteKoiqHWhjYzzrqtI85u/7Ivfoe/B/9n12yaA+J1WTA6dMMxk1vF9qvkBYJonKCaAn99CrQu9Qqd5om0u5f8K+m1ZmoAqkaidwsMogZcJ3H93G1t6/qPQyW04GJ/iswYw/1ENyKZcYDgYH6sidIKr7VtXbdfWb2gCcFgFcVwcQ1v95GWCgCqxzACa1eebckFeJnRi43tsz7/n+PnYlAuarQJCnSzNe7NVcHDNOD6F/lNazbg25aKL/ubDFHtV5WAEweKJiCj2bIPYit/k8zJxcOwH0JX/I/TzuU2/6e8U/+82L14mIG8kgByp4wCroGmwCpA6DvzYg7yREHFio7Gi4m3ahzI6sAvL1pQHuKZ+E/JGYlPKxjW1U7XvQ9v9uAHLBJgPb3+6kD/dBrF2UEpsa7vQDY46sIHfoaZYriD2J0PtVCvOj9S/r53BMbAOtjGT9j72J8AZDsbECcy/e6xWEDutBfKvT4R0/TcAncjOJhm1UwhlhOFgjE25wFRF1kHn4KoAcguTFVfXD5g7rKk3lJGeBI6L4zy2kKx9gNopYJQ0xNuQOg4wSg4anjaYAVCDcWPwOQB5I3UFwRPWBdfWH8pID+hwMIa8kQerP5QR1GCM2RkuaxnqZQL3dYkl/wBuXQ8AsM3njXP1T/XAskOZhSohwc9fgDBF6jiQdTnIUPXg+1R1lxxoW/5r6+fy9fbbX3qSbTH4RMDUR+p+w8MosfJbd0AoIywzAawCqMfXBNYQ/xhgmQks6xq7K9LJ/Ojg+0TwY+/1Wsc8cG39ph4/9uAT6UXDkOUCqeMgncxPclmrIA7iz19jFBMciFzeCcxHCUR8WQKb5gnCVWCvFmrhfuxh+/KE4WCM2X4V0wLX1l9MEmxK4BawLiSO5dzi2d8SxKKA6vuJ2e3twzMCM2xPbWPijrGYVJ+Fl8+59R2vdkpzsl1b/o/Sz8/bFtJURbj/7uJhlHTRXzUoXiaIiFo1Jpfamw0KN2Pc3Bhd6YfpeYN9o8M240DdsJ3iP/ot6MT997Y/FjRzfbSeS+xPxdCVv0ePHj169OjRo0ePHj169PgP418ndbSe0wEiAQAAAABJRU5ErkJggg==" }, "Nod": { "width": 32, "height": 32, "durations": [6, 8, 6], "rows": 8, "anchors": [16, 20], "url": "data:image/png;base64,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" }, "Pose": { "width": 24, "height": 32, "durations": [8, 1, 3, 2, 8], "rows": 8, "anchors": [12, 20], "url": "data:image/png;base64,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" }, "LookUp": { "width": 24, "height": 32, "durations": [6, 6], "rows": 1, "anchors": [12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAYAAABU1PscAAADO0lEQVR4nO1YrZajMBT+umdfoA5ZlxnXcZFI6tZW0T4BljocWNw6pqqPQOXIOMbN4pDj+ghZEW5I+G8rtntOv3NyoOnluzf3LwHgP8fiXxtQQ/bMzbLtx0zyoXEvJADp5wxfl5Mefs5Mvfcp8HMmsyKQX5eTHlkRSD9n9yqwuP2cWde5OsbCJP2cIeTRoEAiIhw35RTPILe7KbGTEu+LBfjlpP8Uy62e/8jZqI6hFFIKHA+iEoq0EkhEsxhRCbiOh6wIgBsjsYv9jvEAwC8nvC8W2MX+LbQAACtlKLQU3va4YQFSSimzWk87fXQa1XJj/INF/Lrc4nW51RFoQ1RCy9yC3fkF/HKCqARCHlnRDXkEUQnwywm788soz8+eOZkVAfiKA1B5/vF9tmqBlH3VoReVwP4tlZhXC1ZtkZ42aD7kEZBHOG7KXv6+BWij+IrDdTzs31IcYXs6K4LB6EzBdTx9T85oN4tERHAdT9twRDmbX+c7tTEWw2p3LNb925Kby4+m/4/tMX3/d9CuAZkVAVzHU6velDpNCK7jga8ZsiLAcVNqWWPzmUQti+OmpC4GFjcDgOY35efA6iy0oWRFoKPA4kaGInFFN7IiiTq6fRE2o0x29PF3upCZ14mIkJxTfHyf1e9zCgD49XuLRETga9b73By4jgcWA6EXdOYBNc9iu1760FkAGQsA4rNE6AW6wP6EUpO3i858bgzJOaWuhdBT3c50BPFTF9q/KXly3hzodDDThlKJQknzdI8rithMDxY313aKmmk2xN9bxIAqnPKgPFYeGg+b6VQeVLHxFZ97pJB+zrTHKcKUJuTlRERWSvI1G2wSnRQyNxBaBCkzr6bx5nNTcB2vk35aZ10PIY/AV1zrCnk0WAu9GxltYoDd8vaH1JojGVN+CnzFISoBvz5lJkhRHtKGc83wutyCxcpJtq5uHXQWMNRNzP3APLdMPTckZxwR1PxnCaz7IzzG3Xd2sc4qiYhG3wlI5or3As0vKqFrihYCNF43bRjiH1IoiYjOI22QckPxNS81ElAebh8UTW46h43xTymd0xrv+TCg+an7ATCNnuR/lK8SgO2sR7LriSeeeOKJB8ZfhV6yRBzwV4gAAAAASUVORK5CYII=" }, "Sit": { "width": 24, "height": 32, "durations": [8, 8, 8], "rows": 1, "anchors": [12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAgCAYAAACxSj5wAAADpElEQVR4nO1YoZKjQBB9uboPuLiVcXNxG4dcmbiTF0XFreMkcbhgcee4KOw6kJHjiKNwK+P4hDlBejIwA0w2ld3bK15VKqmhp3vo97ppAowYMeKOmFjYiBv3f2oM3aCIcw/OzNEu8FeOzSKy8TGEf5qAvgMIACiqBAAQ8kBe8J3693y6tvHTh/cg4CZ0BReUmPl0jaJKwF85DqeskRzVpsdXF96DABmnA4N+vw4ZxLmnHhR7rOX6DRBqYnwnwNPDskFAyAOVAIG3JWlIoYN+TQkSdPMkc7YD/GUdKOQB+LHEZhEhzgFn5iDOPatgJjw9LO9BAHBWDiWnrdB6PSK7znN/6bpAyZFMZxH4Kwc/lgAAtgM2i3rt2oObCIhzD0WVwE2Z5vts31cqWoyiSlBUiUzM08MSADSFnu+v07cpc8JNGfarshGAEgMAL8+JVFK5Bci+w5/mnxJEBPz4XavGX3oIs0galtuLkq5s2LKEgUYvkzBct1a/iHNPoE6UYDuIokoa327KRFElwk2ZUO1t/dM+8kFx6EPrbAeh2l/jP849eS62q8/Y9quudflvl1ijqfFjWbPKA/hLD9+//YS/9MCPZaO0qA9Z3IRwUyblTiok2b88Nxu388gA1OXhpszGv7QHYN0iyN4ErQcZO75SXkAt/fa6aV8Lwk2Z0iCvI8B3ApskibONTE7IL4mm8n15TuA8XnodgE7fWoLoYG7KUG5rp+UWOJwy/Dn+wuGUyWBqj7Bp1l1M2RDQt/8MjQBbhQKwJaAOVFRJuzZlHVP9QqnhK3qQVvdqn4lzT1u3jCFt2r7JZ5x7Qggh70GNRfdL+9U4xh6kwk2ZVNNmEcmnlpsyydQVPWhCkibG2mqhb1KnM3NsXjsm8+kah1OG+XStKW1IoSEPoO5X42iDYlcvUR+L6tDV3Bdp6y0YCQCA/arEZtvoBy0CMDSMTvarUg6HbpphvyoR4twiHjOgp0XsURpHFeOgSP2Eape+Cb4TNNYsh8XOsR+AHNpUIlTYqpRu+BqFKr41tNmQDFs8lSQoQQNlIJuoCmqYNgh50DeQagSoSj/vA3BRaDuuqZTbCppsFhEOp8z6FYLe8i0m3cl+VT++Vd82yaE9fcnpUh6hT6HqedqvHp1s0w91sFNxOGUNVnp8ab7Jp41KiQCLVxmjXxuFUoJMcT7qL9d7ESBUn28gQIvz4X9p4o4EdCWf0JeYWw/wWWAzvP7vORgxYsSIESNGmPEXnZc0OmgmI2cAAAAASUVORK5CYII=" }, "Rotate": { "width": 24, "height": 32, "durations": [2, 2, 2, 2, 2, 2, 2, 2, 2], "rows": 8, "anchors": [12, 20], "url": "data:image/png;base64,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" }, "DeepBreath": { "width": 24, "height": 32, "durations": [12, 6, 6, 6, 6, 6, 6, 10, 4], "rows": 1, "anchors": [12, 20, 12, 20, 11, 20, 12, 20, 11, 20, 12, 20, 11, 20, 12, 20, 12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANgAAAAgCAYAAABw4baZAAAFPElEQVR4nO1bLXerShTdeev9gbjKOFqXONyN5Lpno0jcdTxJXVwiE/ccqUrldSBz3TjiElxlXPoP5onhDEMCKbSXpJeevRarAwz7bCh7znwEgMFgMBiMPxGdWwswII3y79bVJPc1YrD+28d4F/9fDQipCwlAWjPADS1Ys+zYJ+e+RgzWf/sYmp+2Ovy3Nph0Qwu74xoAsHL2AIAg9uCGFvCxh9Qk9zVisP7bx5BuaBEXfMcDAOyOa9NonxYyiD25O66lNVNlKaUMYk/vW7N3t0RNcrP+9usHlLmkNYOOIaWU1kwdp2Nv8VfJYPLC9iFsDlFuf//6rI9tDhHsvvUpua8Rg/V/jhi+42Euptj7EvvXZ/iOB7FNIF5EJf6/L5zLGShNiQCA5PGsTt1BpQQAsU0wxxSAeiCbQwSxTXQloyxrxGiSm/W3X3/u+qHjKB4HmIsphneOev+dHH8pyjKYpH4nDR7JrXbfMgeT7+nrau7kMRN5KlZsE23kGjGa5Gb97devY1BhHi2RPALj6B5im+gMOY+WhfVPUeRqfQNP35XoIPYw7i9wP+9g70ustv9iMljqc5tDRHWrtBISUANF8SIwGSzhhhaGd04u5T99T/Tg9aE7uqT3Wtysv/36ATW2g92zzevKenA48coZf6HBgtjDZLCENVMZi1qHonLyqEyWGu7Nf4AbWrmbN0Ep2O7ZAADxIrR56boLMZrkZv3t169jmDumkQlBrGYTzWMpzrhPu4jSDS0t0O6rlmHvq5hkrr0v1Y1Qt7FnV07DwztHcb0IfYzKvj2F3bP1vt2zdX36eytu1t9+/UiTC6CMFcQeHrojbA4RaLreDS1sDhEmgyWC2NNGT687e//PxmCmEDLU/byDnz8U0c8fa9zPO7nzNW4AQDqmSx/EQ3d01hJMBks8dEdqpqZn59LzLblZf/v1U3Kh8u64hm9Pz7bdcZ2rW4azWUSzBSCxbmhhLqYAoKcnqQupj/VsAGcps8INZOmcYp+mf9/xKvE3yc3626/fRPZOZyAP+PY0V+8SSic5aHxF4zBAZSyzbJ6vM8lB/dpxf4FVp/ySsVQTKgAqj/Ea5Gb9X0A/TdqRiUyjmQY7PT68cwpjFK6D6UHkDzUDkyDJspUx/VkwS1MJ4kUAgyVWb7Qo9PA2YfUFwya5rxGD9d8+BhloMlhid1xjLqbacL491fsP3RGC2NP1i1C60EwOJRORewHAj/MzNXWxOUQYpmX7G3DvuACAffSUK4tftakb5Wb9rdffmQyWcne0Me4vACwhuiP4qQdMk4nuCAGAcX+B/etzaYa8OE1v9mVpytMMBEC7uEaal9Qq0MTIOHrNVdhHTxALT8crS79X5mb97dcPpO//uL8A5mPAX2HV6cA2vdAdYSxldj5bF65msFNjmX3Nor4poLuJlQ0GAP/8N0LyCL1QSKC1C2uWDVAr8jfJzfrbrx8wFpoBZSb7ZNKEjgOAnV8ne9Ng0g2tMxOZxgIyo52ar8JEh6SbBrIHUQbzwVX4tUiT3Ky//fp1DCBbTL40FU/DI2OZ4E0D65/8745rCdVa6H3ais5LKav8wl5KKaUbWk3Ub5Kb9bdf/9k1QPZJDH2iQn+D2JNQCakOtwpA38AQCVIj0UbHzO9xagSo+7lLnfpNcl8jBuv/fDH0u05b0fkyoou/KzO7hWWo2DVkMP50mCb6Le+6DAC5+6bca6bIIPZkkJ5HvZaBwfhSqDbgg1pvIIhfwKQ6B4PxZVF5avQD1zIYDAaDwWAwGAwGg8FgMBgMBoPBKMT/DB5vNTao6wkAAAAASUVORK5CYII=" } }, "charmander": { "Idle": { "width": 32, "height": 40, "durations": [12, 8, 8, 8], "rows": 8, "anchors": [16, 24], "url": "data:image/png;base64,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" }, "Walk": { "width": 32, "height": 32, "durations": [6, 8, 6, 8], "rows": 8, "anchors": [16, 20], "url": "data:image/png;base64,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" }, "Sleep": { "width": 32, "height": 24, "durations": [30, 35], "rows": 1, "anchors": [16, 16], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAYCAYAAABKtPtEAAACEUlEQVR4nO1YMVLDMBBcMRThF5RxSUcn6MwP6BReAK1f4LS8wNErSEfU0VGKDn6R8ijkc0wsG0mxyTCTndFkIlna1d6dFEcgDeTpE4lrHRUposlKYJ6rpuNjrZGZ5PWi+T19ybyxEzubZ/yRCaObfxY7wbf5of4R4TV/nitY6cZTFo0xgKx0jvfhECEhmML8qAzoS/0hUxhWHmTMZOZHGSAK7TVhnit8rP1jY+EQ8xm+IIQaQFYCVHZFZMYZ8xtxXavJWTCV+eehD/YR+Ezxzn3SwDpcWJui7+bJDACjOf0H0QQBmjKzuzGCS2Ao1VZ1Bgym44ySozRkPpUqfN2nbqaEGiAy093gqtBYFRqLUjVjvsNIFBpYLn4tlT6Eml+hy82Y5wqYpZ/D1Pqkqm5Wusb9VKr29x/zqVS+/mB+K90a3FgDc3r0dNbwaQg5A+j1fYvbqwsCgArAA4+Y3UMhdZgIen3fIru6AEwTZVzXfKLQjSbKVdStECzAShARNZH+fAHR1rXKH/0fbSAzkvjbjfk5Q2I1BN8CWC4a99/WwOUN8LXZDXN9czTaJ/co7wkt/tkjcL90/Js718fXYc2D0HeGEANEZkAWboPXEsied4MPAIgIQojmk8uhLWifOAJR/NjjBzCoIUZUb/ryb4G9DadwTME/pgY/P5++FZLr/Gj8U0TnGP8MHZv/hBNOOOF/4hv0Ym7pHPoMuAAAAABJRU5ErkJggg==" }, "Wake": { "width": 40, "height": 32, "durations": [8, 6, 14, 4, 10], "rows": 8, "anchors": [20, 20], "url": "data:image/png;base64,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" }, "Laying": { "width": 24, "height": 24, "durations": [12], "rows": 8, "anchors": [12, 16], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAADACAYAAAAeGqO6AAADZElEQVR4nO2YMXLbMBBFPzUunFukFMt06qh0yg2SSlaXzimdE1hlfAJaVXIDsYvZqUtJdc4t7G5TAAsuVyBBKq40+2c4pkBwP3YBEs8ETAllA9doQt9ezfqCNwVA92s0BVDGDUcpNipqCmC+WoeGY7VDXvf2H5TOgIBucPWbMDETaRDKElPJndz1lEm4fiWD67IAQF67oIsCoFXUXJplAOj3nxd8/PCOAGQhA10W3cbnbOwDUwmgKdzBv5fV13Bf3yrCfLXGsdrxjUF5DTzvAXpxx3IPHGrXXgJYqP68Kk5KFNOx2uH6Dni/dL//PrXXDhXw5cFlcqiBjY/Pc5DlNajBbtBkvlrjly/R06e2/fq224+DywxYBIR69prxPHAZ/TOCsg0eYus5yHw2yGsXSExq55zN+S8RyZGHgfdNcjCSwQ/1aWbZ9x2ICNjeRF8pvatIj5QnLprR9gbA6QoaI6L7NTVFeEXw2qemaA/ZpjMYZRK5iUpvTvfrjrm++Uo3RBR9g3I5RMnGv2k5dR6hTx08Sr42piQdVxGoXSnf/AivKUwm4FbP5JFrM3rxR2Sizwo6ZCazM72pjIuSMi7SZsZFxkXGRcZFUsZFxkUXJOOipIyLtJlxkXGRcZFxkZRxkXHRBcm4KCnjIm1mXGRcZFxkXCRlXGRcdEEyLkrKuEibGRcZFxkXGRdJGRcZF12QjIuSMi7SZsZFxkXGRcZFUsZFxkUXpPNWwARmSr6LYsF5m2RuihimnYcMpnDTlAzC+k9wU9QgyTnMS2Vfh55yzeA5RlzofVqZjwD3qtA73nx1ajIDHMfwbsSMI3YnArr7sAyopdvCHCx80Lx2u9dSsM/zHpDbJ+AGcayGKQTwqMfAlNfAz1tgsWo7SAZ63Y5jJ7mirgBkG4Aa0elQAa8P7e/l3rV9nhhcnhDQ5Rpe67Ha66BAp4SdZ2EmGrMNHN/IgDHi5nMesRj14INGJQBsb0BEcsfqoIs0GQocM2i5xm+NesQbb6IzGytqCocjfM5H2X34wqaP/2CgQBRl/KkeHTwKv0Bbnh4cHKz7WMX4h/G+w0xDQJAaBQHqP8+7R+DV3/bDtauVdVZmJxPMzPTmOGOM9Oay70VJ2fcibWbfi+x7kX0vigPCoOx7UVz2vegss3NZ6B/R6wWlY5truwAAAABJRU5ErkJggg==" }, "Hop": { "width": 32, "height": 88, "durations": [2, 1, 2, 3, 4, 4, 3, 2, 1, 2], "rows": 8, "anchors": [16, 48], "url": "data:image/png;base64,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" }, "Eat": { "width": 24, "height": 32, "durations": [6, 8, 6, 8], "rows": 1, "anchors": [12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAgCAYAAADtwH1UAAADeElEQVR4nO1YO3LbMBB98KTwMVJSN1BHl0xll+lgl67sliegSqdyKbFKm04sqU43oDrpFkm3KcAFARAUQcn0ZDJ4MxhRAPj27WLxIYCIfxNNCnKqyFMu4uVypcRRO07Vh+j/FPjEr9EFrknVf1zhxJyD8Bn6PwrCrTDFL3YQUMKRZLL38qEqsdj5ecZAhaRDVVp2QvSNYW79TQpqeV1cpP/GJQeApLLqsN/5X97vVPtUNCkIr6UZFGpSgAqpS8s7KUPn1n8u+Jfqv3ErkkwCb11gkprwNPDyIxFnUHCgmhRkBmjRBsHN0CS7bBDm0n9mufTOsFD91gBoEiM7hRieRefahqBtvEmIvLTrhvpO5f5g/U0KSjKJpPIPxDX69QBQIRXxa2l1uJfvoMJPRIXEvXwfNWLiUJVmhlpLAO8Jlg0iICBDP0X/m+TMZj3U6rNg+jE2C/QAiLxU6XBLnJ0CAFanZ29g2NDq9BzuAPTG2OMUeYmk7usMzdI59SeZVAP72ufx6Utq0rN7DF8ssrwEtb8M3sCSeoPDXWcsqQn7QCMOyDh9IMkkHg5LACWEEL1sbVLovmOYVf8tAatHPjlpIt8mzoPycFjiVwZgN2yntwn7suWpJV3soIsQYnBzG4O7Nq5Oz4NLwdTNeA79Ii+FOXgtBo+3gFr6QmaXy0rrVrDRZtZZ8PQNAfHR8KnleBxYoy2hKlvH7MyqnzdjnmFDe4uJTV6atnt2ejNgmSphcL4UXWPO/ylflYKXlHVrb5OXg+s04M/qIcyp310KxzRv2oFaw9I0Cr4i0J/vLJAKSVRIq477TPi0pyaF5jHfXRttHluhmFO/7sv9fXpdf9bAJF+sQDQp6OeL7Qig6rie+4Y6YQo1C5z/TmBCB2FO/ZY2ODpdP9z69qgcNgtMQcetKvS7K8etcsB1ONBALxjHbf+28ppZMKN+K/ud9yw+48JxahLZQXDFswPHbd/4lCCxUOZnTi4O7yTumfX7tOlE4hJy89rbhFsIoDvj1t+AU62eT7Uq+0rVm/0w8fZymapjHPN/veva9pXauIyLrSmYW7/mp0JiDeC4Bb6vbP37nfJveUZ/0LGOcfvSPf/50T1fcBSN/CHk7mkFxnQz178L1ujIH2KgvWnSvxPbI/91/IrE+Z3aHvmv44+IiIiIiIiIiIiIiIiI+M/wF91yQyvLkxrQAAAAAElFTkSuQmCC" }, "Nod": { "width": 24, "height": 40, "durations": [6, 8, 6], "rows": 8, "anchors": [12, 24], "url": "data:image/png;base64,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" }, "Pose": { "width": 32, "height": 40, "durations": [12, 2, 8], "rows": 8, "anchors": [16, 24], "url": "data:image/png;base64,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" }, "LookUp": { "width": 24, "height": 32, "durations": [6, 6], "rows": 1, "anchors": [12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAYAAABU1PscAAACS0lEQVR4nO1YO3LbMBB9yLiwb5AjgDdQR5fscgSEZTqV8QmYUl1KhjdwqS7DTl1Kqswt7G5dgAsvLfxIymMXfDMsBHDfvsVisaCADR8LlfkerbB9V+SIoBbArnwdOPVAnW+fg8ULdJMiZvG6MmK4Q2uDoFxHKR/fG8t/Pna8QFncqRdouBAP56joszii/FK85M7NcmwyKF46WhkEDePWZD/nY+cmc7ijWygm/gogwIokkQH2qR46+V4wiC9rFKwN8O+/p0VzEqsCWIvD4c9k9SW+7u/wzfxOckQDkPtxyXwKj/oUnNOVwa//P5Ic0QCKPixSFPCHIhQADSWC6eWghtI+8DeiJGIZ5KM0BV8ARI1xBaorc+FIV8Y9gAt0ThBEjcEpkGE5llog7zHKBLoywL4Djn5j9dBhKGfXAnFmawBtDwCX9tzIBtggit5/nIbOV9shnwAcshpZjMvLzXerogfkb942tTBoEe7KwSLelQBuCdh3wTTrynCK50CxOH3011k9iuYai10pggHoyuB8b21CxcRBLIGz23du9XVlsBtFy7EYfDVARITzvULRA0PlFw5wYB2ICEqp3Jup49c/CXhWE6Hy0Mjh92VAKaUmhLXnpaJ/vWYrpZApfsr/rICD8WZ4Bb8DwZ4YBNsXiBpDQ2nH3zxLQNQYakcO5g/4CCJ2G1VsHCjUd/mknHtFT32RTQr1Sh8xE+5dyb3AIqf7SmQVHWfgmuKZWx6j116giSMs3+tR3nbc/2Lfz8Jn+GtEiv4MejZs2LBhBl4Aec4oVWP9oRsAAAAASUVORK5CYII=" }, "Sit": { "width": 24, "height": 32, "durations": [8, 8, 8], "rows": 1, "anchors": [12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAgCAYAAACxSj5wAAACnElEQVR4nO1YO5KjMBB92tpgfRMIJ3PGTsYtZGcbTsoJ2HBugHULMi+ZM4dwE0/WGwDiJwkh4Sm7zKsiQagbvX7dLQnYsMEHzPI78pj71LBZJJUREMRcvqhygbCwnv/UmFvghJwWK5P0sAqdJYjSKTlyciJsbMzhoRX6wzBGZWSe3Iyrom8LpUKDmK9he+BH8VjBFCGjeqQBPxV9u0KrXACAtUJ/ejr3gZVCwwKEFQPQElVCWNk2pZhk23V8Dqriv2R8BsYA2KaxiSAWFnoSHqmQ6uBJMACPIr1GIb23QudgQ6COIKKUW6VAk+MuJD2FQlUEEaW8/vEPgSDm2kWwRKDKhStJxiB4kg9gHYUqFTSY+KE30nQZl1TogmCAB/lAT6EqP7YKVRHEmonAp12Rc0kF3U+P33vUIVlDVSr17mIytX6p51e56DtZChYWwGWkvvFm7lK4kQ+AspFNFYKYo/lOS5JxHxQWAP4eIBU1QkuSAygDcNDUoCCvbe8juKQYna83HC0+rHKBI4Dz9ab1oS7SREZp9yNc5QJEpHWgsn++3rCPDOnzyQdqMi1Ahd/5H2SYb+OXAsia73VQ1iDG2MT4eDFhAeybMw5jDLBPA/b+tsOl6OyO06zfQQHg/W23xL5U3xz2EcyBmnFKQN2pgpiDJXVH6VV/Wzta+6oi2v5s8I+AL4bTDm26LPFBGboASpsKP5fCbN941Bh4nJ66We9xgSzULU5JTb5cSNdFl/pgRwybgAs5to4HR4477G6Vd0Ir7aQJqOvMoRfgUyL6Rdxo3+XS/h5bf1UQ1vQ1CMJK90zfjsW3fUvtlxGIUk5lNPVTRvV4M/aykCRRymVAyghEt+bpCHxZSFIkWQpyXp0kYHSJvxGyYcOGR8R/E6ynMed+mg0AAAAASUVORK5CYII=" }, "Rotate": { "width": 24, "height": 32, "durations": [2, 2, 2, 2, 2, 2, 2, 2, 2], "rows": 8, "anchors": [12, 20], "url": "data:image/png;base64,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" }, "DeepBreath": { "width": 24, "height": 32, "durations": [12, 6, 6, 6, 6, 6, 6, 10, 4], "rows": 1, "anchors": [12, 20, 12, 20, 11, 20, 12, 20, 11, 20, 12, 20, 11, 20, 12, 20, 12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANgAAAAgCAYAAABw4baZAAAEaklEQVR4nO1au3KcSBQ9bG2w8wcOFaLMziZDIY78CUjZZlLo+YLZ0I42ZIj8CSJbkZHZGZPJof9Ayu4GcJt+wcB4YKbQPVXUUN2Xcw6tvvRLQAeqCNRVJxAsHZP2/zmSy6NBnuviuOfQEP/n1Thl/w/6yK8Lt/4UqCKQxU1VBIRxAgDY5xnrez2ei1v8vw3/fG9reMIPchsBTB7mwD4+jYANzwsYjaNjn2ejGmlKbvH/dvx7+r+jMZT7D7sgjBPgi2OW0toAaJugioC0KR9i3PcCOhqjDrrK5+aeQ0P8X4aGp/97EziM6zzAgRz40yEHgIcMIRKgyLwCYZwgjIF1ncWEEV+h+gUAoOambTus6w3CybwfoTElt/h/I/4Bu/97R0dV3sR0QSUYbRNi8k7hIwS8PNYL7PMM4RMhDdo2CJ8I+5vhs4cpucX/8v139H9qRqlOVBF6E9gopG1C+LwD/rlFsMl657eMoXNR+wWaOa5C6nnmrsfrXNxzaIj/8/o3NKz+T0QIggA8Uhr4vEPQJrWX31iDBZuMyVVZGCdqV8bGPs96k8/iDgBgtwKCVds4+hdiHQG32wRrrUyrJ3TMd6fkFv/L969pOP1fSyA3vqeO4WxydCXTKcDGeaPEBierL2l5To3uP/Jk3OJ/+f4Zdv//lPzbF36w3gY1OzVsgu+Jtolz6fVD+dNGg7aJ0qoiEBFRFUFdRKQ07PgzcIv/5fsHx2ox3n7fkQeDoAw2DylzXdfAhnFegHn1+7RpwBRmg4xtnAm4xf/y/Sv+I/u/f2TvEEFZmIvEKuo8aOvj8nID9Rw6bQrvevgtL30aU3KL/+X7VxrQ+IJN5nDbGtpxgKPhTbC0Mc2/VQT8+vKCnx9WKujq+wvePazUi45tJH7pKgJ+vAdev7qBf90D73+M+peXKbnF//L9K37e3GOdFDA2T+xyjre1jIPmBsFdk8XrCKgastv8b+y0oHcPK5SFtktT2DTdKJtY/gKtYwAxcHXTxvx8Asq8jb0E7jk0xP/5NfRkqZocuC7g9HF9NK2QjT4XdhaH9rxz5ALV4E61558fQfRiXs+P9XXMOm9CbvG/fP8AzDUYc327dy9rDeZoONv0Oq6L9qwrRb1NGmwyNS20hsUxCO7QzmvLvP7iMPi+bP7nbOhZ2wzcc2iI//NrBIB5eH11U4+U+sVIred0+KaIxoP10Jjh2z3wHJvG+VxCW4ONwm6TYR0BrwVQWnVlXs+r91F21DA/JfccGuL//Bq8ttp9zHDzWCeZnryvX4FwmwDIOpdIhxZ+xIu4sqgXjeu4JefyERscB/kZJ+Cfklv8L9+/4mfY/Ixj+Y0zAHuu2VE3ml8/w9D5U+384pg59ITc4n/5/hW/h0P1/9/Yg6hPwvlXM2/EpFbcCBH67/sL8W8fvx43kH9KbvG/fP/q+QN9+9i+3xJov10PkxV3KfxTe59aQ/xfnsYx9QKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCASCi8H/fdkifTQpXDQAAAAASUVORK5CYII=" } }, "squirtle": { "Idle": { "width": 32, "height": 32, "durations": [30, 2, 2, 4, 4, 4, 2, 2], "rows": 8, "anchors": [16, 20], "url": "data:image/png;base64,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" }, "Walk": { "width": 32, "height": 32, "durations": [12, 8, 12, 8], "rows": 8, "anchors": [16, 20], "url": "data:image/png;base64,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" }, "Sleep": { "width": 24, "height": 24, "durations": [30, 35], "rows": 1, "anchors": [12, 16], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAYAAAC8/X7cAAACN0lEQVR4nO1XMW6rQBQcohzCVDgVLe4oky4u/w1Mxb8BJaLMDewK3yAl7mjpoHX1RWXf4v3Cu+u3yy4GK4kUySMhW7vemXnzHsYGfjm8kT2648yPw2WGkFYI4gibaKEW990ZfeLfOjsVtoBmc9oOWM1L7Lsz+qYDduu7BF0a94ZjLSAoT1bzEkzsngIIaYX877udd2Y4T7bFTbRAsT1oa8X2gH13VvtIq4sZbux6zTYveYM4muJbwSyAhDGNqNgelKgswhCioDwhbwlBebrwOHDLoCOcqz8jpEEHgjhCsfK0EeKifdMNSPnIbaLFaBG3umvqmTpmSNYRyltdexMtUKw89ImvOiELMe8X0xw3MLW7LvO2kMwCvD7xtUTka96SKqzYHoDdGnUWok989Rluxoap3WVdJtO80hd4tuh42K2pR4WiEQcaQ0yYX8avKHFEkviAKG4kRfRNJ5NTkN0FLiHxcADg7eOofV6GNKZDSCt+swwvsV8CVGehTInylghpRUF5cn0bqf28JfUq33PdOgvp32dK5bULGr9LQzNaZ6F2aURMhK+PmNcD4pcRjuSwBWSGNBghNeeircv4FQDw8mcHQMxn9I68JbytPNTZ9ax6EI2Y5/xyTJCFalTk07kAsBRjChw1/iCOnA9S1R6eshBWa3yfJ8fSdBYwhZ+/l/uWbo2LGOOgzaBc+6xq2z1yC5P4BwFN57+IGAd00eFNPhdz+Ecx58eYSfbV/wu+m/+BBx544BvwH79pMMs6wSNnAAAAAElFTkSuQmCC" }, "Wake": { "width": 40, "height": 32, "durations": [8, 6, 10, 8, 10], "rows": 8, "anchors": [20, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAEACAYAAAD2lDnzAAAVH0lEQVR4nO2doVsbTdeHf/ten6h8JKikCuqCi2vqwIHDNSgqceAA9bQO2aikrg4JLtThiHtb1USB7H8wn9g9m5nZ2c1mM7s7L/3d18XVEkL2ZGbOzOyyOTdACCGEEEI8E7UdACEeUTmPVx7nTBDyWlA4vUOn38Owt5U+eP31HhgdABXHOhOEVEWfrdseR87kECazFyxOtoEKcbb9xuokpA58TSgA6Iyf0weSwQe0186qM352JodQNUle48AJsQOLCDmR7dhyB+Ims/QaMbheX+H0Dpef9p0xGdutvWjt+P5vnSfDfRIUUqe6O/BJSQcqhBOvK5GlfUOIUWViO73LnaWHvS1Mxs++29jYOuX1Yaffy32B7l6EoVK4mgE4vQNGB2vF9591gu2Mn2F/If/KQdMYyTGZvRg/HPa24gYKI960LYe9rfTr8kmF0qZKj23xOANQPBABFG5xqsQgK4O87rC3tVb7yO9FUZwPq+J3UTZBlN2ZVyfbuDrZxuWTKhtw7Z1ud9BVL15WJVm0BmpzABptaVMwCJT21Uh8gDnR5CWA/hyfCX75aR+T2Quuv96nx7BiULd30zSBXfTfA+MNYiiTIJltS3dvuUIdn0WrGkVhuVzX1bnGdgBIlvwowhjA/OXC+Nnv29M0rpriKWTVTOv4ueqMnxtfYSazl3jwxZdJnVz1gKvlOZ734w97W7j8tI/F48zeFagxgH8ePuH28E18OdfB9xuF+XKLDay5/Vtni5Wh/x7Y3f+od6iyvzrjZ+TsXe3nemcer27obn02Hn97NIJSSmaWJpMkk8h5aIlgTFCNbxVHB5ie7wDIblu7e1G6fakDWRn04+on2t3zHcy//MKfgw9xkmi7Bfm947MIx2dR5QsIqxIk7ZzJ7EWCS9nd/4if99/SoKbnO/h9e5r+K2+y0+9lsl9mxLpnxfmTwrC3he5e3EhyvCiKT94knjqOvS72ABT07c5k9lJpL12Fxck2puc76PYH6ffGluvfj/EK/bRsvqLtThWuv96nY0gb5EqPq3u+g8P9AabnO1g8znC9F+E66e93P4B3PyC/tzalVhD7chkQrx4/77/h+41KGxIA5o8P6b/T8x1gdIDF48x4c/aWbd2Tr6I4Xd939yL032efH0WRfbGhqX2+M9ark21c9cznyYojz/c9AF3o25luf4C3RyM51zSS5Gp/YiTHZPay0V+tLSKMDtDp94wTdaHbH2D++ICuligf/tzEz5eY4pV2o3hKJYgEJ50ljfL9Rhkd3e0PMDi7wODsAt3+AN3+IE2ShNyBt+kVkMXjDPPhVrrMSlJLcrz7Ea9wMrNIQsvJsrw32RIWxbppnN29CPPhlvMEWLYsrkRIZ9J6kyTC6ACLk22MAXQPv6Y/kDaSJDk+i2OtM3kd5x4AgIejEeZffqHbH2D25jh+MJmMJ7OXONbRwcYT78oE0QPUB/H3G5X+HAAGZxeYPz7g4eYzHm4+Y/74gLf3h/jw5Vf8C6d3ywa2GjLvBGsNIowO0J28pCflkhzAMjkApFtAwe7cYW8LnX6vrm1fJJNFFEWZSUG2LDITd+K/KxgDZHGy7XOWLmSQbJMBcxcxPd+Jty+7dzg+i3B1sh1vv/3HFWUGfdIn3fMddM938HA0wuH+AA8Xu/G2Pnm+nKvV9MdLA9UZP6vO+FldPqn0Sx4DoH7fnqrp+Y76fXuq1PNY/b49TZ8vz0F8XXv5mPV/7XkbxarHqx9X4tP/hb2tSuK4fFI+Y8rE2Bk/q7HVHnabZtrv9K7pq26ZNpJYnG1XcyzQ+gfx5V01Pd9RSilj7Dliq500MPtLOk06UgL9fXuadv6qJEnftN8BkBn0SDo2kxxJDJABkHxvxe0b432PAfXf94iTJplwJJ7LJ9VoZ2fitCactO20dms6Hjnu7d3UaMfp+Y73Piu79CjthGdJsg2Qq1yTnwMMPv+MXzg5Adauo0f6a+lXYhzP8UV6QcC+Ape+H+0av33xoMb7i4CcTtS3f/r2tKltlcWy/Za3jacxSR82sY2x47LjcPRx47fruJZVY6Yd583S5V6rlpgdK4Fr+xfHZK969c6Q5jGyK2lenE2Stofj+G2ubEYc+vY/gHgMsluocBpOsGMpSoDM9rHB2FztFkJbtn38MtTWTj6WIQkqhDtQy6I3ZPb26fyfEUIIIYQQQgghhBBCCCGEEEIIIYQQQgghZE14Mx55TeTdzUs/CPnroR+EBEVIHwugH6QCIXXga0IBwekl6AdZgxA7sIiQE9mOjX6QFbhOgkLqVPpB/EE/COgHaQv6QUrEQD+IZ+gH8RsfQD8I/SAtQD9I+ePTD1LjQKUfxAP0gxRCP0iD0A+ShX4Q0A8i39MPYkA/iOsYVaEfxBv0g2jQD0I/SC70g5SDfhC/0A9SIRZo/QPQD7J5zI5GpR+kQpzWhEM/SF5g9IP4xtmJ9IOUi8uOg36QijHTD7JZjPSDbAb9IP5ic7VbCG3Z9vHLUFs70Q9CPwghhBBCCCGEEEIIIYQQQgghhBBCCCGEEFIrvBmPvCby7ualH4T89dAPQoIipI8F0A9SgZA68DWhgOD0EvSDrEGIHVhEyIlsx0Y/yApcJ0EhdSr9IP6gHwT0g7QF/SAlYqAfxDP0g/iND6AfhH6QFqAfpPzx6QepcaDSD+IB+kEKoR+kQegHyUI/COgHke/pBzGgH8R1jKrQD+IN+kE06AehHyQX+kHKQT+IX+gHqRALtP4B6AfZPGZHo9IPUiFOa8KhHyQvMPpBfOPsRPpBysVlx0E/SMWY6QfZLEb6QTaDfhB/sbnaLYS2bPv4ZaitnegHoR+EEEIIIYQQQgghhBBCCCGEEEIIIYQQQgipFd6MR14TeXfz0g9C/nroByFBEdLHAugHqUBIHfiaUEBwegn6QdYgxA4sIuREtmOjH2QFrpOgkDqVfhB/0A8C+kHagn6QEjHQD+IZ+kH8xgfQD0I/SAvQD1L++PSD1DhQ6QfxAP0ghdAP0iD0g2ShHwT0g8j39IMY0A/iOkZV6AfxBv0gGvSD0A+SC/0g5aAfxC/0g1SIBVr/APSDbB6zo1HpB6kQpzXh0A+SFxj9IL5xdiL9IOXisuOgH6RizPSDbBYj/SCbQT+Iv9hc7RZCW7Z9/DLU1k70g9APQgghhBBCCCGEEEIIIYQQQgghhBBCCCGE1ApvxiOviby7eekHIX899IOQoAjpYwH0g1QgpA58TSggOL0E/SBrEGIHFhFyItux0Q+yAtdJUEidSj+IP+gHAf0gbUE/SIkY6AfxDP0gfuMD6AehH6QF6Acpf3z6QWocqPSDeIB+kELoB2kQ+kGy0A8C+kHke/pBDOgHcR2jKvSDeIN+EA36QegHyYV+kHLQD+IX+kEqxAKtfwD6QTaP2dGo9INUiNOacOgHyQuMfhDfODuRfpBycdlx0A9SMWb6QTaLkX6QzaAfxF9srnYLoS3bPn4Zamsn+kHoByGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQmqFN+OR10Te3bz0g5C/HvpBSFCE9LEA+kEqEFIHviYUEJxegn6QNQixA4sIOZHt2OgHWYHrJCikTqUfxB/0g4B+kLagH6REDPSDeIZ+EL/xAfSD0A/SAvSDlD8+/SA1DlT6QTxAP0gh9IM0CP0gWegHAf0g8j39IAb0g7iOURX6QbxBP4gG/SD0g+RCP0g56AfxC/0gFWKB1j8A/SCbx+xoVPpBKsRpTTj0g+QFRj+Ib5ydSD9IubjsOOgHqRgz/SCbxUg/yGbQD+IvNle7hdCWbR+/DLW1E/0g9IMQQgghhBBCCCGEEEIIIYQQQgghhBBCCCG1wpvxyP8qeXfueh3TTBDyv0imYLVV5M7buGaCkDxCve2/uMK85yQJ6Y03TagDoG0UEKw+ojYPSB5tv+E2CHkAAO0mbln/R1sxqkurUJ0r1gLtmn3esjL2df0g6+I6kWpzEIbsD3ElbpOf1iycnYe9LVwnfg1HjI3EJ4U2rnrAJIqAnDrHnX4Pi1H29/UCI8lWbGXsdSaIs1Bzi4PQKYCRWagmAUzp2FyDc7KsZNhITKuqW8rAWzzO0hPkJttMqqhESdX+NapxZguA9/ZxjdVCnSrV3ct8MF5dPqnUIaJ7RVoSxMSzc9LAUojbroPrWQDjisFZHSRv5m6wzYzJbFURbf05bfTpGHDWWhYWjzPc3k0BLSa9ALj4RlzaNpt1E0T3fOQ1iOqMn9O6rYDpE2m4QaUQm/Hg/OUiLvHpKP9ZU2yFfo8KvpBacRXRNtDKgTZIJGVY508qLX1rc/31HreHb/DPw6eM3kK2VlIMu0z8eQmSW75Hap7mVERX8pzd/Y+FWd4AagxAKYW3R+aGVHwhemXyOuPQt3bWBFHFF9IIURQZExuwXDWsguRNEi1OtlPnh+0Cud6LcHv4Bn8OPsSFrZdF+CK9qNw6xbZdCVLo7hA/hby47gPRRSs/779hd/+j8cJSeb2BVSROVKXSCo+XT7GmobsXrxoNJQcApH6UHI1YSsMzsoE+WOZPsVxo+O+y/7SrWGnVfu3qX5NE4vxYJEWzr/ciLB5nmCaeEEmM1C4Qj4docbKdjt2yBdPtBFnl7ogWJ9vpH2Om5zuGDwRYVv7+fqPw8/5bZhUpu7StibGKifPDZT/qv19u+fJ8InVg25LslUNUZk3GpBFhdGAca/6kcLU/SWOQZLh8ildkcXKkV4SaJe7A5KrW5ZNCp9/Dhz83AOLE6CZjU+IUROnW6fdK/UExs4Ks2O/G026SHOIA0Z0gwmT2ku4TZbaWQVGHDVX3e+iCTEnY670I0/MdvPuxTJK0pnCyPM+HW7U5LvK8HvKYJLN9IjwfJnashsQ5clwA6TZGkkNP6u7hV4zRrI5BQ+n+D9ulOHtzHAt2vvzCw1H2eu86Se08B7GXn1QDvJTL4MOXX3h7f5hxggzOLozf0U+m9CsJnjo8Xi2S4sX6cfXZUFfCSZIAyySRk/buxKshSUiFNIIMOunkyewls6UB4vZKV8H6B2GE0UF8dS/Z57/bvcvIhvR2HVgXPxokWpxsp+5LSY7ft6d4uNiNfSFHo9QhkqAcybR2exq+Dt2TIf+Ho7Cy7gWR4tXynCKvyIaN5PSMwNpuOb0g1vuwagvXiaFa0Osa622lt/dY3mezl8YzbQgzDuPxBuOyMWLRx6B4Q27vpsvYzfFR8YB6lfEVySGPixNE/Axple0VXpFNG8eITRfemO6KTMX5nGRqCgWYRb9lQhlD84TU401ZL06tHfW2a3BCKUvqp9HbTZJjk8RwLTFl/B3pcxYn21CJLfbhYhfD3Yfln/OTZTCDn+1C5oKCvl8G4HSAAPFJXc3ujyKU5vtw+0CytPKXfcDo+5jkNvMW289FOvDTvs363b3G6fz7hus5+uw8tlaYnNfxNesYK5y1ykGPI88P4jGWteJ2xJVdMepTwJWOE+7+CtXF4TKaBUEmARocgMY2zjqeuUW0fxbI3rngsbZjLCLU2Lxv/epaHiXAZu7yXELXByGEEEIIIYQQQgghhBBCCCGEEEIIIYQQEhi8gY+8JvLu4q08zpkg5LWQfohP/xBdQSHrUjBBSFVC+iiBMzmETT792PYbq5OQOvA1oYDg9BG1eUNe48AJsQOLCDmR7djK+kPqisH1+hkdmx6Tsd2KCwauFd+6+gPXSVBInRqy/8PGlchNfhJzFVkPiEMfIdSkjzC2Tnl9qBcYsenuRRgqhasZkBTLWCu+daq7pyU99S+E89lkIznskp1SdBthxJu2pa6GyKv+3lZ8EldaOLBgIAL1VMyUSuzy+uu0j/yeFN9bFb+Lsgmi7M4U90eixCoTcO2dbnfQVW9ZMBswGqjVgg12eVSdgkHQVC2q3ImmTNFtnwku5YXE5+GIQd3eTQurdPbfQzQIlSiTIJlti14W//gsWtUoUumk6DmbktEIDHtbmCQmovnLhfGzpAxpa5U5KvhACv0idZFTX8pAim7XdXwpNu3wkagxgH8ePuH28E1utfbvNwrzDeqgVTFMpfTfA7v7H/UOdZUAQs7etfbKhlI0W3wgwtujEZRSGcFKA1TxgWT1YU1uFZNC5UB229rdi5wV9H3hqrOsn2h3z3cw//ILfw4+xEmyl3WGiEuk6gWEVQliiA+vLaHK7v5H/Lz/ZohVdF+IvEnxY9ivm+cg8cn8SWHYSyqkJ1tCUSMMVXrItvf8AFarz6QSfZW9dBWkcLVU7V9Yeobhvx/jFVpzrfiuQn/99X5ZHV+z7OpxdRMvyPR8J3Z/iDPkZBviEkHFCwelVhCXbrf/Hvh5/w3fb5RRAVz3hYiJaPE4M97cCgdJZfLcGt29yGm7ErlOji2rVlyxutRnsuKsY0XaFH070+0P8PZoJOeaRpJc7U+M5JjMvFbHjzA6QKffM07UhW5/EPs/tET58Ocmfr7EtCx7WzmeUgkiwUlnSaN8v1FGR9uukNTws9zD5g68Ta+ALB5nmA+30mVWklqS492PeIWTmUUv6a8lqK54qCVJFo8zdBMXiesEWLYseS6RPM+IR1JdwxixB0RI6/UmSSIeyjqTN8+F+HA0ijVr/QFmb47jBzV3ou4PwQZ9uTJB9AD1QSzeD2mUwdlFxhXy9v5wWZBZk9zYDVlWh1VAhNEBupOX9KRckgNYJgcAQxUHZDt32NtCp9+ra9sXyWQROQSismWRmbgT/13BGCBNCmt0/4e+ixAp0bvdOxyfxT6R672oPreKPuiTPhH3x8PRKPaBXOzG2/rk+XKu1kSB7ZWeD92/IY6GvALNustD/78vZ4ger35cpyfE3lY5vCgeYsrE2Bk/p4oD3Qeix51pv+Y1CJk2klicbVdzLND6B/HlXcMDImPPEVvtrPR8SEdKoL9vT9POX5UkNXkwMoMeyHpC5Oe61Ea+r7lKuPG+x9C8IIAhILKq5DdNZsJJ2850sDQajxz39m5qtKP4aXzGVHbpUXmeD/0q1+TnAIPPP+MXTk6Ai9wiwiZKrFVxS3z2FTiXO6TAN1LHEu3sRKcvZOkTacUTMuxt6beNpzFJH7bgCVm2nXYritXHjd+u41pWjZl2nDdLl3utWmIu8oPYj2dWvXpnSLcPJEdzV2MchTEWuEDaXNmMOAxHTPvxGGS3UOE0nGDHUpQAvjVx68TmarcQ2rLt45ehtnbysQxJUCHcgVoWvSHpFCGEEEIIIYQQQgghhBBCCCGEELLk/wEcOCal7RbC7QAAAABJRU5ErkJggg==" }, "Laying": { "width": 40, "height": 16, "durations": [12], "rows": 8, "anchors": [20, 12], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAACACAYAAAB5sSvuAAAD9klEQVR4nO2YLXfiShiAn9xzf8CVVIWqIlMXt9SB67p1pYorca1jcVuHLIqsq6sEB9fFEblVBQVy/8FcMZkhgSQkcLuHs/d9zulpzjB5552PZJ6MQzVURplTMUYlqgRX7ni9V7i6v6gapxJlAyt3vKbj1WxB/VrfulwoBvr6UCxVoT3LH6ckB/Cl5xCPbNb0m3J1oM5JCebif4JG6y6ZvNr9c8dr6E5SHcype1SCdvSCaGOm0tJo3fFj+p0g2gAwe7ji/bVr/wOswgjX92ydZNz+QtFfqMIZOLhuzIPR8WoMrh36C0X92sH/pCu8DPUanD1cZQa4eXqD7gRGbdPe3pIBCKJN5gP354EEbXKA6SnLhcLvObwMVWpk6n6Tuu/rOmEIwOwBbp7atsNFbQwyyg+uwVUY2SSSvX4ZKvs7QLP3yDKcMx9+Yz78xjKcczm91SMI0J3YDpp7DIPnaW77ZR771DQbTNKr+wveX7ssw7kdwWUY0vz51a7deOqgO6H/d0uXhVHq2vW946c4Z6HbkQjqzwQ/NwRhM/2b19JJjte68VGbAXGSeHbkXN/bG9UqCTqM2mrFZP+XUZvd3aV++6wvPjsE/lo3vH1AYNRWAya4vofre9vOJOscyd47DlD9hVLueK0ANQY1e7hS769dNXu4KnrHZcXKpNQUx2T1LhX4HuDpDXgruqeo/EMoHIHfnqpDLT64i/gg4oPigxrxQfHBIsQHxQdjxAfPEfHBUxEfRHxQfFAjPig+WIT4oPhgjPjgOSI+eCrig4gPig9qxAfFB4sQHxQfjBEfPEfEB09FfBDxQfFBjfig+GAR4oPigzHig+eI+OCpiA8iPig+qBEfFB8sQnxQfDBGfPAc+eihPtkfPzLB/8Qfj0mwjNcps2eD3hoNeXtuHlV1K+l1uf7njtd86W3bT/pjx6sd8sdSCea+ozpeLbmvZr7POl6NRuvOGs8pZCVY6GpBtEltTUn/M8oVRBt+TL/TaN2lAg+uHYJoU2kUd9dBGVdTxu+KHLC/UHaaw3+23y79hUqJRkYOKfZ2kgw1T3UAsMnV/SZAygGX4dx2iqFO0jwkSSvaFY88Mtfgrp+Z6TTfF6BH6XJ6u+eAzd5j6h7jjSYxk3yeveySOcVGrzpejcHzNHUdWwfJb5X5X1+tBxovvPw84pBHZrS/x94UW3kMIwYhhcmZ+rS209tpzOnUa8DooEeWIdtQuhPrajZg2tdsndX9BUrpaZw/NnSCSZPuZntkTtulKeNrih3/G2+/hVV/oTL9MSdWLnk+WKZ3DsDN05tK+N+xsX45/x9HlPPBU5HzQeR8UM4HNXI+KOeDRcj5oJwPxsj54DnyL18IP2km1fLfAAAAAElFTkSuQmCC" }, "Hop": { "width": 32, "height": 72, "durations": [2, 1, 2, 3, 4, 4, 3, 2, 1, 2], "rows": 8, "anchors": [16, 40], "url": "data:image/png;base64,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" }, "Eat": { "width": 24, "height": 32, "durations": [6, 8, 6, 8], "rows": 1, "anchors": [12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAgCAYAAADtwH1UAAADUklEQVR4nO1YLXfiQBS92bM/AAkqqWIlOFyDA8kvIFFB1rGuJ6pdVwkq7C9oXXBBxhW3XbVEpRK5blYMb5qETL4gXTP3nBzCzOS+mzfvvZkMoKCgoPDfoFUYwy58viry7FyD/7P0N0KZAAbHhz4awBp0ReNm/44o3APraRWOMnAHnewkEdm9qjrl3O3qvzhoigYz3YsBICWesNm/AxBOuqqDkjYucFSb+hkAED8hobUyZ+EEeAAsxmBs3s8i6GB1sdE02DWM5dnQvTjXQUlbTZ3Ukv6rBs0XmRGaXU3TzgxZgy40jXOfxhXVWRlKnU+2GthoVb/M+UJvppQWQTYBsAZdWA9zeKf/lLL06wGwHualDqwK4q3aXoaW9F89aGQpwu5fP541hufDDol+l/c3qtHWoAtjqBWWCm2xrbsOtKW/dF2h9qqlU5oBFCkk3k5cyfamEZpFYalosAi3pT8K93z9yDxHwZI32UWQTkBk94QRGzxlf93yX3qJxCw3AtlIloosZO1VuYGr6tewnpauKxkUliFpCaIbSrntpodvkznetj8xsXhbRnytnYQHoOMHmE3HyNZVSmX6bVDi2tTPPKRLGMEYarAe5jC6j4jsHoJlH+Mfvwu58zKAb7O8GFRHI7uHiRXD6D5iYsVC+P0r4y/o+KmXroKOH2D28hdwfER2D+5qKyKWJkM4vx5/m/oZwJ2fXdSpnZwPx8fRXFEGS7m/yjooAjdvJoxnBzfbvfjI+PPs4BCasLDjTgorSJdAHw1gLbg+d6jBzfafssNd1+NtTb/jwx1qYnJTi+5p/697Mb8HYCz7AM+CXBSWoGDZhzEycQh3ZwOoffxBXqtEiPQ8fdSQ+GDZF/wAcDNb8wituQtqSb/Yubk5i63oW/FdG2MMh5cFfwcJv3QCnv0And0CAGDefQcA7J4eU/cAcDRXmE3HVV9A8NMa0NkthBPIYcZohEMYCseV1dFP1i8mF8CZ3uS7HM0VjtNx4dd26VlQFO4RdO6EMeGU4xOP3OZnQSwZ/UHn7ur8beuX8QvuCw78mO7F7P6VMd2LGfisp66cfsXfgL/wKAJInRamLtpJND2KUPwchSWoZFxZfxkUv4KCgoKCgoKCgoKCgoKCgsLn4h/zkq9tTzHBzAAAAABJRU5ErkJggg==" }, "Nod": { "width": 32, "height": 32, "durations": [6, 8, 6], "rows": 8, "anchors": [16, 20], "url": "data:image/png;base64,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" }, "Pose": { "width": 24, "height": 32, "durations": [12, 2, 8], "rows": 8, "anchors": [12, 20], "url": "data:image/png;base64,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" }, "LookUp": { "width": 24, "height": 32, "durations": [6, 6], "rows": 1, "anchors": [12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAYAAABU1PscAAACzklEQVR4nO2Xr3biUBDGf9mzoo9QVHBUpg4JDlx5gm0UyHXpKorq4Q2KSvYJiksdkXHE1iWKSN5gVoTcJuQPSWm3hu8cDnAz95tvZu7cewMXXHAWtAY2cub8psj6acx7ylCYugDofUMNRn6Q/FiNWzmr9AHMt4l+J4iJzE5TfbUGwtRF7xvcG9eFh04QJ4GcF4TI0y8eR06BO4wf0P78PcldG4Bu70rFZx0dsvWRAMQGTN6zn8XiViN9Xsf/o4qcqVsrHkieJ0usrk9qIVI+tWr8GFUB5NZ8HZraHUGYuoRb4TEoN3gMINzKyQRVBvDV+KwEVQYQ+QFOENdOVo38jfhZMa6xGkuEi4MBkBOaZuWcXSjyAzBGzexqUOW4sOayTaVppdPaBvFlu5zo9k6YugJIio3VExtkY/XUGEkzJvbtdiLFn86fb0V9sv7VdwVKl1C6NESEcD0rPA/XM0LfQ0TQNI0It4X2JPMA0Qpe7q6YjDssjoxe3A2T1WG59ndEZkcoqUR5D2TEe5MVXatHuHxT31gQLt/wuFFBtEVkdhARvIcbNlavaODNFHcacBnKAtAAyYqyD+K7/YESr/7n5zWBFpkdScWnHKHvFXi9h1yCSvmrdiHSBnOCGNPssCmxCX2P7l1D2UdYv3rsD9UEChVOx9YDr5anLIDc7nBvXLOYugyXYzZWRvzB4fpVOShdoxXQJuNh0pjLN2woVJjD2D6jq4z/5Em8eH5lPhsp0arMVo/94JnJeJge920gur1jvhV0e5de2HLoZvuihv9kAPPZSJ3IZoY4Fa/bu7aHWaHCqcDQ93KG+8Ezv+ObWv7KbdTBUD0Q+YFysh9cASSZh3Ou08B7hYe3yVIC8tVNUMlffRIfly3JQpO5p5CrgBPE+UTl/Zz5Rtbctg3Umx4c3XU+cK/6zJfyNshX+D3rrfV8VwDwdRW+4IILLviP+AcKOpHuZmOrZAAAAABJRU5ErkJggg==" }, "Sit": { "width": 24, "height": 32, "durations": [8, 8, 8], "rows": 1, "anchors": [12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAgCAYAAACxSj5wAAADFElEQVR4nO1ZMZLaMBR9zqRImZKtTCpSko7S20HH3gAq7w1I56ELN4DK3MDpoIPSHS5DtaYyZW7wU9gSspAl2+Alu8ubYUCW9PT1vr70ZYA77rijQVgl2tCF/d80TBMk208w6rbOKpbREYfxQxkOE/5rB+gMKBSH4QoivYYDLsInXaVOnDL1BmgdMOq2YPsJoF9hjaNIIMqMM+KSSTTsAAbSfIz4fA0LaqCSAw7jB0K9UDOFsJG3MMQOYYRldNSOvoyOOIRROVNfH1cJYe0mDXcFu9cFALZhAuBhlYqzGJh4tNzGQ+CCMbydOYqmPywtt14gsUCnomWddau1/Jt0gOkEZqh7WhLcFQEghs2kQz5Am0mHPxPbVZwAIG2YIuS6Oty2n5C3I7L9hGw/yfGxZ6y+6hhnhC+BmxOIldlkagzStAPSfqe+OX4+t3ybCuSSBwBwcvlb8ngpfsZJRPQSuE04gM/Dzxws2s3KFe3OT8DbEf8wlVUTEQSqZDgTp0j4CxzAx2E8svDiMxOvNpMGgOl8De+5r6yLw21FmwFkm6FlWfj2tMAYQDzboz3poN1z0J50cmW5X0lQsNoAAJzABQCZiz/P2hWKZBTIe+7zfEgUJJ7tAQC/11tFLzNsP4G3I9h+gnFBm5oOIAAY9h20ew7nkLnicIt2z8Gw7+T6yVAKJCaJLBex/QSPs/3Ju5MO/jpzPA0eAXdVOIBqAuIRPOq2AHeVcusdUDrEWJoQh1tub5zxy2WxvQoqgSwsBjiEEabzNQ5hdAoxd4X2pAMAXBxvRzyXqQMxhGO9A0pDld07gYt4tuehZWrPUD6TzpI2FtvMcLvXrZponSVxQrKGjeSA7C5WhT+1HWlyu/35nT9k4jM4v/6ISa+S3/jCTNGeCn6XRe6aId/nguEXAJkDytupHkeCD+Br5uBh3zGKU3fga4DOwia9Uoi4hm18tYqrtMoYt3xbp1qdV+WXQ3k6X6c/KtzvbvU+CLiBc2rsl+Y86KPjXQukyueq4uZ/qzSM/GFQ493SexcIyB8GH2G+d9zxlvAPTY+pa9EusGIAAAAASUVORK5CYII=" }, "Rotate": { "width": 32, "height": 32, "durations": [2, 2, 2, 2, 2, 2, 2, 2, 2], "rows": 8, "anchors": [16, 20], "url": "data:image/png;base64,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" }, "DeepBreath": { "width": 24, "height": 32, "durations": [12, 6, 6, 6, 6, 6, 6, 10, 4], "rows": 1, "anchors": [12, 20, 12, 20, 11, 20, 12, 20, 11, 20, 12, 20, 11, 20, 12, 20, 12, 20], "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANgAAAAgCAYAAABw4baZAAAEJElEQVR4nO1aMXebSBgc7l2R0qVUoVR2Oqmji9TJnd25M1QknVLZVymq4qtO3cUV5Be4RJ1IRydKpzqopNL/YK+AXSPMAsIBEfLNezz7sbszwz4N3y4AEAgEAoHwK0I5tgEALKfttf7q5G5Cg/y3Q6Myjm2AwXSgakPow544afs7hJ4P3J8D1T3Wyd2EBvlvi4YchdxlxOu6Q2RODscrJ6lO7iY0yH+LNX5mgBlMh6nWls03TByqtWUwHYb88BVzxwfnTP5NtreMm/x333/Ebzp7v/v0USYDeeljMB3MP0ylHRZfV5XvcKq1FXeFwejl8GAT+bb9HUKjf4hGndzkv/v+hcZ8U5zNRaQt5f4jb3BeuMq050Ef9mD7OzE5RuIAokmz/V1m+T8mN/nvvn/EAQaigGaBn4/7SZMoC9hPE8ji5v98ju4sYlI4jFR7etyRuJvQIP/t0IA+7GEwUhDovRcZsP0dAj1qLwqwtILxgfxOkRZIth8AUXY5pwHAyjj4JPF+8bi8SaqTm/x3338mFOVliPRhD4pSbsX5Z5lOWQJVYfs7zDcMi5GCYMNgxSVee//cx/seTVKwYQhHCuYbJq2kTXGT/+77T+sEX66Bv74hyGi3AOhfrjEo4JXFkKnWlm8OkbXZizd3SPQ7aBMMAKHR50tMrOw+zqbXeFx9w1R/2V5So05u8t99/3s6yd89X7Wl93VFDzlkFUwJjX7uUxTeViSQhdDzoWpDwHREiKfxREC/E+dgOqJ/G7jJf/f9x2CqtcVipEC1tljZfVzFDfzvVN+KAIdGn0GSgcIKxh+HphPMH39WqGBA/ApgfTIDAAy0Md6uLvgjf/z3YCLwXADA5Gl56KuAOrnJ/2/gny8pEy+TRSUEsBdg/hJaVmikAePvwPhS0EK0zvW+P28g5xtW9V0Ye3DWOHE/YKCNxWQkwc8/jb/i8nxyCH+d3OS/2/73wlU2wHkhk78Huz8XG0ogCtW7VLhsfydEqyLwXAy0McazWwDAeHYrnbQ2cTehQf6b11iMFIRGHw8XbwA8B3V9MsP65hTrm1OhCQAPF28QGn1RiNKQVrD5P/9i8ekjgP3EctG3l/cAgES/g+9C65vTvRNZEzP5+0fbuJvQIP/H1RAVkvMONA3u8g7j2S0CzxM6RRVSVsGUxaeP0SbRdPYSKy4ibqsYLgCAe/UYrZFjJCdn8rSEe/VYhbZ27iY0yP9RNZTL8wn0MxeTpyUCz4W7vMNAG8Nd3iHwovP6mVt1iQumWtv0R717R0b7wfziw2EJf6q9Ddzkv/v+G7mGMoNfdQFl+FNfRreBuwkN8n98jecv5gt+/0X8eaUtOSirX1F7Eerkr9t73Rrk//gaTVwDgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIHQB/wM2ypUjcPqONwAAAABJRU5ErkJggg==" } } };

// src/garden.js
var P = {
  sky0: "#8fcbe0",
  sky1: "#a9d8e6",
  sky2: "#c6e6ea",
  sky3: "#e2f1e4",
  hill0: "#a7d0ae",
  hill1: "#8cbf98",
  trees0: "#6aa57c",
  trees1: "#558f69",
  wood: "#c79a68",
  woodLight: "#e2bd8a",
  woodDark: "#9b7149",
  woodLine: "#6b4b31",
  grass: "#88c36b",
  grassLight: "#9fd17a",
  grassLighter: "#b6de8b",
  grassDark: "#71ad5c",
  grassDarker: "#5a944f",
  sun: "#c3e08a",
  sunLight: "#d8eb9c",
  stone: "#dcd3b8",
  stoneLight: "#efe8d3",
  stoneDark: "#b3a988",
  sand: "#e3d4a2",
  sandDark: "#c4b282",
  rock: "#a9b2ae",
  rockDark: "#7f8a87",
  water0: "#3f8fb4",
  water1: "#58a9cb",
  water2: "#7cc3da",
  water3: "#b6e3ec",
  trunk: "#8b6343",
  trunkLight: "#aa7d54",
  trunkDark: "#664530",
  leaf0: "#2f6e45",
  leaf1: "#3f8a50",
  leaf2: "#58a55a",
  leaf3: "#7cc066",
  leaf4: "#a8d97c",
  outline: "#2c4a37",
  pink: "#f19ab4",
  yellow: "#f6d562",
  white: "#fbf7e8",
  red: "#e5675a",
  violet: "#b493dd",
  berry: "#4e7fd6"
};
function rng(seed) {
  return () => {
    seed = seed * 16807 % 2147483647;
    return seed / 2147483647;
  };
}
function pen(c) {
  const rect = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const dot = (x, y, color) => rect(x, y, 1, 1, color);
  const ellipse = (cx, cy, rx, ry, color, filter) => {
    for (let y = Math.ceil(-ry); y <= ry; y++) {
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)) + 0.25);
      if (!filter) rect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1, color);
      else
        for (let x = -half; x <= half; x++)
          if (filter(Math.round(cx + x), Math.round(cy + y), x / rx, y / ry)) dot(Math.round(cx + x), Math.round(cy + y), color);
    }
  };
  return { rect, dot, ellipse };
}
var checker = (x, y) => (x + y) % 2 === 0;
var hash = (x, y) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
};
function noise(x, y, cell = 4) {
  const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
  const bottom = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}
var ragged = (amount, cell = 4) => (x, y, nx, ny) => nx * nx + ny * ny < 1 - amount * noise(x, y, cell);
function blob(c, cx, cy, rx, ry, color, wobble = 0.07, phase = 0) {
  c.fillStyle = color;
  for (let y = Math.floor(-ry * 1.2); y <= ry * 1.2; y++)
    for (let x = Math.floor(-rx * 1.2); x <= rx * 1.2; x++) {
      const nx = x / rx, ny = y / ry, a = Math.atan2(ny, nx);
      const edge = 1 + wobble * (Math.sin(3 * a + phase) * 0.6 + Math.sin(5 * a + phase * 2) * 0.4);
      if (Math.hypot(nx, ny) <= edge) c.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
}
function drawBackground() {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const c = canvas.getContext("2d");
  const { rect, dot, ellipse } = pen(c);
  const rand = rng(1337);
  const bands = [
    [0, P.sky0],
    [6, P.sky1],
    [12, P.sky2],
    [18, P.sky3]
  ];
  bands.forEach(([y, color], i) => {
    rect(0, y, 160, 30 - y, color);
    if (i) {
      for (let x = 0; x < 160; x++) if (checker(x, y)) dot(x, y - 1, color);
    }
  });
  for (let x = 0; x < 160; x++) {
    const h0 = 17 + Math.round(Math.sin(x * 0.045 + 1) * 3 + Math.sin(x * 0.11) * 1.5);
    rect(x, h0, 1, 20, P.hill0);
    const h1 = 22 + Math.round(Math.sin(x * 0.07 + 3) * 2.5 + Math.sin(x * 0.19) * 1);
    rect(x, h1, 1, 20, P.hill1);
  }
  for (let x = -4; x < 168; x += 7 + Math.floor(rand() * 5)) {
    const r = 3 + Math.floor(rand() * 3);
    ellipse(x, 27 - r * 0.4, r, r, P.trees0);
    ellipse(x + 1, 28 - r * 0.2, r - 1, r - 1, P.trees1, (px2, py2) => py2 > 27 - r * 0.6);
  }
  rect(0, 31, 160, 89, P.grass);
  for (let y = 36; y < 120; y++)
    for (let x = 0; x < 160; x++) {
      const n = noise(x, y * 1.8, 9) * 0.65 + noise(x + 40, y * 2, 4) * 0.35;
      if (n > 0.66) dot(x, y, P.grassLight);
      else if (n < 0.3) dot(x, y, P.grassDark);
    }
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rand() * 160), y = 34 + Math.floor(rand() * 86);
    const dark = rand() < 0.55;
    dot(x, y, dark ? P.grassDark : P.grassLighter);
    if (rand() < 0.6) {
      dot(x - 1, y - 1, dark ? P.grassDark : P.grassLight);
      dot(x + 1, y - 1, dark ? P.grassDarker : P.grassLight);
    }
  }
  for (let x = 0; x < 160; x++) {
    rect(x, 34, 1, 2, P.grassDark);
    if (checker(x, 36)) dot(x, 36, P.grassDark);
  }
  const fenceY = 21;
  for (const y of [fenceY + 4, fenceY + 9]) {
    rect(0, y, 160, 2, P.wood);
    rect(0, y, 160, 1, P.woodLight);
    rect(0, y + 2, 160, 1, P.woodDark);
  }
  for (let x = 2; x < 160; x += 8) {
    rect(x - 1, fenceY - 1, 6, 15, P.woodLine);
    rect(x, fenceY, 4, 14, P.wood);
    rect(x, fenceY, 1, 14, P.woodLight);
    rect(x + 3, fenceY + 1, 1, 13, P.woodDark);
    rect(x + 1, fenceY - 2, 2, 1, P.woodLine);
    rect(x + 1, fenceY - 1, 2, 1, P.woodLight);
  }
  ellipse(SUN_PATCH.x, SUN_PATCH.y, SUN_PATCH.rx + 2, SUN_PATCH.ry + 2, P.sun, ragged(0.35, 3));
  ellipse(SUN_PATCH.x + 2, SUN_PATCH.y - 1, SUN_PATCH.rx - 5, SUN_PATCH.ry - 2, P.sunLight, ragged(0.45, 3));
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand());
    dot(Math.round(SUN_PATCH.x + Math.cos(a) * d * SUN_PATCH.rx), Math.round(SUN_PATCH.y + Math.sin(a) * d * SUN_PATCH.ry), P.white);
  }
  ellipse(TREE.x + 2, TREE.y + 5, 26, 10, P.grassDark, ragged(0.3, 4));
  ellipse(TREE.x + 2, TREE.y + 3, 17, 5, P.grassDarker, ragged(0.35, 3));
  for (const [x, y, w] of [
    [HOME.x + 1, 116, 6],
    [HOME.x - 5, 108, 5],
    [HOME.x + 3, 100, 5],
    [HOME.x - 3, 92, 4],
    [HOME.x + 2, 85, 4]
  ]) {
    ellipse(x, y + 1, w, 2, P.grassDarker);
    ellipse(x, y, w, 2, P.stone);
    rect(x - w + 2, y - 1, w * 2 - 4, 1, P.stoneLight);
    rect(x - w + 2, y + 2, w * 2 - 4, 1, P.stoneDark);
  }
  const { x: px, y: py, rx, ry } = POND;
  const ph = 0.8;
  blob(c, px, py + 2, rx + 4, ry + 3, P.grassDarker, 0.06, ph);
  blob(c, px, py, rx + 3, ry + 2, P.sandDark, 0.06, ph);
  blob(c, px, py - 1, rx + 3, ry + 2, P.sand, 0.06, ph);
  blob(c, px, py, rx, ry, P.water0, 0.06, ph);
  blob(c, px, py + 1.5, rx - 1, ry - 1.5, P.water1, 0.06, ph);
  blob(c, px + 2, py + 2.5, rx - 7, ry - 5, P.water2, 0.1, ph + 1);
  for (let x = -rx + 4; x <= rx - 4; x++) {
    const y = Math.round(py + ry * Math.sqrt(1 - (x / rx) ** 2) * (1 + 0.06 * Math.sin(3 * Math.atan2(1, x / rx) + ph))) - 1;
    if (noise(px + x, y, 3) > 0.35) dot(px + x, y, P.water3);
  }
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const x = Math.round(px + Math.cos(a) * (rx + 3.5)), y = Math.round(py + Math.sin(a) * (ry + 2.5));
    dot(x, y, P.grassDark);
    if (rand() < 0.5) dot(x, y - 1, P.grassLight);
  }
  for (const [x, y, w] of [
    [px + rx + 1, py + 3, 4],
    [px + rx - 3, py + ry, 3],
    [px + rx + 3, py - 2, 3],
    [px - rx - 2, py - 3, 3]
  ]) {
    rect(x - 1, y, w + 2, 2, P.rockDark);
    rect(x, y - 1, w, 2, P.rock);
    rect(x, y - 1, w - 1, 1, "#c7cecb");
  }
  ellipse(21, 107, 15, 6, P.grassDark, ragged(0.3, 3));
  const flower = (x, y, color) => {
    dot(x, y + 1, P.grassDarker);
    dot(x - 1, y, color);
    dot(x + 1, y, color);
    dot(x, y - 1, color);
    dot(x, y + 1, color);
    dot(x, y, P.yellow);
  };
  [
    [10, 104, P.pink],
    [15, 108, P.white],
    [20, 103, P.violet],
    [26, 107, P.pink],
    [31, 104, P.white],
    [24, 111, P.yellow],
    [13, 112, P.violet],
    [33, 110, P.red],
    [58, 40, P.white],
    [100, 38, P.pink],
    [143, 41, P.yellow],
    [48, 116, P.white],
    [112, 108, P.pink],
    [70, 76, P.white],
    [150, 92, P.violet]
  ].forEach(([x, y, color]) => flower(x, y, color));
  const mushroom = (x, y) => {
    rect(x, y - 1, 2, 3, P.white);
    rect(x - 2, y - 3, 6, 2, P.red);
    rect(x - 1, y - 4, 4, 1, P.red);
    dot(x - 1, y - 3, P.white);
    dot(x + 2, y - 4, P.white);
  };
  mushroom(46, 63);
  mushroom(50, 65);
  ellipse(138, 104, 6, 3, P.rockDark);
  ellipse(138, 103, 5, 3, P.rock);
  rect(135, 101, 5, 1, P.grassLight);
  rect(134, 102, 3, 1, P.grassDark);
  return canvas;
}
function drawTree() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const c = canvas.getContext("2d");
  const { rect, dot } = pen(c);
  const ox = TREE.x - 32, oy = 0;
  const rand = rng(99);
  const W = (x) => x - ox, H = (y) => y - oy;
  for (let y = 26; y <= 59; y++) {
    const flare = y > 54 ? [0, 1, 1, 2, 3, 4][y - 54] ?? 4 : 0;
    const left = TREE.x - 4 - flare, right = TREE.x + 4 + flare;
    rect(W(left - 1), H(y), right - left + 3, 1, P.outline);
    rect(W(left), H(y), right - left + 1, 1, P.trunk);
    rect(W(right - 2), H(y), 2, 1, P.trunkLight);
    rect(W(left), H(y), 2, 1, P.trunkDark);
  }
  for (const [x, y] of [
    [TREE.x - 1, 36],
    [TREE.x + 1, 44],
    [TREE.x - 2, 50]
  ]) {
    rect(W(x), H(y), 2, 3, P.trunkDark);
  }
  rect(W(TREE.x - 3), H(30), 2, 2, P.trunkDark);
  const blobs = [
    [TREE.x - 12, 25, 12],
    [TREE.x + 12, 24, 13],
    [TREE.x, 16, 15],
    [TREE.x - 8, 9, 9],
    [TREE.x + 9, 8, 9],
    [TREE.x - 16, 36, 8],
    [TREE.x + 16, 35, 8],
    [TREE.x, 33, 11]
  ];
  const leaf = /* @__PURE__ */ new Map();
  for (const [bx, by, r] of blobs)
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y) / r;
        if (d > 1) continue;
        const light = (x * 0.55 - y * 0.85) / r + (rand() - 0.5) * 0.35;
        const tone = light > 0.62 ? 4 : light > 0.25 ? 3 : light > -0.25 ? 2 : light > -0.6 ? 1 : 0;
        const key = `${bx + x},${by + y}`;
        leaf.set(key, d > 0.88 ? Math.min(tone, 1) : tone);
      }
  const tones = [P.leaf0, P.leaf1, P.leaf2, P.leaf3, P.leaf4];
  for (const [key, tone] of leaf) {
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ])
      if (!leaf.has(`${x + dx},${y + dy}`)) dot(W(x + dx), H(y + dy), P.outline);
    dot(W(x), H(y), tones[tone]);
  }
  for (let i = 0; i < 46; i++) {
    const [bx, by, r] = blobs[Math.floor(rand() * blobs.length)];
    const a = rand() * Math.PI * 2, d = rand() * r * 0.8;
    const x = Math.round(bx + Math.cos(a) * d), y = Math.round(by + Math.sin(a) * d);
    const tone = leaf.get(`${x},${y}`);
    if (tone === void 0) continue;
    const up = tones[Math.min(4, tone + 1)], down = tones[Math.max(0, tone - 1)];
    rect(W(x - 1), H(y), 3, 1, up);
    dot(W(x - 2), H(y + 1), down);
    dot(W(x + 2), H(y + 1), down);
  }
  for (const [x, y] of [
    [TREE.x - 10, 30],
    [TREE.x + 13, 28],
    [TREE.x + 3, 37]
  ]) {
    rect(W(x), H(y + 1), 4, 2, P.berry);
    rect(W(x + 1), H(y), 2, 4, P.berry);
    dot(W(x + 2), H(y + 1), "#b5d3fb");
    dot(W(x + 1), H(y - 1), P.leaf0);
  }
  return { canvas, x: ox, y: oy, baseY: TREE.y };
}
function drawForeground() {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const c = canvas.getContext("2d");
  const { rect, ellipse } = pen(c);
  const rand = rng(7);
  const bush = (cx, cy, r) => {
    ellipse(cx, cy, r + 1, r * 0.75 + 1, P.outline);
    ellipse(cx, cy, r, r * 0.75, P.leaf1);
    ellipse(cx + 2, cy - 2, r - 3, r * 0.75 - 3, P.leaf2);
    ellipse(cx + 3, cy - 3, r - 7, r * 0.75 - 6, P.leaf3);
  };
  bush(152, 116, 11);
  bush(141, 121, 8);
  rect(151, 109, 2, 2, P.pink);
  rect(146, 113, 2, 2, P.pink);
  rect(156, 112, 2, 2, P.white);
  for (let x = 0; x < 132; x += 2 + Math.floor(rand() * 3)) {
    const h = 2 + Math.floor(rand() * 3);
    rect(x, 120 - h, 1, h, rand() < 0.5 ? P.grassDarker : P.grassDark);
  }
  return canvas;
}

// src/ambient.js
function phaseForHour(hour) {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 20.5) return "dusk";
  return "night";
}
var GRADES = {
  dawn: { tint: "#ffd9d2", sky: "#ffc7b8", glow: 0.25 },
  day: { tint: null, sky: null, glow: 0 },
  dusk: { tint: "#ffbf93", sky: "#ff9d77", glow: 0.45 },
  night: { tint: "#4f62a6", sky: "#26305e", glow: 1 }
};
var CLOUDS = [
  [
    "..XXXX......",
    ".XXXXXXX.XX.",
    "XXXXXXXXXXXX",
    ".ssssssssss."
  ],
  [
    "...XXX...",
    ".XXXXXXX.",
    "XXXXXXXXX",
    ".sssssss."
  ]
];
var SMALL_HEART = ["01010", "11111", "01110", "00100"];
var ICONS = {
  heart: SMALL_HEART,
  "!": ["1", "1", "1", "0", "1"],
  "?": ["111", "001", "011", "000", "010"],
  note: ["0011", "0010", "0010", "1110", "1100"],
  sparkle: ["00100", "00100", "11011", "00100", "00100"],
  dots: ["10101"]
};
var Ambient = class {
  constructor(random = Math.random) {
    this.random = random;
    this.time = 0;
    this.particles = [];
    this.clouds = [
      { x: 20, y: 3, shape: 0, speed: 1.6 },
      { x: 92, y: 9, shape: 1, speed: 1.1 },
      { x: 140, y: 2, shape: 1, speed: 1.9 }
    ];
    this.butterflies = [{ x: 60, y: 70, phase: 0, color: P.white, ttl: Infinity }];
    this.fireflies = Array.from({ length: 7 }, (_, i) => ({ x: 10 + i * 21, y: 50 + i * 17 % 55, phase: i * 1.7 }));
    this.ripples = [];
    this.blooms = [];
    this.nextRipple = 1;
    this.nextLeaf = 3;
    this.nextFish = 9;
  }
  spawn(p) {
    this.particles.push({ age: 0, vx: 0, vy: 0, ...p });
    if (this.particles.length > 120) this.particles.shift();
  }
  // Translate behavior events into particles.
  handle(event, pet) {
    const { x, y } = event;
    const r = this.random;
    switch (event.type) {
      case "hearts":
        for (let i = 0; i < (event.count || 1); i++)
          this.spawn({ kind: "heart", x: x - 6 + r() * 12, y: y - 22 - r() * 4, vy: -9 - r() * 4, delay: i * 0.18, life: 1.3 });
        break;
      case "splash":
        this.ripples.push({ x, y: y - 2, age: 0, big: true });
        this.ripples = this.ripples.slice(-24);
        for (let i = 0; i < 12; i++)
          this.spawn({ kind: "drop", x: x + (r() - 0.5) * 8, y: y - 2, z: 0, vz: 30 + r() * 25, vx: (r() - 0.5) * 30, life: 0.9 });
        break;
      case "tend":
        this.blooms.push({ x: x + 7, y: y + 2, age: 0, life: 9 });
        this.blooms = this.blooms.slice(-6);
        for (let i = 0; i < 4; i++) this.spawn({ kind: "petal", x: x + 7, y: y - 3, vx: (r() - 0.5) * 8, vy: -5 - r() * 5, color: [P.pink, P.white][i % 2], life: 1.6, delay: 0.7 + i * 0.2 });
        break;
      case "warm":
        for (let i = 0; i < 5; i++) this.spawn({ kind: "warmth", x: x - 3 + r() * 6, y: y - 9, vy: -2, life: 2.4, delay: i * 0.12 });
        break;
      case "pond-rings":
        for (let i = 0; i < 3; i++) this.ripples.push({ x, y, age: -i * 0.4, big: true, deliberate: true });
        this.ripples = this.ripples.slice(-24);
        for (let i = 0; i < 4; i++) this.spawn({ kind: "drop", x: x - 2 + i, y, z: 0, vz: 12 + r() * 10, vx: (i - 1.5) * 4, life: 0.7 });
        break;
      case "bounce":
      case "dust":
        for (let i = 0; i < 5; i++)
          this.spawn({ kind: "dust", x: x + (r() - 0.5) * 6, y, vx: (r() - 0.5) * 14, vy: -3 - r() * 4, life: 0.45 });
        break;
      case "sparkle":
      case "confetti": {
        const colors = event.type === "confetti" ? [P.pink, P.yellow, P.berry, P.white, P.red] : [P.yellow, P.white];
        for (let i = 0; i < (event.type === "confetti" ? 18 : 8); i++) {
          const a = r() * Math.PI * 2, s = 18 + r() * 24;
          this.spawn({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 18, color: colors[i % colors.length], life: 0.9 + r() * 0.4 });
        }
        break;
      }
      case "leaves":
        for (let i = 0; i < 4; i++) this.spawnLeaf(x + (r() - 0.5) * 30, y + r() * 8, i * 0.4);
        break;
      case "embers":
        for (let i = 0; i < 8; i++)
          this.spawn({ kind: "ember", x: x + (r() - 0.5) * 4, y: y - 12, vx: (r() - 0.5) * 10, vy: -10 - r() * 10, life: 1 + r() * 0.6, delay: i * 0.05 });
        break;
      case "petals":
        for (let i = 0; i < 5; i++)
          this.spawn({ kind: "petal", x: x + (r() - 0.5) * 10, y: y + 2, vx: (r() - 0.5) * 12, vy: -12 - r() * 8, color: [P.pink, P.white, P.violet][i % 3], life: 1.4 });
        break;
      case "butterfly":
        this.butterflies.push({ x: pet.x + 14, y: pet.y - 6, phase: r() * 6, color: [P.yellow, P.pink, P.white][Math.floor(r() * 3)], ttl: 9, orbit: pet });
        this.butterflies = this.butterflies.slice(-4);
        break;
    }
  }
  spawnLeaf(x, y, delay = 0) {
    this.spawn({ kind: "leaf", x, y, vy: 7 + this.random() * 4, sway: this.random() * 6, life: 4.5, delay, land: 58 + this.random() * 18 });
  }
  tick(dt, phase, reduced = false) {
    for (const bloom of this.blooms) bloom.age += dt;
    this.blooms = this.blooms.filter((bloom) => bloom.age < bloom.life);
    for (const butterfly of this.butterflies) butterfly.ttl -= dt;
    this.butterflies = this.butterflies.filter((b) => b.ttl === Infinity ? phase !== "night" : b.ttl > 0);
    if (reduced) {
      for (const p of this.particles) {
        p.delay = 0;
        p.age += dt;
      }
      this.particles = this.particles.filter((p) => p.age < p.life);
      this.ripples = this.ripples.filter((ripple) => ripple.deliberate && (ripple.age += dt) < 1.6).slice(0, 1);
      return;
    }
    this.time += dt;
    const r = this.random;
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x > 170) cloud.x = -16;
    }
    this.nextRipple -= dt;
    if (this.nextRipple <= 0) {
      this.nextRipple = 1.6 + r() * 2.5;
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.7;
      this.ripples.push({ x: POND.x + Math.cos(a) * d * POND.rx, y: POND.y + Math.sin(a) * d * POND.ry, age: 0 });
    }
    this.nextFish -= dt;
    if (this.nextFish <= 0) {
      this.nextFish = 10 + r() * 14;
      const x = POND.x - 10 + r() * 20, y = POND.y - 2 + r() * 6;
      this.spawn({ kind: "fish", x, y, life: 0.8, dir: r() < 0.5 ? -1 : 1 });
      this.ripples.push({ x, y, age: -0.75, big: true });
    }
    for (const ripple of this.ripples) ripple.age += dt;
    this.ripples = this.ripples.filter((ripple) => ripple.age < 1.6);
    this.nextLeaf -= dt;
    if (this.nextLeaf <= 0) {
      this.nextLeaf = 5 + r() * 7;
      this.spawnLeaf(TREE.x - 18 + r() * 36, TREE.canopyY + 6 + r() * 10);
    }
    for (const b of this.butterflies) {
      b.phase += dt;
      const home = b.orbit ? { x: b.orbit.x, y: b.orbit.y - 16 } : { x: 70 + Math.sin(b.phase * 0.13) * 50, y: 62 + Math.sin(b.phase * 0.21) * 22 };
      b.x += (home.x + Math.cos(b.phase * 1.3) * 12 - b.x) * Math.min(1, dt * 1.5);
      b.y += (home.y + Math.sin(b.phase * 2.1) * 6 - b.y) * Math.min(1, dt * 1.5);
    }
    if (!this.butterflies.length && phase === "day") this.butterflies.push({ x: -8, y: 60, phase: 0, color: P.white, ttl: Infinity });
    for (const f of this.fireflies) {
      f.phase += dt;
      f.x += Math.cos(f.phase * 0.7 + f.y) * dt * 4;
      f.y += Math.sin(f.phase * 0.9 + f.x) * dt * 3;
      f.x = (f.x + 160) % 160;
      f.y = Math.min(112, Math.max(36, f.y));
    }
    for (const p of this.particles) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "drop") {
        p.vz -= 140 * dt;
        p.z += p.vz * dt;
        if (p.z < 0) p.age = p.life;
      } else if (p.kind === "spark") {
        p.vy += 50 * dt;
        p.vx *= 1 - dt * 2;
      } else if (p.kind === "petal" || p.kind === "ember") p.vy += (p.kind === "petal" ? 20 : 2) * dt;
      else if (p.kind === "leaf") {
        if (p.y >= p.land) p.vy = 0;
        p.x += Math.sin(p.age * 3 + p.sway) * dt * 8;
      } else if (p.kind === "dust") p.vx *= 1 - dt * 5;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }
  // ---- drawing ---------------------------------------------------------------------------
  // Under the Pokémon: sky motion, water, swaying plants.
  drawBack(c, phase, reduced) {
    const { rect, dot } = pen(c);
    const t = reduced ? 0 : this.time;
    if (phase !== "night") {
      const sunY = phase === "day" ? 4 : 11;
      const sx = phase === "dawn" ? 66 : 134;
      rect(sx, sunY, 8, 6, "#fff2b8");
      rect(sx + 1, sunY - 1, 6, 8, "#fff2b8");
      rect(sx + 2, sunY + 1, 3, 2, "#ffffff");
    }
    for (const cloud of this.clouds) {
      CLOUDS[cloud.shape].forEach(
        (row, y) => [...row].forEach((ch, x) => {
          if (ch !== ".") dot(Math.round(cloud.x) + x, cloud.y + y, ch === "X" ? "#ffffff" : "#d9eef3");
        })
      );
    }
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.6 + i * 0.37) % 1;
      const x = Math.round(POND.x - 16 + i * 11 % 30 + k * 4), y = POND.y - 6 + i * 5 % 13;
      if (Math.sin(t * 2 + i * 1.9) > -0.3) rect(x, y, 3 + i % 2, 1, P.water3);
    }
    for (const ripple of this.ripples) {
      if (ripple.age < 0) continue;
      const k = reduced ? 0.5 : ripple.age / 1.6, rx = 2 + k * (ripple.big ? 10 : 6), ry = rx * 0.4;
      c.globalAlpha = 1 - k;
      for (let a = 0; a < 20; a++) {
        const ang = a / 20 * Math.PI * 2;
        dot(Math.round(ripple.x + Math.cos(ang) * rx), Math.round(ripple.y + Math.sin(ang) * ry), P.water3);
      }
      c.globalAlpha = 1;
    }
    for (const bloom of this.blooms) {
      const open = reduced || bloom.age > 0.7;
      const x = Math.round(bloom.x), y = Math.round(bloom.y);
      c.globalAlpha = reduced || bloom.age < 7 ? 1 : (bloom.life - bloom.age) / 2;
      rect(x, y - 4, 1, 5, P.leaf2);
      dot(x - 1, y - 2, P.leaf3);
      dot(x + 1, y - 3, P.leaf3);
      if (open) {
        rect(x - 2, y - 6, 5, 3, P.pink);
        rect(x - 1, y - 7, 3, 5, P.pink);
        dot(x, y - 5, P.yellow);
      } else rect(x, y - 6, 2, 2, P.pink);
      c.globalAlpha = 1;
    }
    for (const [x, y, flower, i] of [
      [POND.x - 14, POND.y + 3, true, 0],
      [POND.x + 11, POND.y - 3, false, 1],
      [POND.x + 4, POND.y + 6, false, 2]
    ]) {
      const bob = Math.round(Math.sin(t * 1.2 + i * 2) * 0.6);
      rect(x - 3, y + bob, 7, 3, "#4f9a52");
      rect(x - 2, y - 1 + bob, 5, 1, "#62b05f");
      dot(x, y + bob, "#3f8a50");
      if (flower) {
        rect(x - 1, y - 2 + bob, 3, 2, P.pink);
        dot(x, y - 3 + bob, "#fbd3df");
      }
    }
    for (const [x, y, h, i] of [
      [POND.x - POND.rx - 1, POND.y + 3, 12, 0],
      [POND.x - POND.rx + 2, POND.y + 6, 8, 1],
      [POND.x + POND.rx, POND.y, 13, 2],
      [POND.x + POND.rx - 3, POND.y + 5, 9, 3]
    ]) {
      const sway = Math.round(Math.sin(t * 1.3 + i * 1.7) * 1);
      for (let k = 0; k < h; k++) dot(x + (k > h * 0.55 ? sway : 0), y - k, k < 3 ? P.leaf1 : P.leaf2);
      dot(x + 1, y - 3, P.leaf2);
      dot(x + 2, y - 4, P.leaf3);
      if (i % 2 === 0) {
        rect(x + sway, y - h - 3, 2, 4, "#7a4a2e");
        dot(x + sway + 1, y - h - 3, "#a8724a");
        dot(x + sway, y - h - 4, P.leaf2);
      }
    }
    for (let i = 0; i < 14; i++) {
      const x = 6 + i * 47 % 150, y = 44 + i * 29 % 70;
      if (Math.abs(x - SUN_PATCH.x) < 14 && Math.abs(y - SUN_PATCH.y) < 6) continue;
      if (((x - POND.x) / (POND.rx + 6)) ** 2 + ((y - POND.y) / (POND.ry + 5)) ** 2 < 1) continue;
      const s = Math.round(Math.sin(t * 1.6 + i * 0.8));
      dot(x, y, P.grassDarker);
      dot(x - 1, y - 1, P.grassDark);
      dot(x + 1, y - 1, P.grassDark);
      dot(x - 1 + s, y - 2, P.grassLight);
      dot(x + 2 + s, y - 2, P.grassLight);
      dot(x + s, y - 3, P.grassLighter);
    }
    if (phase === "day")
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.5 + i / 3) % 1;
        if (k < 0.25) {
          const x = SUN_PATCH.x - 12 + (i * 13 + Math.floor(t * 0.5)) * 7 % 24, y = SUN_PATCH.y - 3 + i * 5 % 6;
          dot(x, y, "#ffffff");
          if (k > 0.08 && k < 0.17) {
            dot(x - 1, y, "#fff5c4");
            dot(x + 1, y, "#fff5c4");
            dot(x, y - 1, "#fff5c4");
            dot(x, y + 1, "#fff5c4");
          }
        }
      }
  }
  // Above the Pokémon: particles, butterflies, falling leaves.
  drawFront(c, phase, reduced) {
    const { rect, dot } = pen(c);
    const t = reduced ? 0 : this.time;
    for (const p of this.particles) {
      if (p.delay > 0) continue;
      const k = p.age / p.life, x = Math.round(p.x), y = Math.round(p.y);
      if (p.kind === "heart") {
        c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        bitmap(c, SMALL_HEART, x - 2, y, "#e8657a");
        dot(x - 1, y + 1, "#ffc2cc");
        c.globalAlpha = 1;
      } else if (p.kind === "drop") dot(x, Math.round(p.y - p.z), P.water3);
      else if (p.kind === "dust") {
        c.globalAlpha = 0.8 * (1 - k);
        rect(x, y, k < 0.5 ? 2 : 1, 1, "#e8e2c9");
        c.globalAlpha = 1;
      } else if (p.kind === "spark") {
        c.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        dot(x, y, p.color);
        if (k < 0.4) dot(x + 1, y, p.color);
        c.globalAlpha = 1;
      } else if (p.kind === "warmth") {
        c.globalAlpha = reduced ? 0.8 : Math.min(1, (1 - k) * 2);
        dot(x, y, k < 0.6 ? "#ffe5a3" : "#edac64");
        if (k < 0.5) dot(x + 1, y, "#f6c67e");
        c.globalAlpha = 1;
      } else if (p.kind === "ember") {
        dot(x, y, k < 0.4 ? "#fff1a6" : k < 0.7 ? "#ffad4a" : "#c95a33");
      } else if (p.kind === "petal") {
        c.globalAlpha = 1 - k;
        dot(x, y, p.color);
        c.globalAlpha = 1;
      } else if (p.kind === "leaf") {
        c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
        const flip = Math.sin(p.age * 5 + p.sway) > 0;
        rect(x, y, flip ? 2 : 1, 1, P.leaf3);
        dot(x + (flip ? 0 : 1), y + 1, P.leaf2);
        c.globalAlpha = 1;
      } else if (p.kind === "fish") {
        const arc = Math.sin(k * Math.PI) * 6;
        rect(x + Math.round(p.dir * (k - 0.5) * 8), Math.round(y - arc), 3, 1, "#f3a25b");
        dot(x + Math.round(p.dir * (k - 0.5) * 8) + (p.dir > 0 ? -1 : 3), Math.round(y - arc - 1), "#f3a25b");
      }
    }
    for (const b of this.butterflies) {
      if (phase === "night" && b.ttl === Infinity) continue;
      const x = Math.round(b.x), y = Math.round(b.y), open = reduced || Math.sin(t * 18 + b.phase) > 0;
      dot(x, y, P.outline);
      if (open) {
        rect(x - 2, y - 1, 2, 2, b.color);
        rect(x + 1, y - 1, 2, 2, b.color);
      } else {
        dot(x - 1, y - 1, b.color);
        dot(x + 1, y - 1, b.color);
      }
    }
  }
  // Lights are added after the scene grade so they glow in the dark.
  drawLights(c, phase, glowSource, reduced) {
    const grade = GRADES[phase];
    const { dot, rect } = pen(c);
    const t = reduced ? 0 : this.time;
    if (phase === "night") {
      for (let i = 0; i < 18; i++) {
        const x = (i * 37 + 11) % 160, y = i * 13 % 17;
        if (x < 56 || x > 126 && x < 140 && y < 13) continue;
        if (Math.sin(t * 1.5 + i * 2.3) > -0.6) dot(x, y, i % 4 ? "#c9d4ff" : "#ffffff");
      }
      rect(130, 4, 7, 7, "#f4f1d8");
      rect(131, 3, 5, 9, "#f4f1d8");
      rect(132, 5, 2, 2, "#dcd8bd");
      rect(134, 8, 1, 1, "#dcd8bd");
      c.globalAlpha = 0.6;
      for (let i = 0; i < 4; i++) rect(POND.x + 6 - i, POND.y - 4 + i * 2, 4 + i * 2 - (i > 1 ? 4 : 0), 1, "#f4f1d8");
      c.globalAlpha = 1;
    }
    if (!grade.glow) return;
    c.globalCompositeOperation = "lighter";
    const glow = (x, y, r, color, strength) => {
      for (let i = 3; i >= 1; i--) {
        c.globalAlpha = strength * 0.13;
        pen(c).ellipse(Math.round(x), Math.round(y), Math.round(r * i / 3), Math.round(r * i * 0.7 / 3), color);
      }
      c.globalAlpha = 1;
    };
    if (glowSource) glow(glowSource.x, glowSource.y, 16, "#ff9a3c", grade.glow * (0.85 + Math.sin(t * 9) * 0.08));
    if (phase === "night" || phase === "dusk")
      for (const f of this.fireflies) {
        const on = (Math.sin(f.phase * 1.7) + 1) / 2;
        if (on < 0.35) continue;
        glow(f.x, f.y, 4, "#d9ff6b", grade.glow * on);
        c.globalAlpha = on;
        dot(Math.round(f.x), Math.round(f.y), "#f6ffb8");
        c.globalAlpha = 1;
      }
    c.globalCompositeOperation = "source-over";
  }
};
function bitmap(c, rows, x, y, color, scale = 1) {
  c.fillStyle = color;
  rows.forEach((row, iy) => [...row].forEach((ch, ix) => ch === "1" && c.fillRect(x + ix * scale, y + iy * scale, scale, scale)));
}
function drawBubble(c, bubble, x, y, time, reduced) {
  const icon = ICONS[bubble.kind] || ICONS["!"];
  const age = time - bubble.start, left = bubble.until - time;
  const iw = icon[0].length, ih = icon.length;
  const w = Math.max(9, iw + 6), h = Math.max(9, ih + 4);
  const pop = reduced ? 1 : Math.min(1, age / 0.12);
  const bob = reduced ? 0 : Math.round(Math.sin(age * 4) * 0.6);
  if (pop < 0.5) return;
  const bx = Math.round(x - w / 2), by = Math.round(y - h + bob);
  c.globalAlpha = left < 0.25 && !reduced ? Math.max(0, left / 0.25) : 1;
  const { rect, dot } = pen(c);
  rect(bx + 1, by, w - 2, h, "#2c3a33");
  rect(bx, by + 1, w, h - 2, "#2c3a33");
  rect(bx + 1, by + 1, w - 2, h - 2, "#fffdf3");
  rect(bx + 1, by + h - 2, w - 2, 1, "#e6e0cc");
  dot(Math.round(x) - 1, by + h, "#2c3a33");
  dot(Math.round(x), by + h, "#fffdf3");
  dot(Math.round(x) + 1, by + h, "#2c3a33");
  dot(Math.round(x), by + h + 1, "#2c3a33");
  const color = { heart: "#e8657a", "!": "#d9573f", "?": "#4c7fd0", note: "#5f9a4f", sparkle: "#e5a823", dots: "#6c7a70" }[bubble.kind] || "#2c3a33";
  let ix = bx + Math.floor((w - iw) / 2), iy = by + Math.floor((h - ih) / 2);
  if (bubble.kind === "dots") {
    for (let i = 0; i < 3; i++) dot(ix + i * 2, iy + (!reduced && Math.floor(age * 6) % 3 === i ? -1 : 0), color);
  } else bitmap(c, icon, ix, iy, color);
  c.globalAlpha = 1;
}

// src/renderer.js
var ZZ = ["1111", "0010", "0100", "1111"];
var ZZ_SMALL = ["111", "001", "010", "111"];
var images = /* @__PURE__ */ new Map();
function loadImage(url) {
  if (!images.has(url))
    images.set(
      url,
      new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      })
    );
  return images.get(url);
}
async function loadSprites(species) {
  const entries = await Promise.all(
    Object.entries(assets[species]).map(async ([name, data]) => [name, { ...data, image: await loadImage(data.url) }])
  );
  return Object.fromEntries(entries);
}
function frameAt(anim, clock, once) {
  const total = anim.durations.reduce((sum, d) => sum + d, 0);
  let t = once ? Math.min(clock, total - 1e-3) : clock % total, frame = 0;
  while (t >= anim.durations[frame] && frame < anim.durations.length - 1) t -= anim.durations[frame++];
  return frame;
}
function drawSprite(c, sprites, name, clock, dir, x, y, { once = false, reduced = false, k = 1 } = {}) {
  const a = sprites[name] || sprites.Idle;
  const frame = reduced ? once ? a.durations.length - 1 : 0 : frameAt(a, clock, once);
  const row = a.rows === 1 ? 0 : dir;
  const i = a.anchors.length > 2 ? (row * a.durations.length + frame) * 2 : 0;
  const snap = (v) => Math.round(v * k) / k;
  c.drawImage(a.image, frame * a.width, row * a.height, a.width, a.height, snap(x - a.anchors[i]), snap(y - a.anchors[i + 1]), a.width, a.height);
}
var BALL = [
  ["..###..", ".#rrr#.", "#rrRrr#", "#kkwkk#", "#wwwww#", ".#www#.", "..###.."],
  ["..###..", ".#rrr#.", "#rrrrr#", "#rkkkw#", "#wwwww#", ".#www#.", "..###.."],
  ["..###..", ".#rrr#.", "#rrrrr#", "#wkkkr#", "#wwwww#", ".#www#.", "..###.."]
];
var BALL_COLORS = { "#": "#2c3a33", r: "#e5544b", R: "#ffb3a8", w: "#f7f4ea", k: "#2c3a33" };
function drawPixels(c, rows, x, y, colors) {
  rows.forEach(
    (row, iy) => [...row].forEach((ch, ix) => {
      if (colors[ch]) {
        c.fillStyle = colors[ch];
        c.fillRect(x + ix, y + iy, 1, 1);
      }
    })
  );
}
function createRenderer(canvas, sprites, species) {
  const c = canvas.getContext("2d");
  const background = drawBackground(), tree = drawTree(), foreground = drawForeground();
  const ambient = new Ambient();
  const shadowRx = [5, 8, 10][animMeta[species].shadowSize] || 8;
  const sp = SPECIES[species];
  let k = 1, bubbleLift = 0;
  const view = { x: 0, y: 0, w: WORLD.width, h: WORLD.height };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function follow(pet, snap) {
    const tx = clamp(pet.x - view.w / 2, 0, WORLD.width - view.w), ty = clamp(pet.y - 12 - view.h / 2, 0, WORLD.height - view.h);
    view.x = snap ? tx : view.x + (tx - view.x) * 0.08;
    view.y = snap ? ty : view.y + (ty - view.y) * 0.08;
  }
  function shadow(x, y, rx) {
    c.globalAlpha = 0.4;
    pen(c).ellipse(Math.round(x), Math.round(y) + 1, rx, Math.max(1, Math.round(rx * 0.36)), "#1f3d26");
    c.globalAlpha = 1;
  }
  function drawPet(pet, reduced) {
    const anim = pet.anim;
    if (pet.swimming) {
      c.save();
      c.beginPath();
      c.rect(0, 0, WORLD.width, Math.round(pet.y - 3));
      c.clip();
      drawSprite(c, sprites, anim.name, pet.animClock, pet.dir, pet.x, pet.y, { once: anim.once, reduced, k });
      c.restore();
      c.globalAlpha = 0.85;
      const t = pet.time;
      for (let a = 0; a < 16; a++) {
        const ang = a / 16 * Math.PI * 2 + (reduced ? 0 : t);
        c.fillStyle = P.water3;
        c.fillRect(Math.round(pet.x + Math.cos(ang) * 8), Math.round(pet.y - 3 + Math.sin(ang) * 2.5), 1, 1);
      }
      c.globalAlpha = 1;
      return;
    }
    shadow(pet.x, pet.y, shadowRx);
    drawSprite(c, sprites, anim.name, pet.animClock, pet.dir, pet.x, pet.y, { once: anim.once, reduced, k });
  }
  function drawBall(ball, reduced) {
    if (ball.phase !== "carried") shadow(ball.x, ball.y, Math.max(2, 3 - ball.z / 12));
    const frame = reduced ? 0 : Math.floor(ball.spin) % 3;
    drawPixels(c, BALL[frame], Math.round(ball.x - 3), Math.round(ball.y - 6 - ball.z), BALL_COLORS);
  }
  function drawTreat(treat) {
    shadow(treat.x, treat.y, 2);
    const x = Math.round(treat.x - 2), y = Math.round(treat.y - 5 - treat.z);
    const rows = [".gg..", "bbbb.", "bLbbb", "bbbbb", ".bbb."].map(
      (row, i) => i >= 5 - treat.bites ? row.replace(/[bL]/g, ".") : row
    );
    drawPixels(c, rows, x, y, { b: P.berry, L: "#a9cdfb", g: P.leaf2 });
  }
  function draw(pet, phase, reduced) {
    follow(pet, reduced);
    c.setTransform(k, 0, 0, k, -Math.round(view.x * k), -Math.round(view.y * k));
    c.imageSmoothingEnabled = false;
    for (const event of pet.drain()) ambient.handle(event, pet);
    c.drawImage(background, 0, 0);
    ambient.drawBack(c, phase, reduced);
    const items = [{ y: tree.baseY, draw: () => c.drawImage(tree.canvas, tree.x, tree.y) }];
    items.push({ y: pet.swimming ? pet.y - 6 : pet.y, draw: () => drawPet(pet, reduced) });
    if (pet.ball) items.push({ y: pet.ball.phase === "carried" ? pet.y + 0.5 : pet.ball.y, draw: () => drawBall(pet.ball, reduced) });
    if (pet.ball?.phase === "carried") bubbleLift = 9;
    else bubbleLift = 0;
    if (pet.treat) items.push({ y: pet.treat.y, draw: () => drawTreat(pet.treat) });
    items.sort((a, b) => a.y - b.y).forEach((item) => item.draw());
    c.drawImage(foreground, 0, 0);
    ambient.drawFront(c, phase, reduced);
    const grade = GRADES[phase];
    if (grade.tint) {
      c.globalCompositeOperation = "multiply";
      c.fillStyle = grade.tint;
      c.fillRect(0, 0, WORLD.width, WORLD.height);
      c.globalAlpha = 0.55;
      c.fillStyle = grade.sky;
      c.fillRect(0, 0, WORLD.width, 22);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    }
    const flame = sp.glow && !pet.swimming ? { x: pet.x + [-5, -6, -7, -3, 5, 6, 7, 3][pet.dir], y: pet.y - 10 } : null;
    ambient.drawLights(c, phase, flame, reduced);
    if (pet.bubble) drawBubble(c, pet.bubble, pet.x, pet.y - (pet.swimming ? 20 : 26) - bubbleLift, pet.time, reduced);
    if (pet.asleep && !reduced) {
      for (let i = 0; i < 2; i++) {
        const q = (pet.time * 0.45 + i * 0.5) % 1;
        c.globalAlpha = q < 0.75 ? 1 : (1 - q) / 0.25;
        bitmap(c, q < 0.4 ? ZZ_SMALL : ZZ, Math.round(pet.x + 6 + q * 6), Math.round(pet.y - 18 - q * 12), "#fffdf3");
        c.globalAlpha = 1;
      }
    }
  }
  return {
    ambient,
    // Backing store is an integer multiple of the art grid; CSS scales it with pixelated sampling.
    resize(cssWidth, dpr) {
      const zoom = cssWidth < 300 ? 1.4 : 1;
      view.w = Math.round(WORLD.width / zoom);
      view.h = Math.round(WORLD.height / zoom);
      k = Math.max(1, Math.min(8, Math.round(cssWidth * dpr / view.w)));
      if (canvas.width !== view.w * k || canvas.height !== view.h * k) {
        canvas.width = view.w * k;
        canvas.height = view.h * k;
      }
    },
    // Canvas fraction (0–1) → garden coordinates, through the camera.
    toWorld(fx, fy) {
      return { x: view.x + fx * view.w, y: view.y + fy * view.h };
    },
    tick(dt, phase, reduced) {
      ambient.tick(dt, phase, reduced);
    },
    draw
  };
}

// src/runtime.js
var FPS = 30;
var REDUCED_FPS = 8;
function mountCanvas({ canvas, ctx, bridge, pet, species, reduced, sky = () => "auto", selected, memory, onStatus, onError, onReady }) {
  let disposed = false, ready = false, frame = 0, last = 0, pending = 0, inView = false, renderer, draw, lastStatus = "", phase = "day", phaseCheck = 0;
  const disposers = [];
  const updatePhase = () => {
    const setting = sky();
    phase = setting === "auto" ? phaseForHour((/* @__PURE__ */ new Date()).getHours() + (/* @__PURE__ */ new Date()).getMinutes() / 60) : setting;
  };
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    pending = 0;
  }
  function active() {
    return !disposed && ready && !document.hidden && inView && bridge.visible.get() && canvas.clientWidth > 0 && canvas.clientHeight > 0;
  }
  function render() {
    if (!ready || disposed) return;
    draw();
    memory?.flush();
    if (pet) {
      const status = `${pet.state}:${pet.busy}:${pet.caption}`;
      if (status !== lastStatus) {
        lastStatus = status;
        onStatus?.(pet);
      }
    }
  }
  function step(dt) {
    phaseCheck -= dt;
    if (phaseCheck <= 0) {
      phaseCheck = 20;
      updatePhase();
    }
    if (pet) {
      pet.setReduced(reduced());
      let remaining = dt;
      while (remaining > 0) {
        const s = Math.min(remaining, 0.05);
        pet.tick(s);
        remaining -= s;
      }
    }
    renderer?.tick(dt, phase, reduced());
    memory?.checkpoint();
  }
  function loop(now) {
    frame = 0;
    if (!active()) return stop();
    const dt = last ? Math.min((now - last) / 1e3, 0.25) : 0;
    last = now;
    pending += dt;
    const interval = 1 / (reduced() ? REDUCED_FPS : FPS);
    if (pending >= interval - 4e-3 || !dt) {
      step(Math.min(pending, 0.25));
      pending = 0;
      render();
    }
    frame = requestAnimationFrame(loop);
  }
  function refresh() {
    stop();
    syncPresence();
    if (active()) {
      updatePhase();
      render();
      frame = requestAnimationFrame(loop);
    }
  }
  function syncPresence() {
    memory?.setPresent(active() && document.hasFocus());
  }
  const resize = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 3);
    if (renderer) renderer.resize(rect.width, dpr);
    refresh();
  });
  resize.observe(canvas);
  const intersection = new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    refresh();
  });
  intersection.observe(canvas);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", syncPresence);
  window.addEventListener("blur", syncPresence);
  window.addEventListener("pagehide", leave);
  function leave() {
    memory?.setPresent(false);
  }
  disposers.push(bridge.visible.subscribe(refresh));
  if (pet)
    disposers.push(
      bridge.activity.subscribe(() => {
        if (active()) pet.react(bridge.activity.get().kind);
      })
    );
  loadSprites(species).then((sprites) => {
    if (disposed) return;
    if (pet) {
      renderer = createRenderer(canvas, sprites, species);
      renderer.resize(canvas.getBoundingClientRect().width, Math.min(devicePixelRatio || 1, 3));
      draw = () => renderer.draw(pet, phase, reduced());
    } else {
      const c = canvas.getContext("2d");
      canvas.width = 36;
      canvas.height = 42;
      let clock = 0, anim = "Idle", once = false, wasSelected = selected?.(), lastTime = performance.now();
      draw = () => {
        const now = performance.now(), dt = Math.min(0.1, (now - lastTime) / 1e3);
        lastTime = now;
        const isSelected = selected?.();
        if (isSelected && !wasSelected) [anim, once, clock] = ["Hop", true, 0];
        wasSelected = isSelected;
        clock += dt * 60;
        const length = sprites[anim].durations.reduce((a, b) => a + b, 0);
        if (once && clock > length + 12) [anim, once, clock] = ["Idle", false, 0];
        if (!once && anim === "Idle" && clock > 360) [anim, once, clock] = ["Nod", true, 0];
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.imageSmoothingEnabled = false;
        drawSprite(c, sprites, anim, clock, 0, canvas.width / 2, canvas.height - 4, { once, reduced: reduced() });
      };
    }
    ready = true;
    if (pet) {
      pet.setReduced(reduced());
      if (active()) pet.react(bridge.activity.get().kind);
    }
    onReady?.();
    refresh();
  }).catch((error) => {
    console.error("[hermes-pokemon]", error);
    if (!disposed) onError?.("The bundled sprites could not be loaded. Reload the plugin to try again.");
  });
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    resize.disconnect();
    intersection.disconnect();
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", syncPresence);
    window.removeEventListener("blur", syncPresence);
    window.removeEventListener("pagehide", leave);
    memory?.dispose();
    disposers.forEach((fn) => fn());
  }
  ctx.runtimes.add(dispose);
  return {
    dispose() {
      dispose();
      ctx.runtimes.delete(dispose);
    },
    refresh,
    toWorld: (fx, fy) => renderer?.toWorld(fx, fy) ?? { x: fx * 160, y: fy * 120 },
    get phase() {
      return phase;
    }
  };
}

// src/signal.js
function signal(initial) {
  let value = initial;
  const listeners = /* @__PURE__ */ new Set();
  return {
    get: () => value,
    set(next) {
      if (Object.is(value, next)) return;
      value = next;
      for (const fn of listeners) fn();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    clear() {
      listeners.clear();
    }
  };
}

// src/persistence.js
var STORAGE_KEY = "companion";
var VERSION = 3;
var SKIES = ["auto", "dawn", "day", "dusk", "night"];
var DEFAULT_RECORD = {
  version: VERSION,
  species: null,
  nickname: "",
  motion: "system",
  sky: "auto",
  memories: {}
};
var knownSpecies = (species) => typeof species === "string" && Object.hasOwn(SPECIES, species);
var timestamp = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 864e13;
var interactionKinds = ["pet", "ball", "berry", "call", "greeting"];
function validateMemory(raw) {
  const interaction = raw?.lastInteraction;
  return {
    favoriteSpot: typeof raw?.favoriteSpot === "string" && Object.hasOwn(SPOTS, raw.favoriteSpot) ? raw.favoriteSpot : null,
    lastInteraction: interactionKinds.includes(interaction?.kind) && timestamp(interaction?.at) ? { kind: interaction.kind, at: interaction.at } : null,
    lastSeenAt: timestamp(raw?.lastSeenAt) ? raw.lastSeenAt : 0,
    lastGreetingAt: timestamp(raw?.lastGreetingAt) ? raw.lastGreetingAt : 0
  };
}
function cleanName(value, species) {
  return (typeof value === "string" ? [...value.replace(/[\u0000-\u001f\u007f]/g, "").trim()].slice(0, 24).join("") : "") || SPECIES[species]?.name || "";
}
function validateRecord(raw) {
  if (!raw || ![1, 2, VERSION].includes(raw.version)) return { ...DEFAULT_RECORD, memories: {} };
  const species = knownSpecies(raw.species) ? raw.species : null;
  const memories = {};
  for (const name of Object.keys(SPECIES)) {
    if (raw.memories && Object.hasOwn(raw.memories, name)) memories[name] = validateMemory(raw.memories[name]);
  }
  return {
    version: VERSION,
    species,
    nickname: cleanName(raw.nickname, species),
    motion: ["system", "reduced"].includes(raw.motion) ? raw.motion : "system",
    sky: SKIES.includes(raw.sky) ? raw.sky : "auto",
    memories
  };
}
function createPersistence(storage) {
  let raw, warning = "";
  try {
    raw = storage.get(STORAGE_KEY, null);
  } catch {
    warning = "Storage is unavailable. Your companion will stay for this visit.";
  }
  const future = typeof raw?.version === "number" && raw.version > VERSION;
  if (future)
    warning = "This save belongs to a newer version. It will be kept untouched.";
  const state = signal({ record: validateRecord(raw), warning });
  function update(patch) {
    const record = validateRecord({
      ...state.get().record,
      ...patch,
      version: VERSION
    });
    if (JSON.stringify(record) === JSON.stringify(state.get().record)) return false;
    let warning2 = future ? state.get().warning : "";
    if (!future) {
      try {
        storage.set(STORAGE_KEY, record);
      } catch {
        warning2 = "Could not save. Your companion will stay for this visit.";
      }
    }
    state.set({ record, warning: warning2 });
    return true;
  }
  return {
    ...state,
    update,
    getMemory(species) {
      return validateMemory(knownSpecies(species) ? state.get().record.memories[species] : null);
    },
    remember(species, patch) {
      if (!knownSpecies(species) || !patch || typeof patch !== "object" || Array.isArray(patch)) return false;
      const memories = state.get().record.memories;
      const previous = validateMemory(memories[species]);
      const memory = validateMemory({ ...previous, ...patch });
      if (JSON.stringify(memory) === JSON.stringify(previous)) return false;
      return update({ memories: { ...memories, [species]: memory } });
    }
  };
}

// src/presence.js
var WELCOME_ABSENCE_MS = 6e4;
var GREETING_COOLDOWN_MS = 3e5;
var timestamp2 = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
function shouldGreet(memory, now = Date.now()) {
  const seen = memory?.lastSeenAt;
  const greeted = memory?.lastGreetingAt;
  if (!timestamp2(now) || !timestamp2(seen) || !timestamp2(greeted) || seen === 0) return false;
  if (seen > now || greeted > now) return false;
  return now - seen >= WELCOME_ABSENCE_MS && (greeted === 0 || now - greeted >= GREETING_COOLDOWN_MS);
}

// src/companion-memory.js
function createCompanionMemory({ store, species, pet, now = Date.now }) {
  let present = false, disposed = false, lastCheckpoint = 0;
  function flush() {
    if (disposed) return;
    const events = pet.drainMemory();
    if (!events.length) return;
    const at = now(), patch = {};
    for (const event of events) {
      if (event.type === "favorite") patch.favoriteSpot = event.spot;
      if (event.type === "interaction") {
        patch.lastInteraction = { kind: event.kind, at };
        if (event.kind === "greeting") patch.lastGreetingAt = at;
      }
    }
    if (present) patch.lastSeenAt = at;
    store.remember(species, patch);
  }
  function setPresent(value) {
    if (disposed || value === present) return;
    const at = now();
    if (value) {
      const memory = store.getMemory(species);
      if (shouldGreet(memory, at) && pet.welcomeBack()) {
        store.remember(species, { lastGreetingAt: at });
      }
    } else flush();
    present = value;
    lastCheckpoint = at;
    store.remember(species, { lastSeenAt: at });
    flush();
  }
  function checkpoint() {
    if (disposed || !present) return;
    const at = now();
    if (at < lastCheckpoint || at - lastCheckpoint >= 3e4) {
      lastCheckpoint = at;
      store.remember(species, { lastSeenAt: at });
    }
  }
  return {
    setPresent,
    flush,
    checkpoint,
    dispose() {
      if (disposed) return;
      flush();
      if (present) store.remember(species, { lastSeenAt: now() });
      present = false;
      disposed = true;
    }
  };
}

// src/App.jsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var SPOT_NAMES = { shade: "Under the old tree", sun: "The sunny patch", bank: "Beside the pond", flowers: "By the flowers", meadow: "The quiet meadow" };
var MOMENT_NAMES = { pet: "A little affection", ball: "A game of fetch", berry: "A berry shared", call: "Coming over to see you", greeting: "A welcome-back hello" };
function MemoryNote({ memory }) {
  const moment = memory.lastInteraction;
  return /* @__PURE__ */ jsxs("div", { className: "hp-memories", "aria-label": "Little things remembered", children: [
    /* @__PURE__ */ jsx("span", { className: "hp-eyebrow", children: "LITTLE THINGS REMEMBERED" }),
    /* @__PURE__ */ jsxs("dl", { children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("dt", { children: "Favorite nap spot" }),
        /* @__PURE__ */ jsx("dd", { children: SPOT_NAMES[memory.favoriteSpot] || "Still finding a favorite" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("dt", { children: "Last time together" }),
        /* @__PURE__ */ jsxs("dd", { children: [
          moment ? MOMENT_NAMES[moment.kind] : "Our story is just starting",
          moment && /* @__PURE__ */ jsx("time", { dateTime: new Date(moment.at).toISOString(), children: new Intl.DateTimeFormat(void 0, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(moment.at) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("p", { children: "A familiar place and a few shared moments. No chores to keep up with." })
  ] });
}
function Icon({ name, size = 18 }) {
  const paths = {
    leaf: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M19 4C10 2 3 8 6 14s12 2 13-10Z" }),
      /* @__PURE__ */ jsx("path", { d: "m4 20 10-11" })
    ] }),
    heart: /* @__PURE__ */ jsx("path", { d: "M20 5c-3-3-6-1-8 1C9 2 3 3 3 8c0 5 9 11 9 11s9-6 9-11c0-1 0-2-1-3Z" }),
    ball: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "8" }),
      /* @__PURE__ */ jsx("path", { d: "M4 12h5m6 0h5" }),
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" })
    ] }),
    berry: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "14", r: "6.5" }),
      /* @__PURE__ */ jsx("path", { d: "M12 7.5c0-2 1-3.5 3-4.5M12 7.5C10 5 7.5 4.5 6 5c.5 2 2.5 3 6 2.5" })
    ] }),
    settings: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M4 7h16M4 17h16" }),
      /* @__PURE__ */ jsx("circle", { cx: "9", cy: "7", r: "3" }),
      /* @__PURE__ */ jsx("circle", { cx: "16", cy: "17", r: "3" })
    ] }),
    arrow: /* @__PURE__ */ jsx("path", { d: "m9 5 7 7-7 7M4 12h12" }),
    close: /* @__PURE__ */ jsx("path", { d: "m6 6 12 12M6 18 18 6" }),
    reset: /* @__PURE__ */ jsx("path", { d: "M4 9a8 8 0 1 1 0 6M4 3v6h6" })
  };
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: paths[name] || paths.leaf
    }
  );
}
function useSignal(value) {
  return useSyncExternalStore(value.subscribe, value.get, value.get);
}
function useReduced(record, ctx) {
  const [system, setSystem] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystem(media.matches);
    media.addEventListener("change", update);
    const cleanup = () => media.removeEventListener("change", update);
    ctx.runtimes.add(cleanup);
    return () => {
      cleanup();
      ctx.runtimes.delete(cleanup);
    };
  }, [ctx]);
  return record.motion === "reduced" || system;
}
function SpritePreview({ species, ctx, bridge, reduced, selected }) {
  const ref = useRef(), motion = useRef(reduced), chosen = useRef(selected);
  motion.current = reduced;
  chosen.current = selected;
  const [error, setError] = useState("");
  useEffect(
    () => mountCanvas({
      canvas: ref.current,
      species,
      ctx,
      bridge,
      reduced: () => motion.current,
      selected: () => chosen.current,
      onError: setError
    }).dispose,
    [species, ctx, bridge]
  );
  return error ? /* @__PURE__ */ jsx("span", { children: "Preview unavailable" }) : /* @__PURE__ */ jsx("canvas", { ref, className: "hp-preview", width: "100", height: "88", "aria-hidden": "true" });
}
function Choice({ record, save, ctx, bridge, reduced, onCancel }) {
  const [selected, setSelected] = useState(record.species || "bulbasaur");
  const [name, setName] = useState(record.nickname || "");
  return /* @__PURE__ */ jsxs(
    "form",
    {
      className: "hp-choice",
      onSubmit: (e) => {
        e.preventDefault();
        save({ species: selected, nickname: name });
        onCancel?.();
      },
      children: [
        /* @__PURE__ */ jsxs("div", { className: "hp-intro", children: [
          /* @__PURE__ */ jsx("span", { className: "hp-eyebrow", children: "A LITTLE COMPANY" }),
          /* @__PURE__ */ jsxs("h2", { children: [
            "Every day is better",
            /* @__PURE__ */ jsx("br", {}),
            "with a friend."
          ] }),
          /* @__PURE__ */ jsxs("p", { children: [
            "Pick a companion. Make a little room",
            /* @__PURE__ */ jsx("br", {}),
            "for a little adventure."
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "hp-starters", role: "group", "aria-label": "Choose your starter", children: Object.entries(SPECIES).map(([id, s]) => /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: `hp-card hp-${id}`,
            "aria-pressed": selected === id,
            onClick: () => {
              setSelected(id);
              if (selected !== id) setName("");
            },
            children: [
              /* @__PURE__ */ jsxs("span", { className: "hp-number", children: [
                "No. ",
                s.number
              ] }),
              /* @__PURE__ */ jsx("span", { className: "hp-choice-dot" }),
              /* @__PURE__ */ jsx(SpritePreview, { species: id, ctx, bridge, reduced, selected: selected === id }),
              /* @__PURE__ */ jsx("strong", { children: s.name }),
              /* @__PURE__ */ jsx("span", { className: "hp-type", children: s.type })
            ]
          },
          id
        )) }),
        /* @__PURE__ */ jsxs("p", { className: "hp-trait", children: [
          SPECIES[selected].trait,
          /* @__PURE__ */ jsx("span", { children: SPECIES[selected].detail })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "hp-label", htmlFor: "hp-nickname", children: [
          "A name for your new friend ",
          /* @__PURE__ */ jsx("span", { children: "optional" })
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            id: "hp-nickname",
            value: name,
            maxLength: 24,
            autoComplete: "off",
            placeholder: SPECIES[selected].name,
            onChange: (e) => setName(e.target.value)
          }
        ),
        /* @__PURE__ */ jsxs("button", { className: "hp-primary", type: "submit", children: [
          record.species ? "Welcome to the garden" : "Meet your companion",
          /* @__PURE__ */ jsx(Icon, { name: "arrow", size: 17 })
        ] }),
        onCancel && /* @__PURE__ */ jsx("button", { className: "hp-text-button", type: "button", onClick: onCancel, children: "Keep my current companion" }),
        /* @__PURE__ */ jsx("p", { className: "hp-fine", children: "One small garden. A friend to share it with." })
      ]
    }
  );
}
function Settings({ record, store, onClose, onChange, pet }) {
  const [name, setName] = useState(record.nickname);
  const first = useRef();
  useEffect(() => first.current?.focus(), []);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "hp-settings",
      role: "region",
      "aria-label": "Companion settings",
      onKeyDown: (e) => {
        if (e.key === "Escape") onClose();
      },
      children: [
        /* @__PURE__ */ jsxs("div", { className: "hp-section-title", children: [
          /* @__PURE__ */ jsx("h3", { children: "A little housekeeping" }),
          /* @__PURE__ */ jsx("button", { className: "hp-icon-button", "aria-label": "Close settings", onClick: onClose, children: /* @__PURE__ */ jsx(Icon, { name: "close" }) })
        ] }),
        /* @__PURE__ */ jsxs(
          "form",
          {
            onSubmit: (e) => {
              e.preventDefault();
              store.update({ nickname: name });
              onClose();
            },
            children: [
              /* @__PURE__ */ jsx("label", { className: "hp-label", htmlFor: "hp-rename", children: "Nickname" }),
              /* @__PURE__ */ jsxs("div", { className: "hp-input-row", children: [
                /* @__PURE__ */ jsx("input", { ref: first, id: "hp-rename", maxLength: 24, value: name, onChange: (e) => setName(e.target.value) }),
                /* @__PURE__ */ jsx("button", { type: "submit", className: "hp-small-primary", children: "Save" })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "hp-sky", children: [
          /* @__PURE__ */ jsx("span", { className: "hp-label", children: "Garden light" }),
          /* @__PURE__ */ jsx("div", { className: "hp-segmented", role: "radiogroup", "aria-label": "Garden light", children: SKIES.map((sky) => /* @__PURE__ */ jsx("button", { type: "button", role: "radio", "aria-checked": record.sky === sky, onClick: () => store.update({ sky }), children: sky === "auto" ? "Clock" : sky[0].toUpperCase() + sky.slice(1) }, sky)) }),
          /* @__PURE__ */ jsx("small", { children: "Clock follows your local time \u2014 dawn, day, dusk and a starry night." })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "hp-motion", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "checkbox",
              checked: record.motion === "reduced",
              onChange: (e) => store.update({ motion: e.target.checked ? "reduced" : "system" })
            }
          ),
          /* @__PURE__ */ jsxs("span", { children: [
            "Extra quiet mode",
            /* @__PURE__ */ jsx("small", { children: "Still sprites and gentler play. Your system\u2019s reduced-motion preference is always respected." })
          ] })
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            className: "hp-setting-action",
            onClick: () => {
              pet.reset();
              onClose();
            },
            children: [
              /* @__PURE__ */ jsx(Icon, { name: "reset" }),
              "Reset position"
            ]
          }
        ),
        /* @__PURE__ */ jsxs("button", { className: "hp-setting-action", onClick: onChange, children: [
          /* @__PURE__ */ jsx(Icon, { name: "leaf" }),
          "Change starter",
          /* @__PURE__ */ jsx(Icon, { name: "arrow", size: 15 })
        ] }),
        /* @__PURE__ */ jsx(MemoryNote, { memory: store.getMemory(record.species) }),
        /* @__PURE__ */ jsxs("p", { className: "hp-fine", children: [
          "Sprites: CHUNSOFT via SpriteCollab.",
          /* @__PURE__ */ jsx("br", {}),
          "Pok\xE9mon \xA9 Nintendo / Creatures / GAME FREAK.",
          /* @__PURE__ */ jsx("br", {}),
          "Independent fan project \xB7 v",
          "0.4.0"
        ] })
      ]
    }
  );
}
function Habitat({ record, store, ctx, bridge, reduced, onChange }) {
  const canvas = useRef(), motion = useRef(reduced), sky = useRef(record.sky), runtime = useRef(), settingsButton = useRef();
  motion.current = reduced;
  sky.current = record.sky;
  const pet = useMemo(() => new Companion(record.species, Math.random, { favoriteSpot: store.getMemory(record.species).favoriteSpot }), [record.species, store]);
  const memory = useRef();
  const snapshot = () => ({ caption: pet.caption, busy: pet.busy, fetching: pet.fetching });
  const [status, setStatus] = useState(snapshot);
  const [settings, setSettings] = useState(false), [error, setError] = useState(""), [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = createCompanionMemory({ store, species: record.species, pet });
    memory.current = controller;
    runtime.current = mountCanvas({
      canvas: canvas.current,
      ctx,
      bridge,
      pet,
      species: record.species,
      reduced: () => motion.current,
      sky: () => sky.current,
      memory: controller,
      onReady: () => setReady(true),
      onError: setError,
      onStatus: () => setStatus(snapshot())
    });
    const mounted = runtime.current;
    return () => {
      mounted.dispose();
      if (memory.current === controller) memory.current = void 0;
    };
  }, [pet, record.species, ctx, bridge, store]);
  useEffect(() => {
    const debug = globalThis.__hermesPokemonDebug;
    if (debug && typeof debug === "object") debug.pet = pet;
    return () => {
      if (debug?.pet === pet) delete debug.pet;
    };
  }, [pet]);
  useEffect(() => runtime.current?.refresh(), [record.sky]);
  const closeSettings = () => {
    setSettings(false);
    settingsButton.current?.focus();
  };
  const act = (fn) => () => {
    fn();
    memory.current?.flush();
    setStatus(snapshot());
  };
  function clickGarden(event) {
    const box = canvas.current.getBoundingClientRect();
    const p = runtime.current.toWorld((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
    const bodyY = pet.swimming ? pet.y - 6 : pet.y - 10;
    if (Math.abs(p.x - pet.x) < 13 && Math.abs(p.y - bodyY) < 14) pet.pet();
    else if (onTree(p)) {
      pet.investigate(p, "tree");
      pet.emit("leaves", { x: p.x, y: p.y });
    } else if (inPond(p)) {
      pet.investigate(p, "pond");
      pet.emit("splash", { x: p.x, y: p.y + 2 });
    } else if (Math.hypot(p.x - SPOTS.flowers.x, p.y - SPOTS.flowers.y) < 10) pet.investigate(p, "flowers");
    else if (p.y > 44) pet.callTo(p);
    else pet.notice(p);
    memory.current?.flush();
    setStatus(snapshot());
  }
  const s = SPECIES[record.species];
  return /* @__PURE__ */ jsxs("div", { className: "hp-living", children: [
    /* @__PURE__ */ jsx("div", { className: "hp-scene-column", children: /* @__PURE__ */ jsxs("div", { className: "hp-stage", children: [
      /* @__PURE__ */ jsx(
        "canvas",
        {
          ref: canvas,
          width: "640",
          height: "480",
          onClick: clickGarden,
          "aria-label": `${record.nickname}, a ${s.name}, in a pixel-art garden. Click the Pok\xE9mon to pet it, the grass to call it over, or the tree, pond and flowers to explore together.`
        }
      ),
      !ready && /* @__PURE__ */ jsx("div", { className: "hp-loading", role: "status", children: error || "Opening the garden\u2026" })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "hp-companion-column", children: [
      /* @__PURE__ */ jsxs("div", { className: "hp-name-row", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { children: record.nickname }),
          /* @__PURE__ */ jsx("p", { className: "hp-status", role: "status", "aria-live": "polite", children: status.caption })
        ] }),
        /* @__PURE__ */ jsx("span", { className: `hp-badge hp-${record.species}`, children: s.type })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "hp-controls", children: [
        /* @__PURE__ */ jsxs("button", { disabled: !ready, onClick: act(() => pet.pet()), title: "Pet", "aria-label": "Pet", children: [
          /* @__PURE__ */ jsx(Icon, { name: "heart" }),
          /* @__PURE__ */ jsx("span", { children: "Pet" })
        ] }),
        /* @__PURE__ */ jsxs("button", { disabled: !ready || status.busy, onClick: act(() => pet.throwBall()), title: "Throw ball", "aria-label": "Throw ball", children: [
          /* @__PURE__ */ jsx(Icon, { name: "ball" }),
          /* @__PURE__ */ jsx("span", { children: status.fetching ? "Fetching\u2026" : "Ball" })
        ] }),
        /* @__PURE__ */ jsxs("button", { disabled: !ready || status.busy, onClick: act(() => pet.giveTreat()), title: "Give an Oran Berry", "aria-label": "Give an Oran Berry", children: [
          /* @__PURE__ */ jsx(Icon, { name: "berry" }),
          /* @__PURE__ */ jsx("span", { children: "Berry" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            ref: settingsButton,
            className: "hp-icon-button",
            "aria-label": "Companion settings",
            "aria-expanded": settings,
            onClick: () => setSettings(!settings),
            children: /* @__PURE__ */ jsx(Icon, { name: "settings" })
          }
        )
      ] }),
      settings ? /* @__PURE__ */ jsx(Settings, { record, store, pet, onClose: closeSettings, onChange }) : /* @__PURE__ */ jsxs("p", { className: "hp-hint", children: [
        /* @__PURE__ */ jsx(Icon, { name: "leaf", size: 14 }),
        /* @__PURE__ */ jsxs("span", { children: [
          s.detail,
          " Tap the garden to explore with ",
          record.nickname,
          "."
        ] })
      ] }),
      reduced && /* @__PURE__ */ jsx("p", { className: "hp-fine hp-motion-note", children: "Quiet motion is on" })
    ] })
  ] });
}
function App({ store, ctx, bridge }) {
  const { record, warning } = useSignal(store);
  const [choosing, setChoosing] = useState(false);
  const reduced = useReduced(record, ctx);
  const visible = useSignal(bridge.visible);
  return /* @__PURE__ */ jsxs("section", { className: "hp-root", "aria-label": "Hermes Pok\xE9mon", "data-visible": visible, children: [
    /* @__PURE__ */ jsxs("header", { className: "hp-header", children: [
      /* @__PURE__ */ jsx("span", { className: "hp-brand-icon", children: /* @__PURE__ */ jsx(Icon, { name: "leaf", size: 16 }) }),
      /* @__PURE__ */ jsxs("span", { children: [
        "Hermes ",
        /* @__PURE__ */ jsx("strong", { children: "Pok\xE9mon" })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "hp-version", children: [
        "v",
        "0.4.0".split(".").slice(0, 2).join(".")
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "hp-scroll", children: [
      !record.species || choosing ? /* @__PURE__ */ jsx(
        Choice,
        {
          record,
          ctx,
          bridge,
          reduced,
          save: (patch) => store.update(patch),
          onCancel: record.species ? () => setChoosing(false) : void 0
        }
      ) : /* @__PURE__ */ jsx(
        Habitat,
        {
          record,
          store,
          ctx,
          bridge,
          reduced,
          onChange: () => setChoosing(true)
        }
      ),
      warning && /* @__PURE__ */ jsx("p", { className: "hp-warning", role: "alert", children: warning })
    ] }),
    /* @__PURE__ */ jsxs("footer", { className: "hp-footer", children: [
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("i", {}),
        visible ? "A little world of your own" : "Resting while hidden"
      ] }),
      /* @__PURE__ */ jsx("span", { children: "EST. KANTO" })
    ] })
  ] });
}

// src/hermes.js
var PLUGIN_ID = "hermes-pokemon";
var PANE_ID = `${PLUGIN_ID}:habitat`;
function createHermesBridge(host2, ctx) {
  const activity = signal({ kind: "idle", sequence: 0 });
  const visible = signal(true);
  const disposers = [];
  let disposed = false, focused = null, busy = false, waitingTool = null;
  const state = host2?.state || {};
  const focusAtom = state.focusedSessionId || state.activeSessionId;
  const read = (atom) => atom?.get?.();
  function emit(kind) {
    if (!disposed)
      activity.set({ kind, sequence: activity.get().sequence + 1 });
  }
  function sync() {
    const nextFocus = read(focusAtom) || null;
    const nextBusy = nextFocus ? Boolean(
      state.busyBySession ? read(state.busyBySession)?.[nextFocus] : read(state.busy)
    ) : false;
    if (focused !== nextFocus) {
      focused = nextFocus;
      waitingTool = null;
      busy = nextBusy;
      emit(nextBusy ? "working" : "idle");
    } else if (nextBusy !== busy) {
      busy = nextBusy;
      waitingTool = null;
      emit(nextBusy ? "working" : "idle");
    }
  }
  for (const atom of [focusAtom, state.busyBySession || state.busy]) {
    if (atom?.subscribe) disposers.push(atom.subscribe(sync));
  }
  sync();
  function event(e) {
    const id = read(focusAtom);
    if (!id || e.replayed || e.session_id !== id) return;
    const profile = read(state.focusedSessionProfile);
    if (e.profile && profile && e.profile !== profile) return;
    if (e.type === "message.complete") {
      waitingTool = null;
      emit(
        e.payload?.status === "complete" && !e.payload?.error ? "completed" : "idle"
      );
    } else if (e.type === "tool.start" && e.payload?.name === "clarify") {
      waitingTool = e.payload.tool_id;
      emit("waiting");
    } else if (e.type === "tool.complete" && e.payload?.tool_id === waitingTool) {
      waitingTool = null;
      emit(busy ? "working" : "idle");
    }
  }
  if (typeof ctx.onEvent === "function") {
    for (const type of ["message.complete", "tool.start", "tool.complete"])
      disposers.push(ctx.onEvent(type, event));
  }
  if (typeof host2?.paneVisibility === "function") {
    const atom = host2.paneVisibility(PANE_ID);
    if (atom?.subscribe)
      disposers.push(atom.subscribe(() => visible.set(Boolean(atom.get()))));
    if (atom?.get) visible.set(Boolean(atom.get()));
  }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposers.splice(0).forEach((fn) => fn?.());
    activity.clear();
    visible.clear();
  };
  ctx.onDispose(dispose);
  return { activity, visible, dispose };
}

// src/styles.css
var styles_default = '.hp-root {\n  --hp-bg: var(--ui-bg-editor, #f7f7ef);\n  --hp-surface: var(--ui-bg-elevated, #fffef7);\n  --hp-text: var(--ui-text-primary, #343d34);\n  --hp-muted: var(--ui-text-tertiary, #75816f);\n  --hp-line: var(--ui-stroke-secondary, #dfe3d5);\n  --hp-accent: var(--ui-accent, #547653);\n  height: 100%;\n  width: 100%;\n  min-width: 220px;\n  display: flex;\n  flex-direction: column;\n  background: var(--hp-bg);\n  color: var(--hp-text);\n  font:\n    13px/1.5 "Segoe UI",\n    system-ui,\n    sans-serif;\n  container-type: size;\n  isolation: isolate;\n  box-sizing: border-box;\n  text-align: left;\n}\n.hp-root * {\n  box-sizing: border-box;\n}\n.hp-root button,\n.hp-root input {\n  font: inherit;\n}\n.hp-root button {\n  cursor: pointer;\n}\n.hp-root button:disabled {\n  cursor: default;\n  opacity: 0.5;\n}\n.hp-root button:focus-visible,\n.hp-root input:focus-visible {\n  outline: 2px solid var(--hp-accent);\n  outline-offset: 3px;\n}\n.hp-root button {\n  color: inherit;\n}\n.hp-root h2,\n.hp-root h3,\n.hp-root p {\n  margin: 0;\n}\n.hp-header {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 14px 18px;\n  border-bottom: 1px solid var(--hp-line);\n  font-size: 12px;\n  flex-shrink: 0;\n  letter-spacing: -0.15px;\n}\n.hp-brand-icon {\n  display: grid;\n  place-items: center;\n  color: var(--hp-accent);\n}\n.hp-header strong {\n  font-weight: 600;\n}\n.hp-version {\n  margin-left: auto;\n  color: var(--hp-muted);\n  font: 10px monospace;\n  border: 1px solid var(--hp-line);\n  border-radius: 4px;\n  padding: 1px 5px;\n}\n.hp-scroll {\n  overflow: auto;\n  flex: 1;\n  min-height: 0;\n  scrollbar-width: thin;\n}\n.hp-footer {\n  display: flex;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 12px 18px;\n  border-top: 1px solid var(--hp-line);\n  color: var(--hp-muted);\n  font-size: 10px;\n  flex-shrink: 0;\n}\n.hp-footer > span:first-child {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n.hp-footer > span:last-child {\n  font: 8px/15px monospace;\n  letter-spacing: 1px;\n}\n.hp-footer i,\n.hp-garden-label i {\n  display: inline-block;\n  width: 5px;\n  height: 5px;\n  border-radius: 50%;\n  background: var(--hp-accent);\n}\n.hp-choice {\n  padding: 26px 18px 15px;\n}\n.hp-intro {\n  text-align: center;\n  margin-bottom: 24px;\n}\n.hp-eyebrow {\n  font: 9px/1.5 monospace;\n  letter-spacing: 1.7px;\n  color: var(--hp-muted);\n}\n.hp-intro h2 {\n  font:\n    500 27px/1.2 Georgia,\n    serif;\n  letter-spacing: -0.8px;\n  margin: 12px 0;\n}\n.hp-intro p {\n  color: var(--hp-muted);\n  font-size: 12px;\n  line-height: 1.65;\n}\n.hp-starters {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 7px;\n}\n.hp-card {\n  position: relative;\n  border: 1px solid var(--hp-line);\n  border-radius: 10px;\n  background: var(--hp-surface);\n  padding: 12px 4px 10px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  min-width: 0;\n  transition:\n    border-color 0.15s,\n    background 0.15s;\n}\n.hp-card[aria-pressed="true"] {\n  border-color: var(--hp-accent);\n  background: color-mix(in srgb, var(--hp-accent) 9%, var(--hp-surface));\n  box-shadow: 0 0 0 1px var(--hp-accent);\n}\n.hp-number {\n  align-self: flex-start;\n  color: var(--hp-muted);\n  font: 8px monospace;\n  margin-left: 6px;\n}\n.hp-choice-dot {\n  position: absolute;\n  right: 8px;\n  top: 12px;\n  width: 5px;\n  height: 5px;\n  border-radius: 50%;\n  background: var(--hp-line);\n}\n.hp-card[aria-pressed="true"] .hp-choice-dot {\n  background: var(--hp-accent);\n}\n.hp-preview {\n  width: 100%;\n  height: 85px;\n  image-rendering: pixelated;\n}\n.hp-card strong {\n  font-size: 11px;\n  letter-spacing: -0.3px;\n}\n.hp-type {\n  font-size: 9px;\n  margin-top: 3px;\n  color: var(--hp-muted);\n}\n.hp-trait {\n  text-align: center;\n  font-size: 12px !important;\n  padding: 17px 0 21px;\n}\n.hp-trait span {\n  display: block;\n  font-size: 10px;\n  color: var(--hp-muted);\n  margin-top: 4px;\n}\n.hp-label {\n  display: flex;\n  justify-content: space-between;\n  font-size: 11px;\n  margin-bottom: 8px;\n}\n.hp-label span {\n  color: var(--hp-muted);\n  font-size: 10px;\n}\n.hp-root input:not([type="checkbox"]) {\n  width: 100%;\n  border: 1px solid var(--hp-line);\n  border-radius: 7px;\n  background: var(--hp-surface);\n  color: var(--hp-text);\n  padding: 10px 12px;\n  min-width: 0;\n}\n.hp-root input::placeholder {\n  color: var(--hp-muted);\n}\n.hp-primary {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 13px;\n  width: 100%;\n  border: 0;\n  border-radius: 7px;\n  background: var(--hp-accent);\n  color: var(--dt-midground-foreground, #fffef4) !important;\n  padding: 12px;\n  margin-top: 12px;\n  font-weight: 600 !important;\n  font-size: 12px !important;\n}\n.hp-primary:hover,\n.hp-small-primary:hover {\n  filter: brightness(1.08);\n}\n.hp-fine {\n  font-size: 9px !important;\n  line-height: 1.7;\n  color: var(--hp-muted);\n  text-align: center;\n  margin-top: 18px !important;\n}\n.hp-text-button {\n  background: none;\n  border: 0;\n  display: block;\n  margin: 13px auto 0;\n  font-size: 11px !important;\n  color: var(--hp-muted) !important;\n  text-decoration: underline;\n  text-underline-offset: 3px;\n}\n.hp-living {\n  padding: 18px;\n}\n.hp-garden-label {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 12px;\n  color: var(--hp-muted);\n  font-size: 10px;\n}\n.hp-garden-label > span:first-child {\n  display: flex;\n  gap: 6px;\n  align-items: center;\n  font: 9px monospace;\n  letter-spacing: 1.1px;\n}\n.hp-garden-label > span:last-child {\n  font-family: Georgia, serif;\n  font-style: italic;\n  font-size: 12px;\n}\n.hp-stage {\n  width: 100%;\n  aspect-ratio: 4/3;\n  position: relative;\n  border-radius: 10px;\n  overflow: hidden;\n  border: 1px solid color-mix(in srgb, var(--hp-accent) 25%, transparent);\n  background: var(--hp-surface);\n}\n.hp-stage canvas {\n  display: block;\n  width: 100%;\n  height: 100%;\n  image-rendering: pixelated;\n  cursor: pointer;\n  color: var(--hp-text);\n}\n.hp-loading {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  background: var(--hp-surface);\n  font-size: 12px;\n  padding: 20px;\n  text-align: center;\n}\n.hp-scene-foot {\n  display: flex;\n  justify-content: space-between;\n  padding-top: 8px;\n  font: 7px monospace;\n  letter-spacing: 1.25px;\n  color: var(--hp-muted);\n}\n.hp-companion-column {\n  padding-top: 23px;\n}\n.hp-name-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n.hp-name-row > div {\n  min-width: 0;\n}\n.hp-name-row h2 {\n  font:\n    500 27px/1.3 Georgia,\n    serif;\n  margin-top: 4px;\n  overflow-wrap: anywhere;\n  letter-spacing: -0.5px;\n}\n.hp-badge {\n  border: 1px solid var(--hp-line);\n  padding: 4px 9px;\n  border-radius: 20px;\n  font-size: 10px;\n  background: color-mix(in srgb, var(--hp-accent) 7%, var(--hp-surface));\n}\n.hp-status {\n  font-size: 12px;\n  color: var(--hp-muted);\n  margin-top: 5px !important;\n  min-height: 36px;\n}\n.hp-controls {\n  display: flex;\n  gap: 8px;\n  margin-top: 12px;\n}\n.hp-controls > button {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  border: 1px solid var(--hp-line);\n  border-radius: 7px;\n  background: var(--hp-surface);\n  padding: 10px;\n  white-space: nowrap;\n  font-size: 12px;\n  flex: 1;\n}\n.hp-controls > button:hover:not(:disabled) {\n  border-color: var(--hp-accent);\n  background: color-mix(in srgb, var(--hp-accent) 6%, var(--hp-surface));\n}\n.hp-icon-button {\n  background: none;\n  border: 0;\n  display: grid;\n  place-items: center;\n  padding: 6px;\n  flex: 0 0 39px !important;\n}\n.hp-note {\n  border-top: 1px solid var(--hp-line);\n  margin-top: 22px;\n  padding-top: 17px;\n  display: flex;\n  gap: 10px;\n  align-items: center;\n  color: var(--hp-muted);\n}\n.hp-note p {\n  font-size: 11px;\n}\n.hp-note small {\n  display: block;\n  font-size: 10px;\n  margin-top: 3px;\n  opacity: 0.8;\n}\n.hp-note-icon {\n  display: flex;\n  opacity: 0.8;\n}\n.hp-settings {\n  margin-top: 18px;\n  border-top: 1px solid var(--hp-line);\n  padding-top: 13px;\n}\n.hp-section-title {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-bottom: 10px;\n}\n.hp-section-title h3 {\n  font-size: 12px;\n  font-weight: 500;\n}\n.hp-input-row {\n  display: flex;\n  gap: 7px;\n}\n.hp-small-primary {\n  border: 0;\n  background: var(--hp-accent);\n  color: var(--dt-midground-foreground, #fffef4) !important;\n  border-radius: 7px;\n  padding: 0 12px;\n  font-size: 11px !important;\n}\n.hp-motion {\n  display: flex;\n  align-items: flex-start;\n  gap: 9px;\n  margin: 17px 0;\n  font-size: 11px;\n}\n.hp-motion input {\n  accent-color: var(--hp-accent);\n  margin: 2px 0;\n}\n.hp-motion small {\n  display: block;\n  color: var(--hp-muted);\n  font-size: 10px;\n  line-height: 1.6;\n  margin-top: 4px;\n}\n.hp-setting-action {\n  display: flex;\n  align-items: center;\n  gap: 9px;\n  width: 100%;\n  padding: 10px 0;\n  border: 0;\n  border-top: 1px solid var(--hp-line);\n  background: none;\n  text-align: left;\n  font-size: 11px !important;\n}\n.hp-setting-action svg:last-child:not(:first-child) {\n  margin-left: auto;\n}\n.hp-warning {\n  padding: 10px 18px;\n  font-size: 11px;\n  color: var(--hp-text);\n}\n.hp-motion-note {\n  margin-top: 12px !important;\n}\n.hp-status-dot {\n  margin-left: 1px;\n}\n@container (max-width:290px) {\n  .hp-choice,\n  .hp-living {\n    padding: 15px 12px;\n  }\n  .hp-card strong {\n    font-size: 9px;\n  }\n  .hp-preview {\n    height: 72px;\n  }\n  .hp-starters {\n    gap: 5px;\n  }\n  .hp-card {\n    padding-top: 9px;\n  }\n  .hp-number {\n    font-size: 7px;\n  }\n  .hp-controls > button {\n    gap: 5px;\n    padding: 9px 7px;\n    font-size: 11px;\n  }\n  .hp-footer > span:last-child {\n    display: none;\n  }\n  .hp-intro h2 {\n    font-size: 25px;\n  }\n}\n@container (min-width:560px) and (max-height:430px) {\n  .hp-living {\n    display: grid;\n    grid-template-columns: minmax(220px, 1fr) minmax(200px, 0.85fr);\n    gap: 24px;\n    max-width: 850px;\n    margin: auto;\n  }\n  .hp-companion-column {\n    padding-top: 18px;\n  }\n  .hp-note {\n    margin-top: 15px;\n  }\n  .hp-stage {\n    max-width: 360px;\n  }\n  .hp-choice {\n    max-width: 550px;\n    margin: auto;\n  }\n  .hp-intro {\n    margin-bottom: 15px;\n  }\n  .hp-intro h2 {\n    font-size: 23px;\n  }\n  .hp-intro br {\n    display: none;\n  }\n  .hp-starters {\n    max-width: 350px;\n    margin: auto;\n  }\n}\n@media (prefers-color-scheme: dark) {\n  .hp-root {\n    --hp-bg: var(--ui-bg-editor, #202820);\n    --hp-surface: var(--ui-bg-elevated, #283128);\n    --hp-text: var(--ui-text-primary, #e0e4d5);\n    --hp-muted: var(--ui-text-tertiary, #a0af98);\n    --hp-line: var(--ui-stroke-secondary, #3c4939);\n    --hp-accent: var(--ui-accent, #8aa77c);\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .hp-root * {\n    transition: none !important;\n    animation: none !important;\n  }\n}\n/* Keep the initial choice and primary controls within a compact dock. */\n.hp-choice {\n  padding-top: 20px;\n}\n.hp-intro {\n  margin-bottom: 18px;\n}\n.hp-preview {\n  height: 76px;\n}\n.hp-trait {\n  padding: 13px 0 15px;\n}\n.hp-companion-column {\n  padding-top: 18px;\n}\n.hp-status {\n  min-height: 28px;\n}\n.hp-controls {\n  margin-top: 8px;\n}\n.hp-note {\n  margin-top: 16px;\n  padding-top: 12px;\n}\n.hp-note {\n  margin-top: 12px;\n  padding-top: 10px;\n}\n.hp-companion-column {\n  padding-top: 14px;\n}\n@container (min-width:560px) and (max-height:430px) {\n  .hp-scene-column {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n  }\n  .hp-garden-label,\n  .hp-scene-foot {\n    align-self: stretch;\n  }\n  .hp-stage {\n    width: min(100%, calc((100cqh - 165px) * 4 / 3));\n    min-width: 160px;\n    max-width: 360px;\n  }\n  .hp-companion-column {\n    padding-top: 8px;\n  }\n}\n@container (min-width:560px) and (max-height:300px) {\n  .hp-note,\n  .hp-scene-foot {\n    display: none;\n  }\n  .hp-living {\n    padding: 12px 18px;\n  }\n  .hp-companion-column {\n    padding-top: 0;\n  }\n  .hp-stage {\n    width: min(100%, calc((100cqh - 140px) * 4 / 3));\n  }\n}\n@container (min-width:560px) and (max-height:300px) {\n  .hp-stage {\n    min-width: 152px;\n  }\n}\n\n/* v0.2 \u2014 roomier garden, four compact controls, sky picker. */\n.hp-living {\n  padding: 12px;\n}\n.hp-stage {\n  border-radius: 8px;\n  background: #88c36b;\n  box-shadow: 0 1px 0 color-mix(in srgb, var(--hp-text) 8%, transparent);\n}\n.hp-companion-column {\n  padding-top: 12px;\n}\n.hp-name-row {\n  align-items: flex-start;\n}\n.hp-name-row h2 {\n  font-size: 22px;\n  margin-top: 0;\n  line-height: 1.2;\n}\n.hp-status {\n  min-height: 0;\n  margin-top: 2px !important;\n}\n.hp-controls {\n  gap: 6px;\n  margin-top: 10px;\n}\n.hp-controls > button {\n  padding: 8px 6px;\n  gap: 6px;\n  min-width: 0;\n}\n.hp-controls > button > span {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.hp-controls > button:active:not(:disabled) {\n  transform: translateY(1px);\n}\n.hp-hint {\n  display: flex;\n  gap: 8px;\n  align-items: flex-start;\n  margin-top: 12px !important;\n  font-size: 11px;\n  color: var(--hp-muted);\n  line-height: 1.5;\n}\n.hp-hint svg {\n  flex-shrink: 0;\n  margin-top: 2px;\n}\n.hp-sky {\n  margin-top: 16px;\n}\n.hp-sky small {\n  display: block;\n  color: var(--hp-muted);\n  font-size: 10px;\n  margin-top: 6px;\n}\n.hp-segmented {\n  display: flex;\n  margin-top: 6px;\n  border: 1px solid var(--hp-line);\n  border-radius: 7px;\n  overflow: hidden;\n}\n.hp-segmented button {\n  flex: 1;\n  border: 0;\n  background: var(--hp-surface);\n  padding: 6px 2px;\n  font-size: 10.5px !important;\n  min-width: 0;\n}\n.hp-segmented button + button {\n  border-left: 1px solid var(--hp-line);\n}\n.hp-segmented button[aria-checked="true"] {\n  background: var(--hp-accent);\n  color: var(--dt-midground-foreground, #fffef4);\n}\n@container (max-width: 330px) {\n  .hp-controls > button > span {\n    display: none;\n  }\n}\n@container (max-width: 290px) {\n  .hp-living {\n    padding: 10px;\n  }\n}\n.hp-preview {\n  object-fit: contain;\n  image-rendering: pixelated;\n}\n.hp-memories { margin-top: 12px; padding: 14px 0 0; border-top: 1px solid var(--hp-line); }\n.hp-memories dl { margin: 10px 0; display: grid; gap: 10px; font-size: 11px; }\n.hp-memories dl > div { display: grid; grid-template-columns: 1fr 1.3fr; gap: 12px; }\n.hp-memories dt { color: var(--hp-muted); }\n.hp-memories dd { margin: 0; text-align: right; }\n.hp-memories time { display: block; color: var(--hp-muted); font-size: 9px; margin-top: 3px; }\n.hp-memories p { font-size: 10px; line-height: 1.6; color: var(--hp-muted); }\n';

// src/plugin.jsx
import { jsx as jsx2 } from "react/jsx-runtime";
var plugin_default = {
  id: PLUGIN_ID,
  name: "Hermes Pok\xE9mon",
  defaultEnabled: true,
  register(ctx) {
    const style = document.createElement("style");
    style.dataset.hermesPokemon = "0.4.0";
    style.textContent = styles_default;
    document.head.append(style);
    ctx.onDispose(() => style.remove());
    const store = createPersistence(ctx.storage);
    const bridge = createHermesBridge(sdk.host, ctx);
    const runtime = { runtimes: /* @__PURE__ */ new Set() };
    ctx.onDispose(() => {
      runtime.runtimes.forEach((dispose) => dispose());
      runtime.runtimes.clear();
      store.clear();
    });
    ctx.register({
      id: "habitat",
      area: sdk.PANES_AREA,
      title: "Hermes Pok\xE9mon",
      data: {
        placement: "right",
        dock: { pane: "workspace", pos: "right" },
        width: "370px",
        height: "330px"
      },
      render: () => /* @__PURE__ */ jsx2(App, { store, ctx: runtime, bridge })
    });
  }
};
export {
  plugin_default as default
};
