import * as sdk from "@hermes/plugin-sdk";
import React from "react";
import { App, StatusItem } from "./App.jsx";
import { createPersistence } from "./persistence.js";
import { createHermesBridge, PLUGIN_ID, PANE_ID } from "./hermes.js";
import { signal } from "./signal.js";
import { commandsFor } from "./commands.js";
import css from "./styles.css";

export default {
  id: PLUGIN_ID,
  name: "Hermes Pokémon",
  defaultEnabled: true,
  register(ctx) {
    const style = document.createElement("style");
    style.dataset.hermesPokemon = __VERSION__;
    style.textContent = css;
    document.head.append(style);
    ctx.onDispose(() => style.remove());
    const store = createPersistence(ctx.storage);
    const bridge = createHermesBridge(sdk.host, ctx);
    // What the mounted garden is showing right now: { pet, species, form, nickname, caption }.
    const live = signal(null);
    const runtime = { runtimes: new Set(), live };
    ctx.onDispose(() => {
      runtime.runtimes.forEach((dispose) => dispose());
      runtime.runtimes.clear();
      live.set(null);
      live.clear();
      store.clear();
    });
    ctx.register({
      id: "habitat",
      area: sdk.PANES_AREA,
      title: "Hermes Pokémon",
      data: {
        placement: "right",
        dock: { pane: "workspace", pos: "right" },
        width: "370px",
        height: "330px",
      },
      render: () => <App store={store} ctx={runtime} bridge={bridge} />,
    });
    // Presence in the status bar while the pane is docked away; a click reveals the garden.
    if (sdk.STATUSBAR_AREAS?.right)
      ctx.register({
        id: "status",
        area: sdk.STATUSBAR_AREAS.right,
        order: 120,
        render: () => <StatusItem live={live} bridge={bridge} />,
      });
    for (const command of commandsFor(live, bridge.revealPane)) {
      if (sdk.PALETTE_AREA)
        ctx.register({ id: `palette-${command.id}`, area: sdk.PALETTE_AREA, data: { id: `${PLUGIN_ID}.${command.id}`, label: command.label, keywords: command.keywords, run: command.run } });
      if (sdk.KEYBINDS_AREA)
        ctx.register({ id: `key-${command.id}`, area: sdk.KEYBINDS_AREA, data: { id: `${PLUGIN_ID}.${command.id}`, label: command.label, category: "Hermes Pokémon", defaults: [], run: command.run } });
    }
  },
};
