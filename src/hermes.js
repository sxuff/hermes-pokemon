import { signal } from "./signal.js";
import { toolKind } from "./tools.js";
export const PLUGIN_ID = "hermes-pokemon";
export const PANE_ID = `${PLUGIN_ID}:habitat`;
// A turn this long earns company while it runs and a bigger cheer when it lands.
export const LONG_TURN_MS = 180_000;
// Only documented read-only SDK atoms/events. No RPC, server-request handlers, or agent middleware.
// Activity: { kind, sequence, since?, duration?, long?, reason?, streak? }.
export function createHermesBridge(host, ctx, { now = Date.now } = {}) {
  const activity = signal({ kind: "idle", sequence: 0 });
  // What kind of tool Hermes just started: { kind: "web"|"terminal"|"files", sequence }.
  // Separate from `activity` so tool bursts never disturb the working/waiting state.
  const tool = signal({ kind: null, sequence: 0 });
  const visible = signal(true);
  const disposers = [];
  let disposed = false,
    focused = null,
    busy = false,
    waitingTool = null,
    // Wall-clock start of the focused session's current (or just-ended) turn.
    since = null,
    // Consecutive failed turns in the focused session. A user's Stop never counts.
    errors = 0;
  const state = host?.state || {};
  const focusAtom = state.focusedSessionId || state.activeSessionId;
  const read = (atom) => atom?.get?.();
  function emit(kind, extra = {}) {
    if (!disposed)
      activity.set({ kind, ...extra, sequence: activity.get().sequence + 1 });
  }
  const working = () => emit("working", { since });
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
      errors = 0;
      busy = nextBusy;
      // A turn already running in the newly focused session started at an unknown
      // time; count from now rather than guess.
      since = nextBusy ? now() : null;
      if (nextBusy) working();
      else emit("idle");
    } else if (nextBusy !== busy) {
      busy = nextBusy;
      waitingTool = null;
      if (nextBusy) {
        since = now();
        working();
      } else emit("idle"); // `since` stays: message.complete may follow the busy flag.
    }
  }
  for (const atom of [focusAtom, state.busyBySession || state.busy]) {
    if (atom?.subscribe) disposers.push(atom.subscribe(sync));
  }
  sync();
  function complete(payload) {
    waitingTool = null;
    const at = now();
    const duration = since !== null && at >= since ? at - since : 0;
    since = busy ? at : null;
    const status = payload?.status;
    if (status === "complete" && !payload?.error) {
      errors = 0;
      emit("completed", { duration, long: duration >= LONG_TURN_MS });
    } else if (status === "interrupted") {
      emit("failed", { reason: "interrupted", duration, streak: errors });
    } else {
      errors++;
      emit("failed", { reason: "error", duration, streak: errors });
    }
  }
  function event(e) {
    const id = read(focusAtom);
    if (!id || e.replayed || e.session_id !== id) return;
    const profile = read(state.focusedSessionProfile);
    if (e.profile && profile && e.profile !== profile) return;
    if (e.type === "message.complete") complete(e.payload);
    else if (e.type === "tool.start" && e.payload?.name === "clarify") {
      waitingTool = e.payload.tool_id;
      emit("waiting", { since });
    } else if (e.type === "tool.start") {
      const kind = toolKind(e.payload?.name);
      if (kind && !disposed) tool.set({ kind, sequence: tool.get().sequence + 1 });
    } else if (
      e.type === "tool.complete" &&
      e.payload?.tool_id === waitingTool
    ) {
      waitingTool = null;
      if (busy) working();
      else emit("idle");
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
    tool.clear();
    visible.clear();
  };
  ctx.onDispose(dispose);
  return { activity, tool, visible, dispose, now };
}
