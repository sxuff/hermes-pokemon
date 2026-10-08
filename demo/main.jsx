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
const keybinds = new Map();
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
      if (contribution.area === "panes") {
        root.render(contribution.render());
        cleanups.push(unmount);
        return unmount;
      }
      if (contribution.area === "statusBar.right" || contribution.area === "statusBar.left") {
        // Simulated status bar in the pane chrome.
        const slot = document.querySelector("#statusbar");
        const barRoot = createRoot(slot);
        barRoot.render(contribution.render());
        const cleanup = () => barRoot.unmount();
        cleanups.push(cleanup);
        return cleanup;
      }
      if (contribution.area === "palette") {
        const button = document.createElement("button");
        button.textContent = contribution.data.label.replace("Hermes Pokémon: ", "");
        button.dataset.command = contribution.data.id;
        button.addEventListener("click", () => { contribution.data.run(); });
        document.querySelector("#palette").append(button);
        const cleanup = () => button.remove();
        cleanups.push(cleanup);
        return cleanup;
      }
      if (contribution.area === "keybinds") {
        keybinds.set(contribution.data.id, contribution.data);
        const cleanup = () => keybinds.delete(contribution.data.id);
        cleanups.push(cleanup);
        return cleanup;
      }
      throw new Error(`Unexpected contribution area: ${contribution.area}`);
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
      long: "Simulated: Hermes has been working for 3 minutes. Press Completed to finish it.",
      failed: "Simulated: a turn ended with an error. Try it twice in a row.",
      "tool-web": "Simulated: Hermes is searching the web. Reactions are spaced about 20 s apart.",
      "tool-terminal": "Simulated: Hermes is running a command. Reactions are spaced about 20 s apart.",
      "tool-files": "Simulated: Hermes is writing files. Reactions are spaced about 20 s apart.",
      elsewhere: "Simulated: a turn finished in a chat you are not looking at. Glances are spaced about 30 s apart.",
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
document.addEventListener("demo:reveal-pane", () => {
  visibility.set(true);
  mount.style.visibility = "visible";
  document.querySelector("#hide").textContent = "Hide pane";
  document.querySelector("#event-label").textContent = "Simulated: the status bar brought the garden back.";
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
document.querySelector("#visitor").addEventListener("click", () => {
  const runtime = globalThis.__hermesPokemonDebug?.runtime?.();
  const ok = runtime?.summonVisitor();
  document.querySelector("#event-label").textContent = ok
    ? `Simulated: a wild ${runtime.visitor.species[0].toUpperCase() + runtime.visitor.species.slice(1)} stops by.`
    : "No visitor right now: it may be raining, winter daytime, extra quiet mode, or someone is already here.";
});
// Simulated: you met 100 days ago and are back after a short break. Day 30 is recorded quietly,
// day 100 is celebrated, and both leave something in the garden.
document.querySelector("#milestone").addEventListener("click", () => {
  const record = storage.get("companion", null);
  if (!record?.species) {
    document.querySelector("#event-label").textContent = "Choose your companion first, then try a simulated milestone.";
    return;
  }
  dispose();
  const memories = record.memories || {}, now = Date.now();
  storage.set("companion", { ...record, memories: { ...memories,
    [record.species]: { ...memories[record.species], metAt: now - 100 * 86_400_000, milestones: [], lastSeenAt: now - 120_000, lastGreetingAt: now - 3_600_000 },
  } });
  document.querySelector("#event-label").textContent = "Simulated: day 100 together. The bench and the lantern are yours to keep.";
  enable();
});
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
  keybinds: () => [...keybinds.values()].map((k) => ({ id: k.id, label: k.label, defaults: k.defaults })),
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
