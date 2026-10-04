# Artwork & attribution

## Pokémon sprites

The included original PNG sheets and animation XML come from [PMDCollab / SpriteCollab](https://github.com/PMDCollab/SpriteCollab), pinned to commit **29ba3aa2c026fffb47166d2ec647c47d1d9ff305** (retrieved 2026-10-04).

| Companion | Source directory | Credited artist | Included sheets |
| --- | --- | --- | --- |
| Bulbasaur | [sprite/0001](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0001) | CHUNSOFT | see below |
| Charmander | [sprite/0004](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0004) | CHUNSOFT | see below |
| Squirtle | [sprite/0007](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0007) | CHUNSOFT | see below |

Included sheets per species (unmodified): Idle, Walk, Sleep, Wake, Laying, Hop, Eat, Nod, Pose, LookUp, Sit, Rotate, DeepBreath — each `*-Anim.png` plus its matching `*-Shadow.png`. Only the `*-Anim.png` sheets are embedded in `plugin.js`; the shadow sheets are read at build time to find each frame's ground anchor (the white marker pixel), so sprites stand still on the ground even when a sheet shifts the body inside its frame.

The original `credits.txt` records are preserved beside each species in `assets/sprites/`. Runtime extracts frames according to `AnimData.xml`, uses the original eight directions, and draws sprites 1:1 on the same pixel grid as the garden. SpriteCollab durations are played at their native 60 ticks/second (walk cycles are paced to actual movement speed; sleep breathing is slowed).

These are official Pokémon Mystery Dungeon sprites attributed to CHUNSOFT, not original project artwork. Pokémon and related names/designs belong to Nintendo, Creatures, and GAME FREAK; game artwork retains its original owners' rights. This is an independent, non-commercial fan project and is not affiliated with or endorsed by those companies or Nous Research.

[SpriteCollab's submission/use policy](https://github.com/PMDCollab/SpriteCollab/blob/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/README.md#submission-and-use-policy) describes community submissions under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), and separately identifies official Chunsoft sprites. That policy is **not represented here as a copyright grant from the Pokémon rights holders for the official sprites**. The source-code MIT license does not cover these assets. Assess artwork rights independently before distributing a commercial product.

## Original garden & interface

Garden, pond, tree, sky, fireflies, particles, Poké Ball and Oran Berry pixel drawings, speech bubbles, and interface icons are original programmatically drawn artwork in `src/garden.js`, `src/ambient.js`, `src/renderer.js`, and `src/App.jsx`, covered by this project's MIT license (the Poké Ball and Oran Berry designs themselves belong to the Pokémon rights holders). No temporary placeholder art, external fonts, or remote runtime asset URLs are used.

## Replace the artwork

Replace a species' `<Anim>-Anim.png` / `<Anim>-Shadow.png` pairs (the list is `ANIMS` in `scripts/build.mjs`) and `AnimData.xml` under `assets/sprites/<species>/`. The build requires matching XML frame widths/heights/durations; rows must be one or eight, ordered down, down-right, right, up-right, up, up-left, left, down-left (SpriteCollab order). Each shadow frame should mark the ground point with one white pixel; without it the frame center + 4 px is used. Update this file and the species credits, then run `npm run build`. Assets become data URLs in the installable file; installation does not fetch artwork.
