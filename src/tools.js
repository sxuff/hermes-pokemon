// What Hermes is doing, in garden terms. Only tool names from the public tool.start event are
// read; arguments and results are never inspected. Unknown tools simply get no reaction.
const WEB = new Set(["web_search", "web_extract", "x_search"]);
const TERMINAL = new Set(["terminal", "execute_code", "process_manage", "read_terminal", "close_terminal"]);
const FILES = new Set(["write_file", "patch"]);

export const TOOL_KINDS = ["web", "terminal", "files"];
// Simulation seconds between tool reactions: agents call tools in bursts.
export const TOOL_COOLDOWN = 20;

export function toolKind(name) {
  if (typeof name !== "string") return null;
  if (WEB.has(name) || name.startsWith("browser_")) return "web";
  if (TERMINAL.has(name)) return "terminal";
  if (FILES.has(name)) return "files";
  return null;
}
