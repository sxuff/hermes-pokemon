import { shouldGreet } from "./presence.js";
import { isArrival, expectedNow, recordArrival } from "./rhythm.js";
import { dueMilestone } from "./milestones.js";

// Wall-clock presence and storage live outside the simulation. The pet only reports
// meaningful moments; no position, animation frame, or particle is ever persisted.
export function createCompanionMemory({ store, species, pet, now = Date.now }) {
  let present = false, disposed = false, lastCheckpoint = 0, together = 0;

  function flushTogether() {
    if (!together) return;
    const seconds = together;
    together = 0;
    store.addTogetherTime(species, seconds);
  }
  // Count only small, rendered simulation steps while the pane has attention.
  // Persist in batches, never derive growth from time spent away or a clock jump.
  function tick(dt) {
    if (disposed || !present || !Number.isFinite(dt) || dt <= 0) return;
    together += Math.min(dt, 0.25);
    if (together >= 30) {
      together -= 30;
      store.addTogetherTime(species, 30);
    }
  }

  function flushEvents() {
    const events = pet.drainMemory();
    if (!events.length) return;
    const at = now(), patch = {};
    for (const event of events) {
      if (event.type === "favorite") patch.favoriteSpot = event.spot;
      if (event.type === "keepsake") store.collect(species, event.id);
      if (event.type === "sighting") store.sighting(species, event.id, at);
      if (event.type === "interaction") {
        store.awardXp(species, event.kind, at);
        patch.lastInteraction = { kind: event.kind, at };
        if (event.kind === "greeting") patch.lastGreetingAt = at;
      }
    }
    if (present) patch.lastSeenAt = at;
    store.remember(species, patch);
  }
  function flush() { if (!disposed) flushEvents(); }
  function setPresent(value) {
    if (disposed || value === present) return;
    const at = now();
    if (value) {
      const memory = store.getMemory(species);
      // Reserve the cooldown even if fetch delays the greeting. Brief tab switches,
      // hot reloads and a cancelled greeting must not repeatedly demand attention.
      // At a usual time of day it is already waiting in its spot instead of walking over.
      const greet = shouldGreet(memory, at);
      if (greet && expectedNow(memory, at) && pet.awaitArrival?.()) {
        store.remember(species, { lastGreetingAt: at });
      } else if (greet && pet.welcomeBack()) {
        store.remember(species, { lastGreetingAt: at });
      }
      present = value;
      lastCheckpoint = at;
      // Days together: start counting at the first visit (or the upgrade for older saves).
      const met = memory.metAt || at;
      const due = dueMilestone(met, memory.milestones, at);
      if (due.celebrate) pet.queueMilestone?.(due.celebrate);
      // Learn arrival times only after deciding, so today's visit never predicts itself.
      // Folded into the presence write: learning a rhythm never costs an extra save.
      const arrivals = isArrival(memory, at) ? recordArrival(store.getMemory(species).arrivals, at) : undefined;
      store.remember(species, { lastSeenAt: at, metAt: met, milestones: due.celebrated, ...(arrivals ? { arrivals } : {}) });
      flush();
      return;
    }
    flush(); flushTogether();
    present = value;
    lastCheckpoint = at;
    store.remember(species, { lastSeenAt: at });
    flush();
  }
  function checkpoint() {
    if (disposed || !present) return;
    const at = now();
    if (at < lastCheckpoint || at - lastCheckpoint >= 30_000) {
      lastCheckpoint = at;
      store.remember(species, { lastSeenAt: at });
    }
  }
  return {
    setPresent, flush, checkpoint, tick,
    dispose() {
      if (disposed) return;
      disposed = true;
      flushEvents();
      flushTogether();
      // Never overwrite the departure time later when an already-hidden pane unmounts.
      if (present) store.remember(species, { lastSeenAt: now() });
      present = false;
    },
  };
}
