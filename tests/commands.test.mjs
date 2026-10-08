import test from "node:test";
import assert from "node:assert/strict";
import { commandsFor } from "../src/commands.js";
import { signal } from "../src/signal.js";
import { Companion } from "../src/behavior.js";
import { createHermesBridge } from "../src/hermes.js";

test("palette commands act on the live companion and do nothing without one", () => {
  const live = signal(null);
  let revealed = 0;
  const commands = commandsFor(live, () => { revealed++; return true; });
  const by = Object.fromEntries(commands.map((c) => [c.id, c]));
  assert.deepEqual(Object.keys(by), ["show", "pet", "ball", "berry"]);
  for (const c of commands) assert.ok(c.label.startsWith("Hermes Pokémon: ") && c.keywords.length, c.id);
  assert.equal(by.pet.run(), false, "no garden mounted");
  assert.equal(by.ball.run(), false);
  assert.ok(by.show.run());
  assert.equal(revealed, 1);
  const pet = new Companion("squirtle");
  live.set({ pet });
  assert.equal(by.pet.run(), true);
  assert.equal(pet.bubble?.kind, "heart");
  assert.equal(by.ball.run(), true);
  assert.ok(pet.fetching);
  assert.equal(by.berry.run(), false, "fetch is never interrupted, even from the palette");
});
test("the composer and pane doors are optional and never throw", () => {
  const bare = createHermesBridge({}, { onDispose() {} });
  assert.equal(bare.focusComposer(), false);
  assert.equal(bare.revealPane(), false);
  const calls = [];
  const host = { composer: { focus: (id) => calls.push(["focus", id]) }, revealPane: (id) => calls.push(["reveal", id]) };
  const bridge = createHermesBridge(host, { onDispose() {} });
  assert.equal(bridge.focusComposer(), true);
  assert.equal(bridge.revealPane(), true);
  assert.deepEqual(calls, [["focus", null], ["reveal", "hermes-pokemon:habitat"]]);
  const broken = createHermesBridge({ composer: { focus() { throw new Error("gone"); } } }, { onDispose() {} });
  assert.equal(broken.focusComposer(), false);
});
