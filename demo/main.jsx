import React from "react";
import { createRoot } from "react-dom/client";
// Exercise the installable artifact, including its registration and teardown, not a separate UI.
import plugin from "../dist/hermes-pokemon/plugin.js";
import { progressionOf, evolutionLevel, XP_PER_LEVEL, LEVEL_START } from "../src/progression.js";
import {
  events,
  simulate,
  subscriptions,
  visibility,
  host,
  emit,
} from "./mock-sdk.js";
const mount = document.querySelector("#plugin");
// Lets the preview (and its test scripts) reach the live Companion. Hermes never sets this.
globalThis.__hermesPokemonDebug = {};
const storage = {
  get: (key, fallback) => {
    const value = localStorage.getItem(`hermes-pokemon.demo.${key}`);
    return value ? JSON.parse(value) : fallback;
  },
  set: (key, value) =>
    localStorage.setItem(`hermes-pokemon.demo.${key}`, JSON.stringify(value)),
};
let dispose = () => {},
  enabled = false,
  generation = 0;
function enable() {
  if (enabled) return;
  enabled = true;
  generation++;
  const root = createRoot(mount),
    cleanups = [];
  let mounted = true;
  const unmount = () => { if (mounted) { mounted = false; root.unmount(); } };
  const ctx = {
    storage,
    onDispose: (fn) => cleanups.push(fn),
    register(contribution) {
      if (contribution.area !== "panes")
        throw new Error("Unexpected contribution");
      root.render(contribution.render());
      cleanups.push(unmount);
      return unmount;
    },
    onEvent(type, fn) {
      if (!events.has(type)) events.set(type, new Set());
      events.get(type).add(fn);
      const cleanup = () => events.get(type)?.delete(fn);
      cleanups.push(cleanup);
      return cleanup;
    },
  };
  plugin.register(ctx);
  dispose = () => {
    if (!enabled) return;
    // The real disk-plugin loader disposes in registration order.
    cleanups.forEach((fn) => fn());
    unmount();
    enabled = false;
  };
}
enable();
document.querySelectorAll("[data-event]").forEach((button) =>
  button.addEventListener("click", () => {
    simulate(button.dataset.event);
    document
      .querySelectorAll("[data-event]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    document.querySelector("#event-label").textContent = {
      working: "Hermes is working",
      completed: "A turn just finished",
      waiting: "A clarification is waiting",
      idle: "Nothing to do. Just be.",
    }[button.dataset.event];
  }),
);
document.querySelector("#theme").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector("#theme").textContent = dark
    ? "Light theme"
    : "Dark theme";
});
document.querySelector("#width").addEventListener("input", (e) => {
  document.querySelector(".demo-pane").style.width = `${e.target.value}px`;
  document.querySelector("#width-value").textContent = `${e.target.value} px`;
});
document.querySelector("#dock").addEventListener("click", (e) => {
  const bottom = document.body.classList.toggle("bottom-dock");
  e.target.textContent = bottom ? "Dock beside" : "Dock beneath";
});
document.querySelector("#hide").addEventListener("click", (e) => {
  visibility.set(!visibility.get());
  mount.style.visibility = visibility.get() ? "visible" : "hidden";
  e.target.textContent = visibility.get() ? "Hide pane" : "Show pane";
});
document.querySelector("#reload").addEventListener("click", () => {
  dispose();
  enable();
});
function simulateReturn() {
  const saved = storage.get("companion", null);
  if (!saved?.species) {
    document.querySelector("#event-label").textContent = "Choose your companion first, then try a simulated return.";
    return;
  }
  dispose();
  const record = storage.get("companion", null);
  const memories = record.memories || {};
  storage.set("companion", { ...record, memories: { ...memories,
    [record.species]: { ...memories[record.species], lastSeenAt: Date.now() - 120_000, lastGreetingAt: Date.now() - 360_000 },
  } });
  document.querySelector("#event-label").textContent = "Simulated: you returned after two minutes away.";
  enable();
}
document.querySelector("#return").addEventListener("click", simulateReturn);
function simulateGrowth(evolution) {
  const label = document.querySelector("#growth-label");
  if (!storage.get("companion", null)?.species) {
    label.textContent = "Choose a starter first, then try simulated growth.";
    return;
  }
  dispose();
  const record = storage.get("companion", null);
  const current = progressionOf(record.progression?.[record.species], record.species);
  const next = evolutionLevel(record.species, current.stage);
  const xp = evolution && next !== null ? Math.max(current.xp, (next - LEVEL_START) * XP_PER_LEVEL) : current.xp + (evolution ? 0 : XP_PER_LEVEL);
  storage.set("companion", { ...record, progression: { ...record.progression, [record.species]: { ...current, xp } } });
  label.textContent = evolution ? next === null ? "Already fully evolved. Enjoy the garden!" : "Simulated: evolution is ready. Choose it beneath the garden." : "Simulated: added one level of XP.";
  enable();
}
document.querySelector("#grow-level").addEventListener("click", () => simulateGrowth(false));
document.querySelector("#grow-evolution").addEventListener("click", () => simulateGrowth(true));
window.__demo = {
  simulate,
  emit,
  host,
  simulateReturn,
  enable,
  disable: () => dispose(),
  reload: () => {
    dispose();
    enable();
  },
  setVisible: (value) => visibility.set(value),
  diagnostics: () => ({
    enabled,
    generation,
    subscriptions: subscriptions(),
    styles: document.querySelectorAll("[data-hermes-pokemon]").length,
    canvases: mount.querySelectorAll("canvas").length,
    saved: storage.get("companion", null),
  }),
};
window.addEventListener("pagehide", () => dispose(), { once: true });
