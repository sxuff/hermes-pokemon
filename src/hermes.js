import { signal } from "./signal.js";
export const PLUGIN_ID = "hermes-pokemon";
export const PANE_ID = `${PLUGIN_ID}:habitat`;
// Only documented read-only SDK atoms/events. No RPC, server-request handlers, or agent middleware.
export function createHermesBridge(host, ctx) {
  const activity = signal({ kind: "idle", sequence: 0 });
  const visible = signal(true);
  const disposers = [];
  let disposed = false,
    focused = null,
    busy = false,
    waitingTool = null;
  const state = host?.state || {};
  const focusAtom = state.focusedSessionId || state.activeSessionId;
  const read = (atom) => atom?.get?.();
  function emit(kind) {
    if (!disposed)
      activity.set({ kind, sequence: activity.get().sequence + 1 });
  }
  function sync() {
    const nextFocus = read(focusAtom) || null;
    const nextBusy = nextFocus
      ? Boolean(
          state.busyBySession
            ? read(state.busyBySession)?.[nextFocus]
            : read(state.busy),
        )
      : false;
    if (focused !== nextFocus) {
      focused = nextFocus;
      waitingTool = null;
      busy = nextBusy;
      emit(nextBusy ? "working" : "idle");
    } else if (nextBusy !== busy) {
      busy = nextBusy;
      waitingTool = null;
      emit(nextBusy ? "working" : "idle");
    }
  }
  for (const atom of [focusAtom, state.busyBySession || state.busy]) {
    if (atom?.subscribe) disposers.push(atom.subscribe(sync));
  }
  sync();
  function event(e) {
    const id = read(focusAtom);
    if (!id || e.replayed || e.session_id !== id) return;
    const profile = read(state.focusedSessionProfile);
    if (e.profile && profile && e.profile !== profile) return;
    if (e.type === "message.complete") {
      waitingTool = null;
      emit(
        e.payload?.status === "complete" && !e.payload?.error
          ? "completed"
          : "idle",
      );
    } else if (e.type === "tool.start" && e.payload?.name === "clarify") {
      waitingTool = e.payload.tool_id;
      emit("waiting");
    } else if (
      e.type === "tool.complete" &&
      e.payload?.tool_id === waitingTool
    ) {
      waitingTool = null;
      emit(busy ? "working" : "idle");
    }
  }
  if (typeof ctx.onEvent === "function") {
    for (const type of ["message.complete", "tool.start", "tool.complete"])
      disposers.push(ctx.onEvent(type, event));
  }
  if (typeof host?.paneVisibility === "function") {
    const atom = host.paneVisibility(PANE_ID);
    if (atom?.subscribe)
      disposers.push(atom.subscribe(() => visible.set(Boolean(atom.get()))));
    if (atom?.get) visible.set(Boolean(atom.get()));
  }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposers.splice(0).forEach((fn) => fn?.());
    activity.clear();
    visible.clear();
  };
  ctx.onDispose(dispose);
  return { activity, visible, dispose };
}
