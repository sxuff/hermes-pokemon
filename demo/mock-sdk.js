function atom(value) {
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const fn of listeners) fn(value);
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(value);
      return () => listeners.delete(fn);
    },
    count: () => listeners.size,
  };
}
export const PANES_AREA = "panes";
const focusedSessionId = atom("demo-session"),
  busyBySession = atom({}),
  focusedSessionProfile = atom("demo");
export const visibility = atom(true);
export const host = {
  state: { focusedSessionId, busyBySession, focusedSessionProfile },
  paneVisibility: () => visibility,
};
export const events = new Map();
export function emit(type, payload, session = focusedSessionId.get()) {
  for (const fn of events.get(type) || [])
    fn({ type, payload, session_id: session, profile: "demo" });
}
// The preview's clock can jump forward so a "long turn" can be seen without waiting.
let clockOffset = 0;
const realNow = Date.now.bind(Date);
Date.now = () => realNow() + clockOffset;
export function skipAhead(ms) {
  clockOffset += ms;
}
export function simulate(kind) {
  if (kind === "long") {
    // Simulated: a turn started and has been running for three minutes.
    busyBySession.set({});
    busyBySession.set({ [focusedSessionId.get()]: true });
    skipAhead(180_000);
  } else if (kind.startsWith("tool-")) {
    // Simulated: Hermes starts a tool while working.
    busyBySession.set({ [focusedSessionId.get()]: true });
    const name = { "tool-web": "web_search", "tool-terminal": "terminal", "tool-files": "write_file" }[kind];
    emit("tool.start", { name, tool_id: `demo-${name}-${realNow()}` });
  } else if (kind === "failed") {
    busyBySession.set({});
    emit("message.complete", { status: "error" });
  } else if (kind === "elsewhere") {
    // Simulated: a turn finished in a session that is not focused.
    emit("message.complete", { status: "complete" }, "demo-other-session");
  } else if (kind === "working") busyBySession.set({ [focusedSessionId.get()]: true });
  else if (kind === "completed") {
    busyBySession.set({});
    emit("message.complete", { status: "complete" });
  } else if (kind === "waiting") {
    busyBySession.set({ [focusedSessionId.get()]: true });
    emit("tool.start", { name: "clarify", tool_id: "demo-question" });
  } else {
    busyBySession.set({});
    emit("tool.complete", { name: "clarify", tool_id: "demo-question" });
  }
}
export function subscriptions() {
  return (
    focusedSessionId.count() +
    busyBySession.count() +
    visibility.count() +
    [...events.values()].reduce((n, set) => n + set.size, 0)
  );
}
