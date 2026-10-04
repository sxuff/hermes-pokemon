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
