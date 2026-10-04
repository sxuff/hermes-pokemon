import { shouldGreet } from "./presence.js";

// Wall-clock presence and storage live outside the simulation. The pet only reports
// meaningful moments; no position, animation frame, or particle is ever persisted.
export function createCompanionMemory({ store, species, pet, now = Date.now }) {
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
      // Reserve the cooldown even if fetch delays the greeting. Brief tab switches,
      // hot reloads and a cancelled greeting must not repeatedly demand attention.
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
    if (at < lastCheckpoint || at - lastCheckpoint >= 30_000) {
      lastCheckpoint = at;
      store.remember(species, { lastSeenAt: at });
    }
  }
  return {
    setPresent, flush, checkpoint,
    dispose() {
      if (disposed) return;
      flush();
      // Never overwrite the departure time later when an already-hidden pane unmounts.
      if (present) store.remember(species, { lastSeenAt: now() });
      present = false; disposed = true;
    },
  };
}
