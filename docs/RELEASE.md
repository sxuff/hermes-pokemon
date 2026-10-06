Hermes Pokémon v0.6.2 makes the companion react to the rhythm of your Hermes work and brings the garden to life with seasons, weather and visitors, for Hermes Desktop 0.21.5+.

**0.6.2:** fixes two night-time visual glitches: a hard dark line across the top of the tree and sky, and the pond's moon reflection and shimmer lining up into a stack of bars.

**0.6.1:** rain now comes as short showers (3 to 6 minutes, at most three a day, fading in and out) instead of all-day rain, and the companion has more varied movement: eight extra gestures from the same pinned sprite source, no back-to-back repeated routines, and varied pacing.

- **Long turns**: after Hermes has worked for 3 minutes, your Pokémon comes over and sits beside you with a “…” bubble until the turn ends. A long turn that succeeds gets a bigger cheer.
- **Failed turns**: an error or a stopped turn gets a quiet nod, with no confetti. Two errors in a row bring the ball over, a small invitation to take a break. This happens at most once every 10 minutes and never with reduced motion. Stopping a turn yourself never counts as an error.
- **Seasons**: spring blossoms, summer fireflies, autumn leaves that fall and float on the pond, and gentle winter snow and frost. Each starter has one seasonal habit. The season follows the calendar, or you can pin one in Settings. There's also a Southern Hemisphere option.
- **Keepsakes**: exploring the tree, pond or flowers together can turn up one of 13 small finds, some only in certain seasons. Settings shows the collection.
- **Your rhythm**: your companion learns when you usually arrive. After three days at a similar time, it's already waiting in its favorite spot when you come back at that time.
- **What Hermes is doing**: a web search sends your Pokémon to look over the fence, a terminal command gets a curious head tilt, and writing files gets a little dig. It reads only the tool name, never arguments or results, and reacts at most once every 20 seconds.
- **Showers**: some days have a few short showers, picked from the date with no weather service. Squirtle splashes, Charmander shelters under the tree, and Bulbasaur turns its bulb up to the rain. You can also pin clear or rain.
- **Late nights**: from 1am to 5am it yawns, naps more, and may doze off beside you during a long turn. A finished turn wakes it to cheer.
- **Wild visitors**: now and then a Pidgey, Caterpie, Magikarp or Hoothoot stops by, depending on season and time of day, and your companion watches. All four use original sprites from the same pinned source.
- **Keepsakes in the garden**: set out up to four of your keepsakes, and your companion sometimes goes to check on one.
- **Milestones**: day 30, day 100 and each anniversary get a small celebration, and Settings shows your days together.
- Saves migrate from v4 to v5 automatically. Nickname, settings, memories and growth are kept. Learning arrival times adds no extra storage writes.
- Everything from v0.5 is unchanged: three starters, nine companion sprite sets, local XP and optional evolution.

Install with `hermes plugins install sxuff/hermes-pokemon`, or extract the ZIP's `hermes-pokemon` folder into `$HERMES_HOME/desktop-plugins/`. Choose one method; see the README when switching from a manual install. The Git package contains a prebuilt `desktop/plugin.js`, so end users do not need Node.js.

The release includes a SHA256 file for the ZIP. Runtime uses bundled assets, the documented Desktop SDK and the plugin's own storage. It has no model calls, credentials, backend or runtime network requests.

An independent fan project. Original code is MIT; bundled CHUNSOFT Pokémon sprites and SpriteCollab community contributions retain their respective rights and are excluded from that license. See [CREDITS.md](https://github.com/sxuff/hermes-pokemon/blob/v0.6.2/CREDITS.md). The NousResearch catalog PR remains a draft and is subject to maintainer review.

Executed checks and native-versus-demo limits are recorded in [docs/VERIFICATION.md](https://github.com/sxuff/hermes-pokemon/blob/v0.6.2/docs/VERIFICATION.md).
