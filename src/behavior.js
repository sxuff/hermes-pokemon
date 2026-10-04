import { FORMS, SPECIES } from "./species.js";
import { animMeta } from "./anim-meta.generated.js";
import { HOME, POND, SPOTS, TREE, directionTo, findPath, inPond, nearestWalkable, walkable } from "./world.js";

// Pure pet logic: no DOM, no drawing. A Companion is a small explicit state machine whose
// states are driven by short plans (walk → turn → act). Interrupts replace the plan.
// Visual side effects (hearts, splashes…) are queued as events for the renderer.

const TICKS = 60; // SpriteCollab durations are in 1/60 s.
const ACCEL = 80; // px/s²
export const START = HOME;
export const CAPTIONS = {
  idle: "Taking it all in",
  walking: "Exploring the garden",
  coming: "Coming over!",
  resting: "Watching the leaves drift",
  basking: "Soaking up the sunshine",
  watching: "Watching the ripples",
  swimming: "Paddling around the pond",
  sniffing: "Smelling the flowers",
  sleeping: "A very important little nap",
  waking: "Waking up slowly…",
  playing: "Having a lovely time",
  petting: "That hit the spot!",
  attentive: "Keeping you company while Hermes works",
  celebrating: "A little cheer for a finished turn",
  waiting: "Hermes has a question for you",
  chasing: "On a very important mission",
  returning: "Bringing it back!",
  presenting: "Brought it back. Again?",
  anticipating: "Is that a berry for me?",
  eating: "Munch, munch…",
  greeting: "There you are!",
  noticing: "You have my attention",
  tending: "Giving the flowers a little care",
  warming: "Warming those tiny paws",
  rippling: "One little ripple, then another",
  inviting: "Brought a ball. Want to play?",
  investigating: "Taking a closer look with you",
  evolving: "Ready for a new chapter",
};
const FETCH = new Set(["chasing", "returning", "presenting"]);

