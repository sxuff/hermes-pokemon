# Artwork & attribution

## Pokémon sprites

The included original PNG sheets and animation XML come from [PMDCollab / SpriteCollab](https://github.com/PMDCollab/SpriteCollab), pinned to commit **29ba3aa2c026fffb47166d2ec647c47d1d9ff305** (retrieved 2026-10-04).

| Companion | Source directory | Credited artist | Included sheets |
| --- | --- | --- | --- |
| Bulbasaur | [sprite/0001](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0001) | CHUNSOFT | Full set |
| Ivysaur | [sprite/0002](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0002) | CHUNSOFT | Core set |
| Venusaur | [sprite/0003](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0003) | CHUNSOFT | Core set |
| Charmander | [sprite/0004](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0004) | CHUNSOFT | Full set |
| Charmeleon | [sprite/0005](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0005) | CHUNSOFT, contributor `199989579682414592`, bwappi, Grimlin | Full set |
| Charizard | [sprite/0006](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0006) | CHUNSOFT, Emboarger | Core set |
| Squirtle | [sprite/0007](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0007) | CHUNSOFT | Full set |
| Wartortle | [sprite/0008](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0008) | CHUNSOFT | Core set |
| Blastoise | [sprite/0009](https://github.com/PMDCollab/SpriteCollab/tree/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0009) | CHUNSOFT | Core set |

**Full set:** Idle, Walk, Sleep, Wake, Laying, Hop, Eat, Nod, Pose, LookUp, Sit, Rotate, DeepBreath. **Core set:** Idle, Walk, Sleep, Hop, Rotate. Each included sheet is an unmodified `*-Anim.png` plus its matching `*-Shadow.png`. Only the `*-Anim.png` sheets are embedded in `plugin.js`; the shadow sheets are read at build time to find each frame's ground anchor (the white marker pixel), so sprites stand still on the ground even when a sheet shifts the body inside its frame.

The pinned source does not include the eight extended gestures for the five core-set forms. For **each of Ivysaur, Venusaur, Charizard, Wartortle, and Blastoise**, `Wake → Idle`, `Laying → Idle`, `Eat → Idle`, `Nod → Idle`, `Pose → Idle`, `LookUp → Idle`, `Sit → Idle`, and `DeepBreath → Idle` explicitly reuse that same form's original Idle animation and timing. The generated code shares its image data by reference; there are no fabricated PNGs, substituted Pokémon, or altered XML files. Original Walk, Sleep, Hop, and Rotate remain distinct. Bulbasaur, Charmander, Squirtle, and Charmeleon retain all thirteen actual sheets.

The original `credits.txt` records are preserved beside each species in `assets/sprites/`. Runtime extracts frames according to `AnimData.xml`, uses the original eight directions, and draws sprites 1:1 on the same pixel grid as the garden. SpriteCollab durations are played at their native 60 ticks/second (walk cycles are paced to actual movement speed; sleep breathing is slowed). Overlay clearance is measured from actual body pixels above the ground anchor rather than transparent frame padding.

These sets contain official Pokémon Mystery Dungeon sprites attributed to CHUNSOFT and the community additions/revisions identified below. They are not original project artwork. Pokémon and related names/designs belong to Nintendo, Creatures, and GAME FREAK; game artwork retains its original owners' rights. This is an independent, non-commercial fan project and is not affiliated with or endorsed by those companies or Nous Research.

[SpriteCollab's submission/use policy](https://github.com/PMDCollab/SpriteCollab/blob/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/README.md#submission-and-use-policy) describes community submissions under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), and separately identifies official Chunsoft sprites. That policy is **not represented here as a copyright grant from the Pokémon rights holders for the official sprites**. The source-code MIT license does not cover these assets. Assess artwork rights independently before distributing a commercial product.

### Community contributions

Names and contacts are taken from the pinned [artist registry](https://github.com/PMDCollab/SpriteCollab/blob/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/credit_names.txt); each form's original credit history is the authoritative record of overlapping contributions.

- **Charmeleon:** contributor Discord ID `199989579682414592` (no display name or contact supplied in that registry) contributed Wake, Laying, Eat, Nod, Pose, LookUp, Sit, and DeepBreath under the recorded `PMDCollab_1` terms. [bwappi](https://bsky.app/profile/bwappi.bsky.social), Discord ID `193530896211509248`, contributed Eat, Pose, DeepBreath, and Nod revisions under `CC_BY-NC_4`. [Grimlin](https://twitter.com/Griimlin), Discord ID `217653022094786560`, contributed Wake, Eat, Pose, Nod, Sit, LookUp, and Laying revisions under `CC_BY-NC_4`. See [Charmeleon's original credits](https://github.com/PMDCollab/SpriteCollab/blob/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0005/credits.txt).
- **Charizard:** Emboarger, Discord ID `237286997645983744`, contributed Hop, Rotate, and Sleep revisions under `PMDCollab_1`. See [Charizard's original credits](https://github.com/PMDCollab/SpriteCollab/blob/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/sprite/0006/credits.txt).

The recorded [PMDCollab_1 terms](https://github.com/PMDCollab/SpriteCollab/blob/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/license_history/LICENSE.PMDCollab_1.md) permit reuse and modification while retaining artist credit. The recorded [CC_BY-NC_4 terms](https://github.com/PMDCollab/SpriteCollab/blob/29ba3aa2c026fffb47166d2ec647c47d1d9ff305/license_history/LICENSE.CC_BY-NC_4.md) link the corresponding Attribution-NonCommercial license conditions. Our included files are byte-for-byte copies of the pinned upstream originals, including their existing revisions; no new artwork modifications were made for this project. These community terms do not expand rights in underlying official game artwork or character designs.

## Original garden & interface

Garden, pond, tree, sky, fireflies, particles, Poké Ball and Oran Berry pixel drawings, speech bubbles, and interface icons are original programmatically drawn artwork in `src/garden.js`, `src/ambient.js`, `src/renderer.js`, and `src/App.jsx`, covered by this project's MIT license (the Poké Ball and Oran Berry designs themselves belong to the Pokémon rights holders). No temporary placeholder art, external fonts, or remote runtime asset URLs are used.

## Replace the artwork

Replace a form's `<Anim>-Anim.png` / `<Anim>-Shadow.png` pairs (the list is `ANIMS` in `scripts/build.mjs`) and `AnimData.xml` under `assets/sprites/<form>/`. The explicit core-set fallbacks are controlled by `LIMITED_FORMS` and `IDLE_ALIASES` in that build script; remove a form from `LIMITED_FORMS` when supplying all thirteen real sheets. The build requires matching XML frame widths/heights/durations; rows must be one or eight, ordered down, down-right, right, up-right, up, up-left, left, down-left (SpriteCollab order). Each shadow frame should mark the ground point with one white pixel; without it the frame center + 4 px is used. Update this file and the form's credits, then run `npm run build`. Assets become data URLs in the installable file; installation does not fetch artwork.
