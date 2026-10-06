import { SPECIES } from "./species.js";
import { signal } from "./signal.js";
import { SPOTS } from "./world.js";
import { progressionOf, canEvolve, rewardInteraction, advanceTogetherTime } from "./progression.js";
import { SEASON_SETTINGS, HEMISPHERES } from "./seasons.js";
import { isKeepsake, KEEPSAKE_COUNT, MAX_PLACED } from "./keepsakes.js";
import { validArrival, recordArrival, MAX_ARRIVALS } from "./rhythm.js";
import { WEATHER_SETTINGS } from "./weather.js";
export const STORAGE_KEY = "companion";
export const VERSION = 5;
export const SKIES = ["auto", "dawn", "day", "dusk", "night"];
export const DEFAULT_MEMORY = {
  favoriteSpot: null,
  lastInteraction: null,
  lastSeenAt: 0,
  lastGreetingAt: 0,
  keepsakes: [],
  arrivals: [],
  // Local time you first met. Saves from before v0.6 start counting from the upgrade.
  metAt: 0,
  milestones: [],
  placed: [],
};
export const DEFAULT_RECORD = {
  version: VERSION,
  species: null,
  nickname: "",
  motion: "system",
  sky: "auto",
  season: "auto",
  hemisphere: "north",
  weather: "auto",
  memories: {},
  progression: {},
};
const knownSpecies = (species) => typeof species === "string" && Object.hasOwn(SPECIES, species);
const timestamp = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 8.64e15;
const interactionKinds = ["pet", "ball", "berry", "call", "greeting"];

export function validateMemory(raw) {
  const interaction = raw?.lastInteraction;
  const keepsakes = Array.isArray(raw?.keepsakes) ? [...new Set(raw.keepsakes.filter(isKeepsake))].slice(0, KEEPSAKE_COUNT) : [];
  return {
    favoriteSpot: typeof raw?.favoriteSpot === "string" && Object.hasOwn(SPOTS, raw.favoriteSpot) ? raw.favoriteSpot : null,
    lastInteraction: interactionKinds.includes(interaction?.kind) && timestamp(interaction?.at)
      ? { kind: interaction.kind, at: interaction.at }
      : null,
    lastSeenAt: timestamp(raw?.lastSeenAt) ? raw.lastSeenAt : 0,
    lastGreetingAt: timestamp(raw?.lastGreetingAt) ? raw.lastGreetingAt : 0,
    keepsakes,
    arrivals: Array.isArray(raw?.arrivals) ? raw.arrivals.filter(validArrival).map(([d, m]) => [d, m]).slice(-MAX_ARRIVALS) : [],
    metAt: timestamp(raw?.metAt) ? raw.metAt : 0,
    milestones: Array.isArray(raw?.milestones)
      ? [...new Set(raw.milestones.filter((d) => Number.isInteger(d) && d > 0 && d <= 36500))].sort((a, b) => a - b).slice(-64)
      : [],
    // Only keepsakes actually found can be set out in the garden.
    placed: Array.isArray(raw?.placed) ? [...new Set(raw.placed.filter((id) => keepsakes.includes(id)))].slice(0, MAX_PLACED) : [],
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
  if (!raw || ![1, 2, 3, 4, VERSION].includes(raw.version)) return { ...DEFAULT_RECORD, memories: {}, progression: {} };
  const species = knownSpecies(raw.species) ? raw.species : null;
  const memories = {};
  const progression = {};
  for (const name of Object.keys(SPECIES)) {
    if (raw.memories && Object.hasOwn(raw.memories, name)) memories[name] = validateMemory(raw.memories[name]);
    if (raw.progression && Object.hasOwn(raw.progression, name)) progression[name] = progressionOf(raw.progression[name], name);
  }
  return {
    version: VERSION,
    species,
    nickname: cleanName(raw.nickname, species),
    motion: ["system", "reduced"].includes(raw.motion) ? raw.motion : "system",
    sky: SKIES.includes(raw.sky) ? raw.sky : "auto",
    season: SEASON_SETTINGS.includes(raw.season) ? raw.season : "auto",
    hemisphere: HEMISPHERES.includes(raw.hemisphere) ? raw.hemisphere : "north",
    weather: WEATHER_SETTINGS.includes(raw.weather) ? raw.weather : "auto",
    memories,
    progression,
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
  function setProgression(species, progress) {
    return update({ progression: { ...state.get().record.progression, [species]: progress } });
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
    collect(species, keepsake) {
      if (!knownSpecies(species) || !isKeepsake(keepsake)) return false;
      const owned = validateMemory(state.get().record.memories[species]).keepsakes;
      if (owned.includes(keepsake)) return false;
      return this.remember(species, { keepsakes: [...owned, keepsake] });
    },
    // Set a found keepsake out in the garden, or put it back on the shelf.
    togglePlaced(species, keepsake) {
      if (!knownSpecies(species)) return false;
      const memory = validateMemory(state.get().record.memories[species]);
      if (!memory.keepsakes.includes(keepsake)) return false;
      const placed = memory.placed.includes(keepsake)
        ? memory.placed.filter((id) => id !== keepsake)
        : memory.placed.length < MAX_PLACED ? [...memory.placed, keepsake] : null;
      return placed ? this.remember(species, { placed }) : false;
    },
    noteArrival(species, at) {
      if (!knownSpecies(species)) return false;
      const arrivals = validateMemory(state.get().record.memories[species]).arrivals;
      return this.remember(species, { arrivals: recordArrival(arrivals, at) });
    },
    getProgression(species) {
      return progressionOf(knownSpecies(species) ? state.get().record.progression[species] : null, species);
    },
    awardXp(species, kind, at = Date.now()) {
      if (!knownSpecies(species)) return 0;
      const { progress, gained } = rewardInteraction(state.get().record.progression[species], species, kind, at);
      if (gained) setProgression(species, progress);
      return gained;
    },
    addTogetherTime(species, seconds, at = Date.now()) {
      if (!knownSpecies(species)) return 0;
      const previous = progressionOf(state.get().record.progression[species], species);
      const { progress, gained } = advanceTogetherTime(previous, species, seconds, at);
      if (JSON.stringify(progress) !== JSON.stringify(previous)) setProgression(species, progress);
      return gained;
    },
    evolve(species) {
      if (!knownSpecies(species)) return false;
      const progress = progressionOf(state.get().record.progression[species], species);
      if (!canEvolve(species, progress)) return false;
      return setProgression(species, { ...progress, stage: progress.stage + 1 });
    },
  };
}