export class Companion {
  constructor(species, random = Math.random, options = {}) {
    this.species = species;
    this.form = Object.hasOwn(FORMS, options.form) && FORMS[options.form].lineage === species ? options.form : species;
    this.random = random;
    this.reduced = false;
    this.time = 0;
    this.lastPet = -Infinity;
    this.lastAttention = 0;
    this.nextInvitationAt = 60 + this.random() * 30;
    this.affection = 0;
    this.events = [];
    this.memoryEvents = [];
    this.evolutionEvents = [];
    this.favoriteSpot = Object.hasOwn(SPOTS, options.favoriteSpot) ? options.favoriteSpot : null;
    this.reset();
    if (this.favoriteSpot) Object.assign(this, SPOTS[this.favoriteSpot]);
    const position = options.position;
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y) && walkable(position)) {
      Object.assign(this, { x: position.x, y: position.y });
    }
  }
  reset() {
    Object.assign(this, { x: HOME.x, y: HOME.y, dir: 0, speed: 0, path: [], plan: [], step: null });
    Object.assign(this, { ball: null, treat: null, bubble: null, swimming: false, state: "idle" });
    this.invitationActive = false;
    this.investigationTarget = null;
    this.lastAttention = this.time;
    // Resetting position must never let an invitation bypass its existing cooldown.
    this.nextInvitationAt = Math.max(this.nextInvitationAt, this.time + 45);
    this.cancelGreeting();
    this.cancelEvolution();
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
    return this.fetching || Boolean(this.treat) || this.evolving;
  }
  get evolving() {
    return Boolean(this.evolutionActive);
  }
  get canEvolve() {
    return FORMS[this.form].stage < 2 && !this.busy && !this.swimming && !this.greetingActive && !this.pendingGreeting &&
      !this.inviting && !this.asleep && !this.evolutionEvents.length && !["waking", "swimming", "petting", "investigating", "eating"].includes(this.state);
  }
  get caption() {
    return CAPTIONS[this.state] || CAPTIONS.idle;
  }
  get asleep() {
    return this.state === "sleeping";
  }
  animLength(name, rate = 1) {
    const anim = animMeta[this.form].anims[name];
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
  drainEvolution() {
    return this.evolutionEvents.splice(0);
  }
  remember(kind, point = this) {
    this.lastAttention = this.time;
    this.memoryEvents.push({ type: "interaction", kind });
    // Learn from the user's attention, never from autonomous visits or passing through.
    if (["pet", "berry", "call"].includes(kind)) {
      const nearest = Object.entries(SPOTS)
        .map(([spot, p]) => ({ spot, distance: Math.hypot(p.x - point.x, p.y - point.y) }))
        .sort((a, b) => a.distance - b.distance)[0];
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
        // Reduced motion: arrive without travel animation.
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
      if (s.dir !== undefined) this.dir = s.dir;
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
      plan =
        r < 0.25
          ? this.napPlan(false)
          : [{ kind: "pose", anim: "Idle", duration: 5 + this.random() * 4, state: "idle" }];
    } else if (r < 0.3) plan = this.favoritePlan();
    else if (r < 0.42) plan = this.signaturePlan();
    else if (r < 0.62) plan = this.wanderPlan();
    else if (r < 0.74) plan = this.napPlan(true);
    else if (r < 0.87) plan = this.playPlan();
    else plan = this.sniffPlan();
    if (!plan.length) plan = [{ kind: "pose", anim: "Idle", duration: 2, state: "idle" }];
    // Every outing ends with a short idle so behaviors breathe instead of chaining instantly.
    plan.push({ kind: "pose", anim: "Idle", duration: 1.5 + this.random() * 2.5, look: true, state: "idle" });
    this.start(plan);
  }
  wanderPlan() {
    let to = null;
    for (let i = 0; i < 12 && !to; i++) {
      const p = { x: 14 + Math.floor(this.random() * 132), y: 50 + Math.floor(this.random() * 60) };
      if (walkable(p) && Math.hypot(p.x - this.x, p.y - this.y) > 24) to = p;
    }
    return to
      ? [
          { kind: "walk", to, state: "walking" },
          { kind: "pose", anim: "Idle", duration: 2 + this.random() * 3, look: true, state: "idle" },
        ]
      : [];
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
        { kind: "turn", dir: 0 },
      ];
    }
    if (this.species === "charmander") {
      return [
        go,
        { kind: "turn", dir: 0 },
        { kind: "pose", anim: "DeepBreath", once: true, state: "basking" },
        { kind: "call", fn: () => this.emit("embers") },
        { kind: "pose", anim: "Laying", dir: 7, duration: 6 + this.random() * 5, state: "basking" },
        { kind: "pose", anim: "Wake", once: true, dir: 0, state: "basking" },
      ];
    }
    const plan = [
      go,
      { kind: "turn", dir: 4 },
      { kind: "pose", anim: "Sit", duration: 3 + this.random() * 3, state: "watching" },
    ];
    if (this.random() < 0.6) plan.push(...this.swimPlan(spot));
    return plan;
  }
  swimPlan(bank) {
    const entry = { x: bank.x, y: POND.y + POND.ry - 4 };
    const legs = [];
    for (let i = 0; i < 2 + Math.floor(this.random() * 2); i++) {
      let p;
      do p = { x: POND.x + (this.random() * 2 - 1) * (POND.rx - 8), y: POND.y + (this.random() * 2 - 1) * (POND.ry - 5) };
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
        },
      },
      ...legs,
      { kind: "walk", to: entry, direct: true, speed: 10, state: "swimming" },
      {
        kind: "call",
        fn() {
          this.emit("splash");
          Object.assign(this, { ...bank, swimming: false, dir: 0 });
        },
      },
      { kind: "pose", anim: "Hop", once: true, dir: 0, state: "playing" },
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
        { kind: "pose", anim: "Nod", once: true, state: "tending" },
      ];
    }
    if (this.species === "charmander") {
      return [
        { kind: "walk", to: SPOTS.sun, state: "walking" },
        { kind: "turn", dir: 0, state: "warming" },
        { kind: "call", fn: () => this.emit("warm") },
        { kind: "pose", anim: "DeepBreath", once: true, rate: 0.8, state: "warming" },
        { kind: "pose", anim: "Pose", once: true, rate: 0.6, state: "warming" },
        { kind: "pose", anim: "Sit", duration: 2.5, state: "warming" },
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
      { kind: "turn", dir: 0 },
    ];
  }
  napPlan(travel) {
    const spot = SPOTS[this.favoriteSpot || SPECIES[this.species].napSpot];
    return [
      ...(travel ? [{ kind: "walk", to: spot, state: "walking" }] : []),
      { kind: "turn", dir: 7 },
      { kind: "pose", anim: "Laying", duration: 1.2, state: "sleeping" },
      { kind: "pose", anim: "Sleep", rate: 0.5, duration: 10 + this.random() * 10, state: "sleeping" },
      ...this.wakePlan(),
    ];
  }
  wakePlan() {
    return [
      { kind: "pose", anim: "Wake", once: true, dir: 0, state: "waking" },
      { kind: "pose", anim: "DeepBreath", once: true, state: "waking" },
    ];
  }
  playPlan() {
    return [
      { kind: "call", fn: () => this.emit("butterfly") },
      { kind: "pose", anim: "Rotate", once: true, rate: 0.7, state: "playing" },
      { kind: "pose", anim: "Hop", once: true, dir: 0, state: "playing" },
      { kind: "call", fn: () => this.say("note", 1.4) },
      { kind: "pose", anim: "Rotate", once: true, rate: 0.7, state: "playing" },
      { kind: "pose", anim: "Idle", duration: 0.8, state: "playing" },
    ];
  }
  sniffPlan() {
    return [
      { kind: "walk", to: SPOTS.flowers, state: "walking" },
      { kind: "turn", dir: 0 },
      { kind: "pose", anim: "Eat", rate: 0.6, duration: 2.2, state: "sniffing" },
      { kind: "call", fn: () => this.emit("petals") },
      { kind: "pose", anim: "Nod", once: true, state: "sniffing" },
    ];
  }
  invitationPlan() {
    const gentle = this.species === "bulbasaur", playful = this.species === "squirtle";
    const near = { x: HOME.x + (gentle ? -6 : playful ? 6 : 0), y: HOME.y - 8 };
    const rollTime = gentle ? 1.2 : playful ? 0.9 : 0.7;
    return [
      { kind: "call", fn() { this.ball = { x: this.x, y: this.y, z: 22, spin: 0, phase: "carried", invitation: true }; } },
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
      ...(playful ? [{ kind: "pose", anim: "Rotate", once: true, rate: 0.85, state: "inviting" }] : []),
      { kind: "pose", anim: gentle ? "Nod" : "Hop", once: true, rate: gentle ? 0.65 : playful ? 1 : 1.25, dir: 0, state: "inviting" },
      { kind: "pose", anim: "Idle", duration: gentle ? 3.5 : 3, state: "inviting" },
      { kind: "call", fn() { this.ball = null; this.invitationActive = false; } },
      { kind: "pose", anim: "Idle", duration: 1.2, state: "idle" },
    ];
  }

  // ---- interactions ----------------------------------------------------------------------
  beginEvolution() {
    if (!this.canEvolve) return false;
    this.cancelGreeting();
    this.investigationTarget = null;
    this.lastAttention = this.time;
    this.evolutionActive = true;
    this.evolutionEndsAt = this.time + 2;
    this.speed = 0;
    this.say("sparkle", 2);
    const state = "evolving";
    this.start([
      ...(this.reduced ? [{ kind: "pose", anim: "Idle", duration: 2, state }] : [
        { kind: "pose", anim: "Nod", once: true, duration: 0.5, dir: 0, state },
        { kind: "pose", anim: "Pose", once: true, duration: 0.8, state },
        { kind: "pose", anim: "Idle", duration: 0.7, state },
      ]),
      ...this.evolutionFinish(),
    ]);
    return true;
  }
  evolutionFinish() {
    return [
      { kind: "call", fn() {
        this.evolutionActive = false;
        this.evolutionEvents = [{ x: this.x, y: this.y }];
        this.bubble = null;
      } },
      { kind: "pose", anim: "Idle", duration: 2, state: "idle" },
    ];
  }
  cancelEvolution() {
    this.evolutionEvents.length = 0;
    const active = this.evolving;
    this.evolutionActive = false;
    if (active) {
      this.bubble = null;
      this.start([{ kind: "pose", anim: "Idle", duration: 0.6, state: "idle" }]);
    }
  }
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
    if (this.evolving) return false;
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
      ...(this.reduced ? [] : [{ kind: "walk", to: HOME, speed: SPECIES[this.species].speed * 1.25, state: "greeting" }]),
      { kind: "turn", dir: 0, state: "greeting" },
      { kind: "pose", anim: "Idle", duration: 0.45, state: "greeting" },
      { kind: "call", fn: () => this.say("heart", 1.7) },
      { kind: "pose", anim: this.reduced ? "Idle" : "Hop", duration: this.reduced ? 0.4 : undefined, once: !this.reduced, state: "greeting" },
      { kind: "pose", anim: "Idle", duration: 1.2, state: "greeting" },
      { kind: "call", fn() { this.greetingActive = false; } },
      { kind: "pose", anim: "Idle", duration: 1, state: "idle" },
    ]);
  }
  pet() {
    if (this.evolving) return false;
    this.userAttention();
    if (this.time - this.lastPet < 0.6) return false;
    this.remember("pet");
    this.affection = this.time - this.lastPet < 4 ? this.affection + 1 : 1;
    this.lastPet = this.time;
    this.say("heart", 1.6);
    this.emit("hearts", { count: Math.min(4, this.affection) });
    if (this.busy || this.swimming) return true; // Hearts decorate play but never break it.
    const wake = this.asleep || this.state === "waking" ? [{ kind: "pose", anim: "Wake", once: true, dir: 0, state: "waking" }] : [];
    const happy =
      this.affection >= 3
        ? [
            { kind: "pose", anim: "Hop", once: true, state: "petting" },
            { kind: "pose", anim: "Pose", once: true, state: "petting" },
          ]
        : [{ kind: "pose", anim: "Nod", once: true, rate: 0.8, state: "petting" }];
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
    // Lands at the target, bounces twice and rolls a little further along the throw.
    const away = Math.hypot(target.x - from.x, target.y - from.y) || 1;
    const rest = nearestWalkable({ x: target.x + ((target.x - from.x) / away) * 7, y: target.y + ((target.y - from.y) / away) * 7 });
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
        },
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
        },
      },
      { kind: "pose", anim: "Pose", once: true, state: "presenting" },
      { kind: "pose", anim: "Idle", duration: this.reduced ? 0.7 : 1.2, state: "presenting" },
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
      const a = this.random() * Math.PI * 2,
        p = { x: Math.round(this.x + Math.cos(a) * 22), y: Math.round(this.y + Math.sin(a) * 14) };
      if (walkable(p) && walkable({ x: p.x, y: p.y - 4 })) spot = p;
    }
    // The berry and the spot four pixels behind it both need clear ground. HOME has
    // room for both when repeated edge/pond samples fail to find a nearby pair.
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
        },
      },
      { kind: "pose", anim: "Hop", once: true, state: "eating" },
      { kind: "pose", anim: "Idle", duration: 1, state: "eating" },
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
      { kind: "pose", anim: "Idle", duration: 3, look: true, state: "idle" },
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
      { kind: "pose", anim: "Idle", duration: 0.5, state: "idle" },
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
      { kind: "turn", dir: kind === "flowers" ? 0 : 4, state },
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
      { kind: "call", fn() { this.investigationTarget = null; } },
      { kind: "pose", anim: "Idle", duration: 0.5, state: "idle" },
    );
    this.start(plan);
    return true;
  }
  investigationGlance() {
    const point = this.investigationTarget;
    return [
      { kind: "turn", dir: directionTo(point.x - this.x, point.y - this.y), state: "investigating" },
      { kind: "pose", anim: "Idle", duration: 1.2, state: "investigating" },
      { kind: "call", fn() { this.investigationTarget = null; } },
      { kind: "pose", anim: "Idle", duration: 0.5, state: "idle" },
    ];
  }
  react(kind) {
    const bubble = { working: "dots", completed: "sparkle", waiting: "?" }[kind];
    if (!bubble) return;
    this.lastAttention = this.time;
    if (this.greetingActive || this.inviting || this.evolving) return;
    if (this.bubble?.kind === "heart" && this.bubble.until > this.time) return;
    this.say(bubble, kind === "working" ? 2.2 : 2);
    if (kind === "completed") this.emit("confetti", { y: this.y - 18 });
    // A cue may decorate play, but it never cancels a fetch, treat, pet or nap.
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
    if (value && this.evolving) {
      this.start([
        { kind: "pose", anim: "Idle", duration: Math.max(0.05, this.evolutionEndsAt - this.time), state: "evolving" },
        ...this.evolutionFinish(),
      ]);
      return;
    }
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
    dt = Math.max(0, Math.min(dt, 0.1)); // No catch-up jumps after suspension.
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
          // Glance around, but keep returning to face the viewer.
          this.dir = this.dir === 0 ? [1, 7, 2, 6][Math.floor(this.random() * 4)] : 0;
        }
      }
      if (this.elapsed >= s.duration) this.next();
    }
    if (!this.reduced) this.animClock += dt * TICKS * this.anim.rate;
  }
  move(dt, maxSpeed) {
    // Accelerate, cruise, and ease into the destination.
    let remaining = 0,
      prev = this;
    for (const p of this.path) {
      remaining += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    const braking = Math.sqrt(2 * ACCEL * remaining);
    this.speed = Math.min(maxSpeed, this.speed + ACCEL * dt, Math.max(6, braking));
    let distance = this.speed * dt;
    while (this.path.length && distance > 0) {
      const next = this.path[0],
        dx = next.x - this.x,
        dy = next.y - this.y,
        length = Math.hypot(dx, dy);
      if (length > 0.5) {
        // Turn one octant at a time so corners read as a turn, not a snap.
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
        this.x += (dx / length) * distance;
        this.y += (dy / length) * distance;
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
      const t = Math.min(1, b.t);
      b.x = b.from.x + (b.target.x - b.from.x) * t;
      b.y = b.from.y + (b.target.y - b.from.y) * t;
      b.z = (b.fromZ || 0) * (1 - t) + Math.sin(t * Math.PI) * 30;
      b.spin += dt * 14;
      if (t >= 1) Object.assign(b, { phase: "bounce", z: 0, vz: 34, t: 0 });
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
      const t = 1 - (1 - b.t) ** 2;
      b.x = b.from.x + (b.target.x - b.from.x) * t;
      b.y = b.from.y + (b.target.y - b.from.y) * t;
      b.spin += dt * 9 * (1 - b.t);
      if (b.t >= 1) b.phase = "rest";
    } else if (b && b.phase === "carried") {
      // Held up proudly over its head on the way back.
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
}
export { walkable, findPath };
