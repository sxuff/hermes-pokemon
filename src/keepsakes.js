// Small things found while exploring the garden together. Collected once each, kept as a
// memory: nothing to feed, spend or maintain. Seasonal finds give a reason to look again later.
export const KEEPSAKES = {
  "green-leaf": { label: "Perfect green leaf", name: "a perfect green leaf", place: "tree", seasons: ["spring", "summer"] },
  blossom: { label: "Cherry blossom", name: "a cherry blossom", place: "tree", seasons: ["spring"] },
  "red-leaf": { label: "Red maple leaf", name: "a red maple leaf", place: "tree", seasons: ["autumn"] },
  acorn: { label: "Acorn", name: "an acorn", place: "tree", seasons: ["autumn"] },
  pinecone: { label: "Frosty pinecone", name: "a frosty pinecone", place: "tree", seasons: ["winter"] },
  pebble: { label: "Smooth pebble", name: "a smooth pebble", place: "pond" },
  shell: { label: "Tiny shell", name: "a tiny shell", place: "pond", seasons: ["summer"] },
  "lily-flower": { label: "Lily flower", name: "a lily flower", place: "pond", seasons: ["spring", "summer"] },
  "sparkly-stone": { label: "Sparkly stone", name: "a sparkly stone", place: "pond", seasons: ["autumn", "winter"] },
  petal: { label: "Pink petal", name: "a pink petal", place: "flowers", seasons: ["spring", "summer"] },
  feather: { label: "Bird feather", name: "a bird feather", place: "flowers" },
  seed: { label: "Sunflower seed", name: "a sunflower seed", place: "flowers", seasons: ["summer", "autumn"] },
  snowdrop: { label: "Snowdrop", name: "a snowdrop", place: "flowers", seasons: ["winter"] },
};
export const KEEPSAKE_COUNT = Object.keys(KEEPSAKES).length;
export const FIND_CHANCE = 0.3;
// Simulation seconds between finds, so a keepsake stays a small surprise.
export const FIND_COOLDOWN = 90;

export const isKeepsake = (id) => typeof id === "string" && Object.hasOwn(KEEPSAKES, id);

// Keepsakes you choose to set out in the garden. Fixed, open ground spots so a decoration
// never blocks a path or hides the pond; placed in the order you choose them.
export const DECOR_SLOTS = [
  { x: 46, y: 75 },
  { x: 98, y: 89 },
  { x: 62, y: 107 },
  { x: 132, y: 85 },
];
export const MAX_PLACED = DECOR_SLOTS.length;

// Returns a not-yet-collected keepsake for this place and season, or null.
export function findKeepsake(place, season, owned, random = Math.random) {
  const candidates = Object.entries(KEEPSAKES)
    .filter(([id, k]) => k.place === place && (!k.seasons || k.seasons.includes(season)) && !owned.has(id))
    .map(([id]) => id);
  if (!candidates.length || random() >= FIND_CHANCE) return null;
  return candidates[Math.floor(random() * candidates.length) % candidates.length];
}
