import { SPECIES } from "./species.js";
import { HOME, SPOTS, nearestWalkable } from "./world.js";
import { TOOL_KINDS, TOOL_COOLDOWN } from "./tools.js";

// Where it sits to keep you company during a long turn: just beside where you stand.
export const COMPANY_SPOT = { x: HOME.x + 12, y: HOME.y - 6 };
// Consecutive failed turns before it suggests a small break, and how rarely it may.
export const BREAK_STREAK = 2;
export const BREAK_COOLDOWN = 600;
// Simulation seconds between glances at other chats: several sessions can finish at once.
export const ELSEWHERE_COOLDOWN = 30;

// Hermes cues and your rhythm: long turns, rough patches, tools, other chats, welcomes and
// usual arrivals. Mixed into Companion.prototype, so `this` is the companion.
export const cues = {
  // A long turn is running: come and sit beside you until it ends. Never interrupts play.
  keepCompany() {
    // Defer only while something is still running. Once a plan has ended (this.step is
    // null) its last state label, e.g. "presenting", must not block forever.
    if (this.step && (this.busy || this.swimming || this.asleep || this.inviting || this.greetingActive ||
        ["petting", "waking", "eating", "investigating", "evolving"].includes(this.state))) {
      this.companyPending = true;
      return false;
    }
    const joining = !this.companyActive;
    this.companyPending = false;
    this.companyActive = true;
    const state = "company";
    const travel = joining && !this.reduced && Math.hypot(this.x - COMPANY_SPOT.x, this.y - COMPANY_SPOT.y) > 4;
    // Very late, it may nod off right there beside you. A finished turn still wakes it to cheer.
    const doze = this.lateNight && !this.reduced && !joining && this.random() < 0.4;
    this.start([
      ...(travel ? [{ kind: "walk", to: COMPANY_SPOT, state }] : []),
      { kind: "turn", dir: 0, state },
      ...(doze ? [] : [{ kind: "call", fn: () => this.say("dots", 2.4) }]),
      { kind: "pose", anim: "Sit", duration: 5 + this.random() * 3, state },
      ...(doze ? [
        { kind: "pose", anim: "DeepBreath", once: true, rate: 0.55, state: "dozing" },
        { kind: "pose", anim: "Laying", duration: 1.2, state: "dozing" },
        { kind: "pose", anim: "Sleep", rate: 0.5, duration: 10 + this.random() * 6, state: "dozing" },
      ] : this.reduced ? [] : [{ kind: "pose", anim: "Nod", once: true, rate: 0.6, state }]),
    ]);
    return true;
  },
  endCompany() {
    const was = this.companyActive || this.companyPending;
    this.companyActive = false;
    this.companyPending = false;
    return was;
  },
  // Called while a turn has run past LONG_TURN_MS. Idempotent; waits for play to finish.
  beginCompany() {
    if (this.companyActive || this.companyPending) return false;
    this.companyPending = true;
    if (this.step?.kind === "pose" && ["idle", "attentive", "walking", "resting", "basking", "watching", "sniffing", "playing",
        "scouting", "curious", "digging", "visitor", "admiring", "soaking", "sleepy", "puddling", "sheltering", "elsewhere", "bench", "lanternlit"].includes(this.state) && !this.inviting)
      this.keepCompany();
    return true;
  },
  // Two errors in a row: bring the ball over, a small invitation to step away for a moment.
  offerBreak() {
    this.breakPending = false;
    if (this.reduced || this.time < this.nextBreakAt) return this.choose();
    this.nextBreakAt = this.time + BREAK_COOLDOWN;
    this.invitationActive = true;
    this.nextInvitationAt = Math.max(this.nextInvitationAt, this.time + 120);
    this.start(this.ballOfferPlan("offering"));
  },
  // Arrived at your usual time: already waiting in its favorite spot, looking your way.
  // Runs as the pane becomes visible, so the move happened off-screen: no travel shown.
  awaitArrival() {
    if (this.evolving || this.busy || this.swimming || this.inviting || this.greetingActive) return false;
    const spot = SPOTS[this.favoriteSpot || SPECIES[this.species].favorite];
    this.cancelGreeting();
    this.remember("greeting");
    Object.assign(this, { x: spot.x, y: spot.y, speed: 0, dir: 0 });
    const state = "expecting";
    this.start([
      { kind: "pose", anim: "Sit", duration: 0.8, state },
      { kind: "call", fn: () => this.say("heart", 1.8) },
      { kind: "pose", anim: this.reduced ? "Idle" : "Nod", once: !this.reduced, duration: this.reduced ? 0.6 : undefined, state },
      { kind: "pose", anim: "Sit", duration: 3, state },
      { kind: "pose", anim: "Idle", duration: 1, state: "idle" },
    ]);
    return true;
  },
  // A small gesture for the kind of tool Hermes started. Rare by design: tools come in bursts.
  reactToTool(kind) {
    if (!TOOL_KINDS.includes(kind) || this.reduced || this.time < this.nextToolAt) return false;
    if (this.busy || this.swimming || this.asleep || this.inviting || this.greetingActive || this.pendingGreeting ||
        ["petting", "waking", "eating", "investigating", "dozing", "treasure", "milestone", "offering", "proud", "celebrating", "steady", "stopped"].includes(this.state))
      return false;
    this.nextToolAt = this.time + TOOL_COOLDOWN;
    const stay = this.companyActive;
    const state = { web: "scouting", terminal: "curious", files: "digging" }[kind];
    let plan;
    if (kind === "web") {
      const to = nearestWalkable({ x: Math.max(20, Math.min(140, this.x)), y: 47 });
      plan = [
        ...(stay ? [] : [{ kind: "walk", to, state }]),
        { kind: "turn", dir: 4, state },
        { kind: "pose", anim: "LookUp", duration: 2.2, state },
      ];
    } else if (kind === "terminal") {
      plan = [
        { kind: "turn", dir: 1, state },
        { kind: "pose", anim: "Idle", duration: 0.6, state },
        { kind: "turn", dir: 7, state },
        { kind: "pose", anim: "Idle", duration: 0.6, state },
        { kind: "turn", dir: 0, state },
        { kind: "pose", anim: "Nod", once: true, rate: 0.8, state },
      ];
    } else {
      plan = [
        { kind: "turn", dir: 0, state },
        { kind: "call", fn: () => this.emit("dust") },
        { kind: "pose", anim: "Eat", duration: 1.6, rate: 0.9, state },
        { kind: "call", fn: () => this.emit("dust") },
        { kind: "pose", anim: "Nod", once: true, state },
      ];
    }
    plan.push({ kind: "turn", dir: 0, state }, { kind: "pose", anim: "Idle", duration: 0.8, state: stay ? "company" : "idle" });
    this.start(plan);
    return true;
  },
  // A turn finished in a chat you are not looking at: a glance toward the session list and a
  // small "!" so a tiled or background session's finish is noticeable without a notification.
  noticeElsewhere() {
    if (this.time < this.nextElsewhereAt) return false;
    if (this.busy || this.swimming || this.asleep || this.inviting || this.greetingActive || this.pendingGreeting ||
        ["petting", "waking", "eating", "investigating", "dozing", "treasure", "milestone", "offering", "proud", "celebrating", "steady", "stopped", "elsewhere"].includes(this.state))
      return false;
    this.nextElsewhereAt = this.time + ELSEWHERE_COOLDOWN;
    this.say("!", 1.4);
    const stay = this.companyActive;
    const state = "elsewhere", after = { kind: "pose", anim: "Idle", duration: 0.6, state: stay ? "company" : "idle" };
    if (this.reduced) {
      this.start([{ kind: "pose", anim: "Idle", duration: 1.6, state }, after]);
      return true;
    }
    this.start([
      { kind: "turn", dir: 6, fast: true, state },
      { kind: "pose", anim: "Idle", duration: 1.6, state },
      { kind: "pose", anim: "Nod", once: true, rate: 0.9, state },
      { kind: "turn", dir: 0, state },
      after,
    ]);
    return true;
  },
  welcomeBack() {
    if (this.evolving) return false;
    if (this.greetingActive || this.pendingGreeting) return false;
    if (this.busy || this.inviting || this.swimming || ["petting", "waking", "eating", "swimming"].includes(this.state)) {
      this.pendingGreeting = true;
      return true;
    }
    this.beginGreeting();
    return true;
  },
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
  },
  react(kind, info = {}) {
    if (kind === "failed") return this.reactToFailure(info);
    if (kind !== "working" && kind !== "waiting") this.endCompany();
    const big = kind === "completed" && Boolean(info.long);
    const bubble = { working: "dots", completed: "sparkle", waiting: "?" }[kind];
    if (!bubble) return;
    this.lastAttention = this.time;
    if (this.greetingActive || this.inviting || this.evolving) return;
    if (this.bubble?.kind === "heart" && this.bubble.until > this.time) return;
    // Let a dozing friend sleep through ongoing work; only the finish wakes it.
    if (this.state === "dozing" && kind !== "completed") return;
    this.say(bubble, kind === "working" ? 2.2 : big ? 2.6 : 2);
    if (kind === "completed") this.emit("confetti", { y: this.y - 18 });
    if (big) this.emit("sparkle", { y: this.y - 12 });
    // A cue may decorate play, but it never cancels a fetch, treat, pet or nap.
    if (this.busy || this.swimming || this.asleep || ["petting", "waking", "investigating"].includes(this.state)) return;
    // Keeping company already faces you; a passing cue only refreshes the bubble.
    if (this.companyActive && kind !== "completed") return;
    const state = big ? "proud" : { working: "attentive", completed: "celebrating", waiting: "waiting" }[kind];
    // Dozing beside you through a long turn: wake gently before cheering.
    const plan = this.state === "dozing" ? [{ kind: "pose", anim: "Wake", once: true, dir: 0, state }] : [];
    plan.push({ kind: "turn", dir: 0, state });
    if (kind === "working") plan.push({ kind: "pose", anim: "Nod", once: true, rate: 0.8, state }, { kind: "pose", anim: "Idle", duration: 1.2, state });
    else if (big)
      plan.push(
        { kind: "pose", anim: this.reduced ? "DeepBreath" : "Charge", once: true, state },
        { kind: "call", fn: () => this.emit("confetti", { y: this.y - 18 }) },
        { kind: "pose", anim: "Hop", once: true, state },
        { kind: "pose", anim: "Hop", once: true, rate: 1.2, state },
        { kind: "pose", anim: "Pose", once: true, state },
        { kind: "pose", anim: "Idle", duration: 1, state },
      );
    else if (kind === "completed")
      plan.push({ kind: "pose", anim: !this.reduced && this.random() < 0.4 ? "LeapForth" : "Hop", once: true, state }, { kind: "pose", anim: "Pose", once: true, state });
    else plan.push({ kind: "pose", anim: "Idle", duration: 2, state });
    this.start(plan);
  },
  // A failed or stopped turn gets a quiet look and a nod: no bubble, no confetti.
  reactToFailure({ reason = "error", streak = 0 } = {}) {
    this.endCompany();
    this.lastAttention = this.time;
    if (reason === "error" && streak >= BREAK_STREAK && !this.reduced && this.time >= this.nextBreakAt) this.breakPending = true;
    if (this.greetingActive || this.inviting || this.evolving) return;
    if (this.busy || this.swimming || this.asleep || ["petting", "waking", "investigating", "eating"].includes(this.state)) return;
    const state = reason === "interrupted" ? "stopped" : "steady";
    this.start([
      { kind: "turn", dir: 0, state },
      { kind: "pose", anim: this.reduced ? "Idle" : "Nod", once: !this.reduced, rate: 0.6, duration: this.reduced ? 1 : undefined, state },
      { kind: "pose", anim: "Idle", duration: 1.6, state },
    ]);
  },
};
