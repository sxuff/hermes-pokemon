import test from "node:test";
import assert from "node:assert/strict";
import { signal } from "../src/signal.js";
import { createHermesBridge } from "../src/hermes.js";
function fixture() {
  const state = {
      focusedSessionId: signal("a"),
      busyBySession: signal({}),
      focusedSessionProfile: signal("default"),
    },
    vis = signal(true),
    events = new Map(),
    cleanups = [];
  const ctx = {
    onDispose: (fn) => cleanups.push(fn),
    onEvent: (type, fn) => {
      events.set(type, fn);
      return () => events.delete(type);
    },
  };
  const bridge = createHermesBridge({ state, paneVisibility: () => vis }, ctx);
  return {
    state,
    vis,
    bridge,
    events,
    cleanups,
    emit: (type, extra = {}) =>
      events.get(type)?.({
        type,
        session_id: "a",
        profile: "default",
        ...extra,
      }),
  };
}
test("focus switching and unrelated background turns do not cause celebrations", () => {
  const f = fixture();
  f.state.busyBySession.set({ b: true });
  assert.equal(f.bridge.activity.get().kind, "idle");
  f.state.focusedSessionId.set("b");
  assert.equal(f.bridge.activity.get().kind, "working");
  f.emit("message.complete", { payload: { status: "complete" } });
  assert.equal(f.bridge.activity.get().kind, "working");
  f.state.focusedSessionId.set("a");
  assert.equal(f.bridge.activity.get().kind, "idle");
});
test("success cheers, errors/interruption/replays do not; profile is checked", () => {
  const f = fixture();
  f.emit("message.complete", {
    payload: { status: "complete" },
    replayed: true,
  });
  assert.equal(f.bridge.activity.get().kind, "idle");
  f.emit("message.complete", {
    payload: { status: "complete" },
    profile: "other",
  });
  assert.equal(f.bridge.activity.get().kind, "idle");
  f.emit("message.complete", { payload: { status: "complete" } });
  assert.equal(f.bridge.activity.get().kind, "completed");
  for (const status of ["error", "interrupted"]) {
    f.emit("message.complete", { payload: { status } });
    assert.equal(f.bridge.activity.get().kind, "idle");
  }
});
test("clarify cue uses the documented tool event and ends only for its matching tool", () => {
  const f = fixture();
  f.state.busyBySession.set({ a: true });
  f.emit("tool.start", { payload: { name: "clarify", tool_id: "q" } });
  assert.equal(f.bridge.activity.get().kind, "waiting");
  f.emit("tool.complete", { payload: { name: "other", tool_id: "x" } });
  assert.equal(f.bridge.activity.get().kind, "waiting");
  f.emit("tool.complete", { payload: { name: "clarify", tool_id: "q" } });
  assert.equal(f.bridge.activity.get().kind, "working");
});
test("visibility follows host and dispose removes event/atom listeners", () => {
  const f = fixture();
  f.vis.set(false);
  assert.equal(f.bridge.visible.get(), false);
  const before = f.bridge.activity.get();
  f.cleanups.forEach((fn) => fn());
  assert.equal(f.events.size, 0);
  f.state.busyBySession.set({ a: true });
  assert.equal(f.bridge.activity.get(), before);
});
test("missing activity APIs degrade to ordinary garden behavior", () => {
  const bridge = createHermesBridge({}, { onDispose() {} });
  assert.equal(bridge.activity.get().kind, "idle");
  assert.equal(bridge.visible.get(), true);
  bridge.dispose();
});
