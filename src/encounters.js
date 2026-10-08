import { directionTo, nearestWalkable } from "./world.js";
import { findKeepsake, FIND_COOLDOWN } from "./keepsakes.js";
import { VISITORS, isCameo } from "./visitors.js";
import { SPECIES } from "./species.js";

// How each starter greets each wild visitor; anything not listed gets the ordinary watch.
// Steps run with `this` as the companion and must end on the ground where they started.
export const REACTIONS = {
  squirtle: {
    magikarp: { caption: (n) => `Splashing hello to a ${n}`, steps(state) {
      return [
        { kind: "pose", anim: "Hop", once: true, state },
        { kind: "call", fn: () => this.say("heart", 1.4) },
        { kind: "pose", anim: "Hop", once: true, rate: 1.1, state },
        { kind: "pose", anim: "Idle", duration: 1.5, state },
      ];
    } },
    pidgey: { caption: (n) => `Ducking into its shell. A ${n}!`, steps(state) {
      return [{ kind: "pose", anim: "Withdraw", once: true, rate: 0.8, state }, { kind: "pose", anim: "Idle", duration: 2.5, state }];
    } },
  },
  charmander: {
    caterpie: { caption: (n) => `Stamping hello at a ${n}`, steps(state) {
      return [
        { kind: "pose", anim: "Kick", once: true, rate: 0.9, state },
        { kind: "call", fn: () => this.emit("dust") },
        { kind: "pose", anim: "Idle", duration: 1.2, state },
        { kind: "pose", anim: "Nod", once: true, state },
      ];
    } },
    hoothoot: { caption: (n) => `Flame up, watching a ${n}`, steps(state) {
      return [{ kind: "call", fn: () => this.emit("embers") }, { kind: "pose", anim: "LookUp", duration: 3, state }, { kind: "pose", anim: "Nod", once: true, rate: 0.7, state }];
    } },
  },
  bulbasaur: {
    pidgey: { caption: (n) => `Watching a ${n} from the grass`, steps(state) {
      return [{ kind: "pose", anim: "LookUp", duration: 2.4, state }, { kind: "pose", anim: "Nod", once: true, rate: 0.7, state }, { kind: "pose", anim: "Idle", duration: 1, state }];
    } },
    caterpie: { caption: (n) => `Making friends with a ${n}`, steps(state) {
      return [
        { kind: "pose", anim: "Sit", duration: 2, state },
        { kind: "call", fn: () => this.say("heart", 1.4) },
        { kind: "pose", anim: "Nod", once: true, rate: 0.7, state },
        { kind: "pose", anim: "Idle", duration: 1, state },
      ];
    } },
  },
};

