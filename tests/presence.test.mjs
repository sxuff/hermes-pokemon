import test from "node:test";
import assert from "node:assert/strict";
import { shouldGreet, WELCOME_ABSENCE_MS, GREETING_COOLDOWN_MS } from "../src/presence.js";
import { DEFAULT_MEMORY } from "../src/persistence.js";

test("a welcome needs a previous visit and at least a minute away", () => {
  const seen = 1_000_000;
  assert.equal(shouldGreet(DEFAULT_MEMORY, seen), false);
  assert.equal(shouldGreet({ ...DEFAULT_MEMORY, lastSeenAt: seen }, seen + WELCOME_ABSENCE_MS - 1), false);
  assert.equal(shouldGreet({ ...DEFAULT_MEMORY, lastSeenAt: seen }, seen + WELCOME_ABSENCE_MS), true);
});

test("returning repeatedly cannot greet more than once in five minutes", () => {
  const greeted = 1_000_000;
  const memory = { ...DEFAULT_MEMORY, lastSeenAt: greeted + 30_000, lastGreetingAt: greeted };
  assert.equal(shouldGreet(memory, greeted + 90_000), false);
  assert.equal(shouldGreet(memory, greeted + GREETING_COOLDOWN_MS - 1), false);
  assert.equal(shouldGreet(memory, greeted + GREETING_COOLDOWN_MS), true);
});

test("future or invalid clocks cannot create a welcome", () => {
  const now = 1_000_000;
  assert.equal(shouldGreet({ ...DEFAULT_MEMORY, lastSeenAt: now + 1 }, now), false);
  assert.equal(shouldGreet({ ...DEFAULT_MEMORY, lastSeenAt: 1, lastGreetingAt: now + 1 }, now), false);
  for (const invalid of [undefined, null, -1, NaN, Infinity, "100"]) {
    assert.equal(shouldGreet({ ...DEFAULT_MEMORY, lastSeenAt: invalid }, now), false);
    assert.equal(shouldGreet({ ...DEFAULT_MEMORY, lastSeenAt: 1, lastGreetingAt: invalid }, now), false);
  }
  for (const invalid of [null, -1, NaN, Infinity, "100"])
    assert.equal(shouldGreet({ ...DEFAULT_MEMORY, lastSeenAt: 1 }, invalid), false);
  assert.equal(shouldGreet(null, now), false);
});
