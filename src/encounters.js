import { directionTo } from "./world.js";
import { findKeepsake, FIND_COOLDOWN } from "./keepsakes.js";
import { VISITORS } from "./visitors.js";

// Encounters: wild visitors, milestones and keepsake finds. Mixed into Companion.prototype.
export const encounters = {
  // A wild Pokémon stopped by: turn and watch it for a moment.
  watchVisitor({ species, x, y } = {}) {
    if (!Object.hasOwn(VISITORS, species) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (this.busy || this.swimming || this.asleep || this.inviting || this.greetingActive || this.pendingGreeting || this.companyActive ||
        ["petting", "waking", "eating", "investigating", "dozing", "treasure", "milestone", "offering", "proud", "celebrating"].includes(this.state))
      return false;
    this.visitor = species;
    const state = "visitor";
    this.start([
      { kind: "turn", dir: directionTo(x - this.x, y - this.y), state },
      { kind: "call", fn: () => this.say("!", 1) },
      ...(this.species === "squirtle" && !this.reduced && this.random() < 0.4 ? [{ kind: "pose", anim: "Withdraw", once: true, rate: 0.8, state }] : []),
      { kind: "pose", anim: "Idle", duration: 3, state },
      ...(this.reduced ? [] : [{ kind: "pose", anim: "Nod", once: true, rate: 0.8, state }]),
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
