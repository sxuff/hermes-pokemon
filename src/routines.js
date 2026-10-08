import { SPECIES } from "./species.js";
import { HOME, POND, SPOTS, TREE, directionTo, inPond, nearestWalkable, walkable } from "./world.js";
import { DECOR_SLOTS } from "./keepsakes.js";
import { REWARDS } from "./milestones.js";

// Autonomous life: what the companion does on its own. Each method builds a plan; `choose`
// picks one. Mixed into Companion.prototype, so `this` is the companion.
export const routines = {
  choose() {
    if (this.pendingGreeting) return this.beginGreeting();
    if (this.pendingMilestone && !this.ball && !this.treat && !this.evolving && !this.swimming) return this.celebrateMilestone();
    if (this.breakPending && !this.ball && !this.treat && !this.evolving && !this.swimming) return this.offerBreak();
    if (this.companyPending || this.companyActive) return this.keepCompany();
    if (!this.reduced && !this.busy && !this.swimming && this.time >= this.nextInvitationAt && this.time - this.lastAttention >= 35) {
      this.invitationActive = true;
      this.nextInvitationAt = this.time + 120 + this.random() * 60;
      return this.start(this.invitationPlan());
    }
    let plan;
    // Rain, late hours and keepsakes set out in the garden add their own small habits.
    // The extra draw happens only when one applies, so ordinary days are unchanged.
    if (!this.reduced && (this.weather === "rain" || this.lateNight || this.placed.length || this.rewards.length)) {
      const q = this.random();
      if (this.weather === "rain" && q < 0.35) plan = this.rainPlan();
      else if (this.lateNight && q < 0.6) plan = q < 0.3 ? this.sleepyPlan() : this.napPlan(true);
      else if (this.placed.length && q > 0.88) plan = this.decorPlan();
      else if (this.rewards.length && q > 0.76 && q <= 0.88) {
        const visit = this.rewardPlan();
        if (visit.length) plan = visit;
      }
    }
    const r = this.random();
    if (plan) {
      // chosen above
    } else if (this.reduced) {
      plan =
        r < 0.25
          ? this.napPlan(false)
          : [{ kind: "pose", anim: "Idle", duration: 5 + this.random() * 4, state: "idle" }];
    } else {
      // Never the same routine twice in a row: a repeat is redrawn from the others.
      const kinds = [[0.26, "favorite"], [0.4, "signature"], [0.58, "wander"], [0.69, "nap"], [0.85, "play"], [1, "sniff"]];
      let kind = kinds.find(([edge]) => r < edge)[1];
      if (kind === this.lastRoutine) {
        const others = kinds.map(([, k]) => k).filter((k) => k !== kind);
        kind = others[Math.floor(this.random() * others.length) % others.length];
      }
      this.lastRoutine = kind;
      plan = { favorite: () => this.favoritePlan(), signature: () => this.signaturePlan(), wander: () => this.wanderPlan(),
        nap: () => this.napPlan(true), play: () => this.playPlan(), sniff: () => this.sniffPlan() }[kind]();
      // Same moves, different pacing each time.
      for (const step of plan)
        if (step.kind === "pose") {
          if (step.duration) step.duration *= 0.8 + this.random() * 0.4;
          if (step.once) step.rate = (step.rate || 1) * (0.85 + this.random() * 0.3);
        }
    }
    if (!plan.length) plan = [{ kind: "pose", anim: "Idle", duration: 2, state: "idle" }];
    // Every outing ends with a short idle so behaviors breathe instead of chaining instantly.
    plan.push({ kind: "pose", anim: "Idle", duration: 1.5 + this.random() * 2.5, look: true, state: "idle" });
    this.start(plan);
  },
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
  },
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
    if (this.species === "charmander" && this.weather === "rain") return this.rainPlan();
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
  },
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
  },
  signaturePlan() {
    if (this.random() < 0.5) {
      const seasonal = this.seasonalPlan();
      if (seasonal) return seasonal;
    }
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
  },
  // One small seasonal habit per starter, in the season that suits it.
  seasonalPlan() {
    if (this.species === "bulbasaur" && this.season === "spring") {
      const spot = SPOTS.shade;
      return [
        { kind: "walk", to: spot, state: "walking" },
        { kind: "turn", dir: directionTo(TREE.x - spot.x, TREE.y - spot.y), state: "blossoms" },
        { kind: "call", fn: () => this.emit("blossoms", { x: TREE.x + 4, y: TREE.canopyY + 6 }) },
        { kind: "pose", anim: "LookUp", duration: 3.2, state: "blossoms" },
        { kind: "pose", anim: "Sit", duration: 3 + this.random() * 2, state: "blossoms" },
        { kind: "turn", dir: 0 },
      ];
    }
    if (this.species === "charmander" && this.season === "winter") {
      return [
        { kind: "turn", dir: 0, state: "tail-warming" },
        { kind: "pose", anim: "Sit", duration: 1, state: "tail-warming" },
        { kind: "call", fn: () => this.emit("warm") },
        { kind: "pose", anim: "DeepBreath", once: true, rate: 0.7, state: "tail-warming" },
        { kind: "call", fn: () => this.emit("embers") },
        { kind: "pose", anim: "Sit", duration: 3.5, state: "tail-warming" },
        { kind: "call", fn: () => this.emit("warm") },
        { kind: "pose", anim: "Sit", duration: 2, state: "tail-warming" },
      ];
    }
    if (this.species === "squirtle" && (this.season === "autumn" || this.season === "winter")) {
      const state = this.season === "autumn" ? "leaf-watching" : "snow-watching";
      const water = { x: SPOTS.bank.x, y: POND.y + POND.ry - 3 };
      return [
        { kind: "walk", to: SPOTS.bank, state: "walking" },
        { kind: "turn", dir: 4, state },
        { kind: "pose", anim: "Sit", duration: 2, state },
        { kind: "call", fn: () => this.emit(this.season === "autumn" ? "pond-leaf" : "pond-rings", water) },
        { kind: "pose", anim: "LookUp", duration: 2.4, state },
        { kind: "pose", anim: "Nod", once: true, rate: 0.7, state },
        { kind: "turn", dir: 0 },
      ];
    }
    return null;
  },
  // Rainy days: each starter meets the rain in its own way.
  rainPlan() {
    if (this.species === "squirtle") {
      const state = "puddling", to = SPOTS.meadow;
      return [
        { kind: "walk", to, state: "walking" },
        { kind: "turn", dir: 0, state },
        { kind: "pose", anim: "Hop", once: true, state },
        { kind: "call", fn: () => this.emit("splash") },
        { kind: "pose", anim: "Rotate", once: true, rate: 0.9, state },
        { kind: "pose", anim: "Hop", once: true, rate: 1.1, state },
        { kind: "call", fn: () => { this.emit("splash"); this.say("note", 1.4); } },
        { kind: "pose", anim: "Idle", duration: 1.5, state },
      ];
    }
    if (this.species === "charmander") {
      const state = "sheltering", to = SPOTS.shade;
      return [
        { kind: "walk", to, state: "walking" },
        { kind: "turn", dir: 0, state },
        { kind: "pose", anim: "Sit", duration: 6 + this.random() * 4, state },
        { kind: "call", fn: () => this.emit("warm") },
        { kind: "pose", anim: "Sit", duration: 3, state },
      ];
    }
    const state = "soaking", to = SPOTS.meadow;
    return [
      { kind: "walk", to, state: "walking" },
      { kind: "turn", dir: 0, state },
      { kind: "pose", anim: "LookUp", duration: 3.5, state },
      { kind: "pose", anim: "DeepBreath", once: true, rate: 0.7, state },
      { kind: "pose", anim: "LookUp", duration: 2.5, state },
      { kind: "pose", anim: "Shake", once: true, state },
    ];
  },
  // Late at night: a slow yawn and a heavy nod, sometimes a nap right where it is.
  sleepyPlan() {
    const state = "sleepy";
    return [
      { kind: "turn", dir: 0, state },
      { kind: "pose", anim: "DeepBreath", once: true, rate: 0.55, state },
      { kind: "pose", anim: "Idle", duration: 1.2, state },
      { kind: "pose", anim: "Nod", once: true, rate: 0.45, state },
      ...(this.random() < 0.5 ? this.napPlan(false) : [{ kind: "pose", anim: "Idle", duration: 1.5, state }]),
    ];
  },
  // Visit a keepsake you set out in the garden.
  decorPlan() {
    const index = Math.floor(this.random() * this.placed.length) % this.placed.length;
    const id = this.placed[index], slot = DECOR_SLOTS[index];
    if (!id || !slot) return [];
    const state = "admiring";
    const to = nearestWalkable({ x: slot.x + 7, y: slot.y });
    return [
      { kind: "call", fn() { this.admiring = id; } },
      { kind: "walk", to, state: "walking" },
      { kind: "turn", dir: directionTo(slot.x - to.x, slot.y - to.y), state },
      { kind: "pose", anim: "Nod", once: true, rate: 0.7, state },
      { kind: "pose", anim: "Idle", duration: 1.6, state },
      { kind: "turn", dir: 0 },
    ];
  },
  // Spend a moment with something a milestone left behind: the bench by day, the lantern once
  // it is lit. Bunting is only for looking at.
  rewardPlan() {
    const lantern = this.rewards.includes("lantern") && ["dusk", "night"].includes(this.phase);
    const bench = this.rewards.includes("bench");
    const id = lantern && (!bench || this.random() < 0.6) ? "lantern" : bench ? "bench" : null;
    if (!id) return [];
    const spot = REWARDS[id];
    const to = nearestWalkable({ x: spot.x, y: spot.y + 5 });
    const state = id === "lantern" ? "lanternlit" : "bench";
    return [
      { kind: "walk", to, state: "walking" },
      { kind: "turn", dir: id === "lantern" ? 4 : 0, state },
      ...(id === "lantern" ? [{ kind: "pose", anim: "LookUp", duration: 2.2, state }, { kind: "turn", dir: 0, state }] : []),
      { kind: "pose", anim: "Sit", duration: 5 + this.random() * 4, state },
      { kind: "pose", anim: "Nod", once: true, rate: 0.7, state },
      { kind: "pose", anim: "Sit", duration: 2 + this.random() * 2, state },
      { kind: "turn", dir: 0 },
    ];
  },
  napPlan(travel) {
    const spot = SPOTS[this.favoriteSpot || SPECIES[this.species].napSpot];
    return [
      ...(travel ? [{ kind: "walk", to: spot, state: "walking" }] : []),
      { kind: "turn", dir: 7 },
      { kind: "pose", anim: "Laying", duration: 1.2, state: "sleeping" },
      { kind: "pose", anim: this.random() < 0.4 ? "EventSleep" : "Sleep", rate: 0.5, duration: 10 + this.random() * 10, state: "sleeping" },
      ...this.wakePlan(),
    ];
  },
  wakePlan() {
    return [
      { kind: "pose", anim: "Wake", once: true, dir: 0, state: "waking" },
      { kind: "pose", anim: "DeepBreath", once: true, state: "waking" },
    ];
  },
  playPlan() {
    const q = this.random();
    if (q < 0.3)
      // Pounce after the butterfly, sometimes landing in a heap.
      return [
        { kind: "call", fn: () => this.emit("butterfly") },
        { kind: "pose", anim: "Idle", duration: 0.6, state: "playing" },
        { kind: "pose", anim: "LeapForth", once: true, state: "playing" },
        ...(this.random() < 0.5
          ? [{ kind: "pose", anim: "Trip", once: true, state: "playing" }, { kind: "pose", anim: "Wake", once: true, state: "playing" }]
          : [{ kind: "pose", anim: "Hop", once: true, state: "playing" }]),
        { kind: "call", fn: () => this.say("note", 1.4) },
        { kind: "pose", anim: "Idle", duration: 0.8, state: "playing" },
      ];
    if (q < 0.55)
      // A happy roll in the grass.
      return [
        { kind: "pose", anim: "Tumble", once: true, state: "playing" },
        { kind: "pose", anim: "Tumble", once: true, rate: 0.9, state: "playing" },
        { kind: "call", fn: () => this.say("note", 1.4) },
        { kind: "pose", anim: "Pose", once: true, state: "playing" },
      ];
    return [
      { kind: "call", fn: () => this.emit("butterfly") },
      { kind: "pose", anim: "Rotate", once: true, rate: 0.7, state: "playing" },
      { kind: "pose", anim: "Hop", once: true, dir: 0, state: "playing" },
      { kind: "call", fn: () => this.say("note", 1.4) },
      { kind: "pose", anim: "Rotate", once: true, rate: 0.7, state: "playing" },
      { kind: "pose", anim: "Idle", duration: 0.8, state: "playing" },
    ];
  },
  sniffPlan() {
    return [
      { kind: "walk", to: SPOTS.flowers, state: "walking" },
      { kind: "turn", dir: 0 },
      ...(this.species === "charmander" && this.random() < 0.5 ? [{ kind: "pose", anim: "Kick", once: true, rate: 0.8, state: "sniffing" }] : []),
      { kind: "pose", anim: "Eat", rate: 0.6, duration: 2.2, state: "sniffing" },
      { kind: "call", fn: () => this.emit("petals") },
      { kind: "pose", anim: "Nod", once: true, state: "sniffing" },
    ];
  },
  invitationPlan() {
    return this.ballOfferPlan("inviting");
  },
  ballOfferPlan(state) {
    const gentle = this.species === "bulbasaur", playful = this.species === "squirtle";
    const near = { x: HOME.x + (gentle ? -6 : playful ? 6 : 0), y: HOME.y - 8 };
    const rollTime = gentle ? 1.2 : playful ? 0.9 : 0.7;
    return [
      { kind: "call", fn() { this.ball = { x: this.x, y: this.y, z: 22, spin: 0, phase: "carried", invitation: true }; } },
      { kind: "walk", to: near, speed: SPECIES[this.species].speed * (gentle ? 0.9 : playful ? 1.05 : 1.2), state },
      { kind: "turn", dir: 0, state },
      { kind: "call", fn() {
        Object.assign(this.ball, { from: { x: this.x, y: this.y }, target: { x: this.x + 2, y: this.y + 4 }, phase: "invitation-lower", t: 0 });
      } },
      { kind: "pose", anim: "Nod", once: true, rate: gentle ? 0.7 : 1.1, state },
      { kind: "call", fn() {
        const from = { x: this.ball.x, y: this.ball.y };
        Object.assign(this.ball, { from, target: { x: HOME.x, y: HOME.y + 6 }, phase: "invitation-roll", t: 0, rollTime });
      } },
      { kind: "pose", anim: "LookUp", duration: rollTime + 0.25, state },
      { kind: "call", fn: () => this.say("note", 1.6) },
      ...(playful ? [{ kind: "pose", anim: "Rotate", once: true, rate: 0.85, state }] : []),
      { kind: "pose", anim: gentle ? "Nod" : "Hop", once: true, rate: gentle ? 0.65 : playful ? 1 : 1.25, dir: 0, state },
      { kind: "pose", anim: "Idle", duration: gentle ? 3.5 : 3, state },
      { kind: "call", fn() { this.ball = null; this.invitationActive = false; } },
      { kind: "pose", anim: "Idle", duration: 1.2, state: "idle" },
    ];
  },
};
