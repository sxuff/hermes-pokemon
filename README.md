# Hermes Pokémon · 0.5.0

A small pixel-art garden beside your Hermes conversation. Choose Bulbasaur, Charmander, or Squirtle, give it a nickname, and spend a little time together.

![Hermes Pokémon garden in the browser preview](https://raw.githubusercontent.com/sxuff/hermes-pokemon/v0.5.0/docs/images/habitat.png)

*Browser preview with simulated Hermes events.*

## Install in Hermes Desktop

With Hermes 0.21.5 or later, install directly from this repository:

```sh
hermes plugins install sxuff/hermes-pokemon
```

Open **Capabilities → Plugins**, rescan if needed, and enable **Hermes Pokémon**. The repository includes a ready-to-run desktop bundle; users do not need Node.js. Drag the pane tab beside or beneath the conversation.

Alternatively, download the ZIP and matching SHA256 file from [Releases](https://github.com/sxuff/hermes-pokemon/releases). Extract its **`hermes-pokemon`** folder into:

```text
$HERMES_HOME/desktop-plugins/hermes-pokemon/
  plugin.js
  README.md
  CREDITS.md
  LICENSE
  build-info.json
  docs/
```

`HERMES_HOME` defaults to `~/.hermes` (`%USERPROFILE%\.hermes` on Windows). Run **Reload desktop plugins** from the command palette if needed. Use one install method: before switching from a manual ZIP install to the repository package, move the old `desktop-plugins/hermes-pokemon` folder elsewhere, because Hermes preserves hand-installed copies. Closing the only pane disables the plugin; re-enable it in Plugins.

The plugin uses the public [Desktop Plugin SDK](https://github.com/NousResearch/hermes-agent/blob/439334127f012e1ee0685acd5dba288e459af0ec/website/docs/developer-guide/desktop-plugin-sdk.md). All artwork is bundled; it needs no backend, credentials, model calls, or runtime network access.

## Controls

- Choose a starter, optionally enter a nickname, then select **Meet your companion**.
- **Click the Pokémon** (or **Pet**) for hearts. Pet it a few times in a row for a happier reaction. Petting a napping Pokémon wakes it gently first.
- **Click the grass** to call it over. Click the tree, pond or flowers to investigate together, with a different little reaction from each starter.
- **Ball** throws a Poké Ball. It bounces and rolls; your Pokémon chases it, carries it back, then pauses proudly to present it.
- **Berry** drops an Oran Berry nearby; your Pokémon looks up in anticipation, nods, walks over and eats it.
- **Settings**: rename, change starter, reset position, **garden light** (follow your clock, or pin dawn/day/dusk/night), and extra quiet motion. System reduced motion is always respected. Escape closes settings.

## Life in the garden

Each starter has its own routine on top of wandering, napping (lie down → sleep → wake and stretch), playing (spins, hops, a visiting butterfly) and sniffing the flower bed:

- **Bulbasaur** sits in the shade of the old tree, looking up at the leaves, and sometimes tends the flower bed.
- **Charmander** takes a deep breath in the sunny patch and lies down to bask, with a little ritual to warm its paws. At dusk and night its tail flame lights up the grass.
- **Squirtle** sits on the bank watching the ripples, makes a few ripples of its own, and sometimes hops in for a paddle around the pond.

Return after at least **one minute away** and your companion walks over for a heart and a happy hop. Welcomes have a **five-minute cooldown**, skip the first visit, and wait for ongoing play to finish. With reduced motion, the greeting stays in place.

When things are quiet, your companion sometimes carries a ball over and rolls it toward you: a small invitation to play. Press **Ball** for a game, or let it return to its own routine. Reduced motion keeps these autonomous invitations off and turns garden investigations into a glance in place.

The garden itself moves: clouds drift, the pond shimmers and ripples (watch for the fish), reeds and grass sway, leaves fall from the tree, and fireflies come out at night.

Each starter quietly remembers a favorite resting spot learned from your interactions and the last thing you did together. It returns to that spot on a later visit and uses it for naps. Settings shows these small memories; there are no hunger meters or chores.

Species, nickname, motion, garden light, per-species memories and growth persist across reloads. Older saves migrate automatically. Exact position and transient reactions are not saved.

## XP & evolution

Start at **level 5** and earn **30 XP per level**, up to level 50. The growth strip below the controls shows your current form, level and XP. Each starter keeps its own progress when you switch companions.

| Time together or activity | XP | Reward frequency |
| --- | --- | --- |
| Visible garden while Hermes has focus | 3 | Every active minute |
| Pet | 2 | Once per 30 seconds |
| Throw ball | 8 | Once per minute |
| Give berry | 5 | Once per minute |
| Call over or investigate scenery | 2 | Shared 30-second cooldown |

Activities stay playable during their XP cooldown. Autonomous behavior and Hermes messages do not award interaction XP. Hidden, unfocused and offline time earns no XP; nothing decays while you are away. Reloading preserves cooldowns and partial active minutes.

| Starter | First evolution | Final evolution |
| --- | --- | --- |
| Bulbasaur | Ivysaur · level 16 | Venusaur · level 32 |
| Charmander | Charmeleon · level 16 | Charizard · level 36 |
| Squirtle | Wartortle · level 16 | Blastoise · level 36 |

Evolution is **optional**. When ready, choose the evolution offer, preview the next form, and confirm—or choose **Not now**. Your companion finishes its current activity before evolving. The short transition has no flashing effect and becomes a still cue with reduced motion. Nickname, XP and memories carry over. You can keep a form indefinitely and keep leveling; each evolution is a separate choice. Reset position never resets growth.

All nine forms use bundled real sprite sheets. Some evolved forms have fewer source poses and reuse their own idle pose for unavailable gestures; see [CREDITS.md](CREDITS.md) for exact mappings.

The preview's **Simulate a level** and **Preview evolution** buttons let you try growth immediately. These controls exist only in the browser demo and never change your Hermes save.

## Browser preview & development

For development, use Node.js 22+:

```sh
npm ci
npm run build
npm test
npm run package
npm run demo
```

Open [the local preview](http://127.0.0.1:4173). It loads the **actual built plugin** with a simulated SDK and explicitly labeled simulated events, including a simulated return to preview the welcome. Its localStorage is separate from Hermes plugin storage. Resize the pane, dock it beneath, switch themes, hide it, or reload it. `npm run install:plugin` installs the build into your local Hermes plugin directory, backing up an existing `plugin.js` first.

`npm run build` updates the committed `desktop/plugin.js` and the disk-install folder. `npm run package` verifies the bundle checksum and creates `release/hermes-pokemon-0.5.0.zip` with a matching `.sha256` file. The package uses `plugin.yaml` + `desktop/plugin.js`; source structure, storage and release details are in [docs/SDK.md](docs/SDK.md).

## Hermes awareness & compatibility

- **Working**: your Pokémon turns to you, nods, and shows a “…” bubble.
- **Completed**: a successful turn gets a hop, a pose and a little confetti. Errors and interruptions do not celebrate.
- **Waiting**: a focused `clarify` tool call gets a “?” bubble. Other kinds of pending input may not be detectable.
- Cues never cancel a fetch, a berry, a pet or a nap (a napping Pokémon just shows the bubble). Missing activity APIs leave the garden fully usable.
- Animation pauses while hidden. Narrow panes, light/dark themes, reduced motion and clean disable/reload are supported.

## Verification

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for completed checks and remaining limits. Browser simulation and native Hermes checks are recorded separately; the hero image above is a browser preview.

This is an independent fan project. Original code is MIT-licensed; bundled Mystery Dungeon artwork is excluded from that license. See [CREDITS.md](CREDITS.md) for sources, rights and asset replacement. Battles, trading, multiple pets and additional habitats are left for later.
