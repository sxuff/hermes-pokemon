import { SPECIES } from "./species.js";
import { signal } from "./signal.js";
import { SPOTS } from "./world.js";
export const STORAGE_KEY = "companion";
export const VERSION = 3;
export const SKIES = ["auto", "dawn", "day", "dusk", "night"];
export const DEFAULT_MEMORY = {
  favoriteSpot: null,
  lastInteraction: null,
  lastSeenAt: 0,
  lastGreetingAt: 0,
};
export const DEFAULT_RECORD = {
  version: VERSION,
  species: null,
  nickname: "",
  motion: "system",
  sky: "auto",
  memories: {},
};
const knownSpecies = (species) => typeof species === "string" && Object.hasOwn(SPECIES, species);
const timestamp = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 8.64e15;
const interactionKinds = ["pet", "ball", "berry", "call", "greeting"];

export function validateMemory(raw) {
  const interaction = raw?.lastInteraction;
  return {
    favoriteSpot: typeof raw?.favoriteSpot === "string" && Object.hasOwn(SPOTS, raw.favoriteSpot) ? raw.favoriteSpot : null,
    lastInteraction: interactionKinds.includes(interaction?.kind) && timestamp(interaction?.at)
      ? { kind: interaction.kind, at: interaction.at }
      : null,
    lastSeenAt: timestamp(raw?.lastSeenAt) ? raw.lastSeenAt : 0,
    lastGreetingAt: timestamp(raw?.lastGreetingAt) ? raw.lastGreetingAt : 0,
  };
}
export function cleanName(value, species) {
  return (
    (typeof value === "string"
      ? [...value.replace(/[\u0000-\u001f\u007f]/g, "").trim()]
          .slice(0, 24)
          .join("")
      : "") ||
    SPECIES[species]?.name ||
    ""
  );
}
// Older saves gain memories in RAM. Write the migration only with a real change.
export function validateRecord(raw) {
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
    memories,
  };
}
export function createPersistence(storage) {
  let raw,
    warning = "";
  try {
    raw = storage.get(STORAGE_KEY, null);
  } catch {
    warning =
      "Storage is unavailable. Your companion will stay for this visit.";
  }
  const future = typeof raw?.version === "number" && raw.version > VERSION;
  if (future)
    warning =
      "This save belongs to a newer version. It will be kept untouched.";
  const state = signal({ record: validateRecord(raw), warning });
  function update(patch) {
    const record = validateRecord({
      ...state.get().record,
      ...patch,
      version: VERSION,
    });
    if (JSON.stringify(record) === JSON.stringify(state.get().record)) return false;
    let warning = future ? state.get().warning : "";
    if (!future) {
      try {
        storage.set(STORAGE_KEY, record);
      } catch {
        warning = "Could not save. Your companion will stay for this visit.";
      }
    }
    state.set({ record, warning });
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
    },
  };
}
