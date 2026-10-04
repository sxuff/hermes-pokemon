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
export function simulate(kind) {
  if (kind === "working") busyBySession.set({ [focusedSessionId.get()]: true });
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
