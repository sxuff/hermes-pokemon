Hermes Pokémon v0.5.0 adds XP and optional evolution to the companion garden for Hermes Desktop 0.21.5+.

- Choose Bulbasaur, Charmander or Squirtle, nickname it, and share a living pixel-art garden.
- Pet, feed a berry, play fetch, and click the tree, pond or flowers to investigate together.
- Each starter has signature habits, quiet memories and a welcome-back greeting.
- Earn XP from active time together, pets, fetch, berries and exploration. Start at level 5, gain a level every 30 XP, and grow to level 50. Interaction cooldowns persist across reloads; hidden and offline time do not award XP.
- All three full evolution lines are included: Ivysaur/Venusaur, Charmeleon/Charizard, and Wartortle/Blastoise. Evolution becomes available at the familiar levels and happens only when you choose it. Nicknames, XP and memories stay with your companion.
- Nine real sprite sets are bundled. Some evolved forms reuse their own Idle animation for unavailable gestures; exact mappings and community artist credits are documented.
- Each starter keeps separate progress when you switch. Older saves migrate safely; resetting position leaves growth intact. The demo includes clearly labeled growth simulations.
- Supports narrow/resizable panes, host themes, reduced motion, hidden pausing and clean plugin reloads.

Install with `hermes plugins install sxuff/hermes-pokemon`, or extract the ZIP's `hermes-pokemon` folder into `$HERMES_HOME/desktop-plugins/`. Choose one method; see the README when switching from a manual install. The Git package contains a prebuilt `desktop/plugin.js`; end users do not need Node.js.

The release includes a SHA256 file for the ZIP. Runtime uses bundled assets, the documented Desktop SDK and the plugin's own storage. It has no model calls, credentials, backend or runtime network requests.

An independent fan project. Original code is MIT; bundled CHUNSOFT Pokémon sprites and SpriteCollab community contributions retain their respective rights and are excluded from that license. See [CREDITS.md](https://github.com/sxuff/hermes-pokemon/blob/v0.5.0/CREDITS.md). The NousResearch catalog PR remains a draft and is subject to maintainer review.

Executed checks and native-versus-demo limits are recorded in [docs/VERIFICATION.md](https://github.com/sxuff/hermes-pokemon/blob/v0.5.0/docs/VERIFICATION.md).