// Encounters: wild visitors, milestones and keepsake finds. Mixed into Companion.prototype.
export const encounters = {
  // A wild Pokémon stopped by: turn and watch it, with a small reaction of this starter's own.
  // A cameo by another starter of yours gets a walk over and a hop hello instead.
  watchVisitor({ species, x, y, name, cameo = false } = {}) {
    const wild = Object.hasOwn(VISITORS, species);
    if ((!wild && !isCameo(species)) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (this.busy || this.swimming || this.asleep || this.inviting || this.greetingActive || this.pendingGreeting || this.companyActive ||
        ["petting", "waking", "eating", "investigating", "dozing", "treasure", "milestone", "offering", "proud", "celebrating"].includes(this.state))
      return false;
    this.visitor = species;
    const label = wild ? VISITORS[species].name : typeof name === "string" && name ? name : "an old friend";
    const state = "visitor";
    if (wild) {
      this.memoryEvents.push({ type: "sighting", id: species });
      this.trimMemory();
    }
    const face = { kind: "turn", dir: directionTo(x - this.x, y - this.y), state };
    if (!wild) {
      // Your other starter: go and say hello.
      this.visitorCaption = `Saying hello to ${label}`;
      const to = nearestWalkable({ x: x + 14, y: y + 2 });
      this.start([
        { kind: "call", fn: () => this.say("!", 1) },
        ...(this.reduced ? [face] : [{ kind: "walk", to, speed: SPECIES[this.species].speed * 1.2, state }]),
        { kind: "turn", dir: directionTo(x - this.x, y - this.y), state },
        { kind: "call", fn: () => { this.say("heart", 1.6); this.emit("hearts", { count: 1 }); } },
        { kind: "pose", anim: this.reduced ? "Idle" : "Hop", once: !this.reduced, duration: this.reduced ? 1 : undefined, state },
        { kind: "pose", anim: "Idle", duration: 2.5, state },
        ...(this.reduced ? [] : [{ kind: "pose", anim: "Nod", once: true, rate: 0.8, state }]),
        { kind: "pose", anim: "Idle", duration: 1.5, state },
        { kind: "turn", dir: 0 },
      ]);
      return true;
    }
    const reaction = REACTIONS[this.species]?.[species];
    this.visitorCaption = reaction?.caption?.(label) || `Watching a wild ${label}`;
    const middle = this.reduced
      ? [{ kind: "pose", anim: "Idle", duration: 3, state }]
      : reaction?.steps?.call(this, state) || [
          ...(this.species === "squirtle" && this.random() < 0.4 ? [{ kind: "pose", anim: "Withdraw", once: true, rate: 0.8, state }] : []),
          { kind: "pose", anim: "Idle", duration: 3, state },
          { kind: "pose", anim: "Nod", once: true, rate: 0.8, state },
        ];
    this.start([
      face,
      { kind: "call", fn: () => this.say("!", 1) },
      ...middle,
      { kind: "pose", anim: "Idle", duration: 1.5, state },
      { kind: "turn", dir: 0 },
    ]);
    return true;
  },
  // Day 30, day 100, each year: queued so it never interrupts play or a greeting.
  queueMilestone(days) {
    if (!Number.isInteger(days) || days <= 0) return false;
    this.pendingMilestone = days;
    if (this.step?.kind === "pose" && ["idle", "attentive", "resting", "watching", "company"].includes(this.state) && !this.inviting && !this.busy && !this.swimming)
      this.celebrateMilestone();
    return true;
  },
  celebrateMilestone() {
    const days = this.pendingMilestone;
    this.pendingMilestone = null;
    if (!days) return this.choose();
    this.milestone = days;
    const state = "milestone";
    this.start([
      { kind: "turn", dir: 0, state },
      { kind: "call", fn: () => { this.say("heart", 2.4); this.emit("confetti", { y: this.y - 18 }); } },
      ...(this.reduced ? [{ kind: "pose", anim: "Idle", duration: 2.5, state }] : [
        { kind: "pose", anim: "Hop", once: true, state },
        { kind: "pose", anim: "Pose", once: true, state },
        { kind: "call", fn: () => this.emit("sparkle", { y: this.y - 12 }) },
        { kind: "pose", anim: "Hop", once: true, rate: 1.2, state },
      ]),
      { kind: "pose", anim: "Idle", duration: 2, state },
      { kind: "pose", anim: "Idle", duration: 0.5, state: "idle" },
    ]);
  },
  // A keepsake, sometimes, from an investigation it shared with you.
  keepsakeSteps(place) {
    if (this.time < this.nextFindAt) return [];
    const found = findKeepsake(place, this.season, this.keepsakes, this.random);
    if (!found) return [];
    this.nextFindAt = this.time + FIND_COOLDOWN;
    const state = "treasure";
    return [
      { kind: "call", fn() {
        this.keepsakes.add(found);
        this.memoryEvents.push({ type: "keepsake", id: found });
        this.trimMemory();
        this.lastFound = found;
        this.say("sparkle", 1.6);
        this.emit("sparkle", { y: this.y - 8 });
      } },
      { kind: "pose", anim: this.reduced ? "Idle" : "Hop", once: !this.reduced, duration: this.reduced ? 1 : undefined, state },
      { kind: "pose", anim: "Idle", duration: 1.2, state },
    ];
  },
};
