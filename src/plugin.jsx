import * as sdk from "@hermes/plugin-sdk";
import React from "react";
import { App } from "./App.jsx";
import { createPersistence } from "./persistence.js";
import { createHermesBridge, PLUGIN_ID } from "./hermes.js";
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
    const runtime = { runtimes: new Set() };
    ctx.onDispose(() => {
      runtime.runtimes.forEach((dispose) => dispose());
      runtime.runtimes.clear();
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
  },
};
