// Palette commands and (unbound by default, user-rebindable) keybinds act on the live
// companion. Each returns false when no garden is mounted, so a stray key does nothing.
export function commandsFor(live, reveal) {
  const pet = () => live.get()?.pet ?? null;
  return [
    { id: "show", label: "Hermes Pokémon: Show the garden", keywords: ["pokemon", "garden", "companion"], run: () => reveal() },
    { id: "pet", label: "Hermes Pokémon: Pet", keywords: ["pokemon", "pet", "companion"], run: () => Boolean(pet()?.pet()) },
    { id: "ball", label: "Hermes Pokémon: Throw the ball", keywords: ["pokemon", "ball", "fetch"], run: () => Boolean(pet()?.throwBall()) },
    { id: "berry", label: "Hermes Pokémon: Give a berry", keywords: ["pokemon", "berry", "treat"], run: () => Boolean(pet()?.giveTreat()) },
  ];
}
