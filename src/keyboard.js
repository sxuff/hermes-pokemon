import { SPOTS, TREE, POND } from "./world.js";

// Keyboard access to the garden. The canvas takes focus; arrow keys move a focus ring between
// your companion and the places you can explore together; Enter or Space acts on the ring, exactly
// like a click there. Pure data and key handling, so it is unit-tested without a DOM.
export const TARGETS = [
  { id: "companion", label: "your companion", hint: "pet it", rx: 11, ry: 13 },
  { id: "tree", label: "the old tree", hint: "explore it together", point: { x: TREE.x, y: TREE.canopyY + 4 }, rx: 24, ry: 22 },
  { id: "pond", label: "the pond", hint: "explore it together", point: { x: POND.x, y: POND.y }, rx: POND.rx + 2, ry: POND.ry + 2 },
  { id: "flowers", label: "the flower bed", hint: "explore it together", point: { ...SPOTS.flowers }, rx: 11, ry: 7 },
  { id: "meadow", label: "the quiet meadow", hint: "call it over", point: { ...SPOTS.meadow }, rx: 12, ry: 7 },
];
const NEXT = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS = new Set(["ArrowLeft", "ArrowUp"]);
const hasFocus = (index) => Number.isInteger(index) && index >= 0 && index < TARGETS.length;

// What a key does with the current focus index (null when nothing is focused):
// { type: "move", index } | { type: "activate", index } | { type: "clear" } | null (not ours).
export function keyboardAction(key, current) {
  const has = hasFocus(current);
  if (NEXT.has(key)) return { type: "move", index: has ? (current + 1) % TARGETS.length : 0 };
  if (PREVIOUS.has(key)) return { type: "move", index: has ? (current + TARGETS.length - 1) % TARGETS.length : TARGETS.length - 1 };
  if (key === "Home") return { type: "move", index: 0 };
  if (key === "End") return { type: "move", index: TARGETS.length - 1 };
  if (key === "Enter" || key === " ") return has ? { type: "activate", index: current } : { type: "move", index: 0 };
  if (key === "Escape") return has ? { type: "clear" } : null;
  return null;
}

// Spoken for a screen reader when the ring moves.
export function announce(index) {
  const target = TARGETS[index];
  return target ? `${target.label[0].toUpperCase()}${target.label.slice(1)}. Press Enter to ${target.hint}.` : "";
}
