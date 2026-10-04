import { SPOTS } from "./world.js";

// Personality is data: where each starter likes to be and what it does there.
export const SPECIES = {
  bulbasaur: {
    name: "Bulbasaur",
    number: "001",
    type: "Grass",
    trait: "A little shade seeker",
    detail: "Happiest under the old garden tree.",
    favorite: "shade",
    napSpot: "shade",
    speed: 15,
    glow: false,
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
    glow: true, // tail flame lights up the garden at night
  },
  squirtle: {
    name: "Squirtle",
    number: "007",
    type: "Water",
    trait: "A curious pond explorer",
    detail: "Likes to watch the ripples — and sometimes dives in.",
    favorite: "bank",
    napSpot: "bank",
    speed: 17,
    glow: false,
  },
};
export const favoriteSpot = (species) => SPOTS[SPECIES[species].favorite];

// Canonical level-up thresholds, checked against PokeAPI evolution chains 1–3.
// https://pokeapi.co/api/v2/evolution-chain/1/ (and /2/, /3/)
export const EVOLUTION_LEVELS = {
  bulbasaur: [16, 32],
  charmander: [16, 36],
  squirtle: [16, 36],
};

// Appearance is separate from the starter lineage that owns personality and memories.
export const FORMS = {
  bulbasaur: { id: "bulbasaur", name: "Bulbasaur", number: "001", type: "Grass / Poison", lineage: "bulbasaur", stage: 0, hitWidth: 13, hitHeight: 14, bodyHeight: 20 },
  ivysaur: { id: "ivysaur", name: "Ivysaur", number: "002", type: "Grass / Poison", lineage: "bulbasaur", stage: 1, hitWidth: 16, hitHeight: 16, bodyHeight: 18 },
  venusaur: { id: "venusaur", name: "Venusaur", number: "003", type: "Grass / Poison", lineage: "bulbasaur", stage: 2, hitWidth: 18, hitHeight: 18, bodyHeight: 20 },
  charmander: { id: "charmander", name: "Charmander", number: "004", type: "Fire", lineage: "charmander", stage: 0, hitWidth: 13, hitHeight: 14, bodyHeight: 20 },
  charmeleon: { id: "charmeleon", name: "Charmeleon", number: "005", type: "Fire", lineage: "charmander", stage: 1, hitWidth: 18, hitHeight: 20, bodyHeight: 30 },
  charizard: { id: "charizard", name: "Charizard", number: "006", type: "Fire / Flying", lineage: "charmander", stage: 2, hitWidth: 20, hitHeight: 20, bodyHeight: 26 },
  squirtle: { id: "squirtle", name: "Squirtle", number: "007", type: "Water", lineage: "squirtle", stage: 0, hitWidth: 13, hitHeight: 14, bodyHeight: 20 },
  wartortle: { id: "wartortle", name: "Wartortle", number: "008", type: "Water", lineage: "squirtle", stage: 1, hitWidth: 16, hitHeight: 18, bodyHeight: 24 },
  blastoise: { id: "blastoise", name: "Blastoise", number: "009", type: "Water", lineage: "squirtle", stage: 2, hitWidth: 18, hitHeight: 20, bodyHeight: 24 },
};

export function formFor(lineage, stage = 0) {
  const safeStage = Number.isInteger(stage) && stage >= 0 && stage <= 2 ? stage : 0;
  return Object.values(FORMS).find((form) => form.lineage === lineage && form.stage === safeStage)?.id ?? null;
}
