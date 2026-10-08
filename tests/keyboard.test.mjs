import test from "node:test";
import assert from "node:assert/strict";
import { TARGETS, keyboardAction, announce } from "../src/keyboard.js";
import { onTree, inPond, walkable, SPOTS } from "../src/world.js";

test("arrow keys cycle the focus ring, Enter acts, Escape clears, other keys are left alone", () => {
  assert.deepEqual(keyboardAction("ArrowRight", null), { type: "move", index: 0 }, "first press lands on the companion");
  assert.deepEqual(keyboardAction("ArrowLeft", null), { type: "move", index: TARGETS.length - 1 });
  assert.deepEqual(keyboardAction("ArrowDown", 1), { type: "move", index: 2 });
  assert.deepEqual(keyboardAction("ArrowUp", 0), { type: "move", index: TARGETS.length - 1 }, "wraps around");
  assert.deepEqual(keyboardAction("ArrowRight", TARGETS.length - 1), { type: "move", index: 0 });
  assert.deepEqual(keyboardAction("Home", 3), { type: "move", index: 0 });
  assert.deepEqual(keyboardAction("End", 0), { type: "move", index: TARGETS.length - 1 });
  assert.deepEqual(keyboardAction("Enter", 2), { type: "activate", index: 2 });
  assert.deepEqual(keyboardAction(" ", 4), { type: "activate", index: 4 });
  assert.deepEqual(keyboardAction("Enter", null), { type: "move", index: 0 }, "Enter with no ring first selects the companion");
  assert.deepEqual(keyboardAction("Escape", 1), { type: "clear" });
  assert.equal(keyboardAction("Escape", null), null, "nothing to clear: the host keeps the key");
  for (const key of ["Tab", "a", "Shift", "PageDown", "", undefined]) assert.equal(keyboardAction(key, 1), null, String(key));
  assert.deepEqual(keyboardAction("ArrowRight", 99), { type: "move", index: 0 }, "a stale index is treated as none");
});
test("every target points where a click there would land", () => {
  const by = Object.fromEntries(TARGETS.map((t) => [t.id, t]));
  assert.equal(by.companion.point, undefined, "the companion is wherever it is right now");
  assert.ok(onTree(by.tree.point));
  assert.ok(inPond(by.pond.point));
  assert.ok(Math.hypot(by.flowers.point.x - SPOTS.flowers.x, by.flowers.point.y - SPOTS.flowers.y) < 10);
  assert.ok(walkable(by.meadow.point) && by.meadow.point.y > 44, "the meadow is a call-over spot");
  for (const t of TARGETS) assert.ok(t.rx > 0 && t.ry > 0 && t.label && t.hint, t.id);
  assert.equal(announce(1), "The old tree. Press Enter to explore it together.");
  assert.equal(announce(0), "Your companion. Press Enter to pet it.");
  assert.equal(announce(null), "");
});
