// Garden geometry in art pixels. Sprites are drawn 1:1 in this space, so the garden and the
// Pokémon share one pixel grid. Everything here is pure data/math (no DOM) and unit-tested.
export const WORLD = { width: 160, height: 120 };

export const POND = { x: 116, y: 63, rx: 23, ry: 11 };
export const TREE = { x: 27, y: 58, canopyY: 25 };
export const SUN_PATCH = { x: 76, y: 56, rx: 19, ry: 8 };
export const HOME = { x: 80, y: 102 }; // Where you "stand": fetch returns here.

export const SPOTS = {
  shade: { x: 31, y: 70 },
  sun: { x: 76, y: 57 },
  bank: { x: 114, y: 82 },
  flowers: { x: 22, y: 98 },
  meadow: { x: 58, y: 84 },
};

const inEllipse = (p, e, grow = 0) =>
  ((p.x - e.x) / (e.rx + grow)) ** 2 + ((p.y - e.y) / (e.ry + grow * 0.6)) ** 2 <= 1;

const OBSTACLES = [
  { ...POND, rx: POND.rx + 5, ry: POND.ry + 3 },
  { x: 138, y: 103, rx: 7, ry: 3 }, // rock
  { x: TREE.x, y: TREE.y, rx: 7, ry: 4 },
  { x: 154, y: 114, rx: 14, ry: 9 }, // bush
];

export function walkable(p) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  if (p.x < 9 || p.x > 151 || p.y < 44 || p.y > 112) return false;
  return !OBSTACLES.some((obstacle) => inEllipse(p, obstacle));
}

export const inPond = (p, margin = 0) => inEllipse(p, { ...POND, rx: POND.rx - margin, ry: POND.ry - margin * 0.6 });
export const onTree = (p) =>
  inEllipse(p, { x: TREE.x, y: TREE.canopyY, rx: 23, ry: 22 }) ||
  (Math.abs(p.x - TREE.x) < 6 && p.y > TREE.canopyY && p.y < TREE.y + 2);

// Check the whole segment, including subpixel tangencies that sampling can miss.
// Scale each ellipse to a unit circle and find the segment's closest point to it.
export function clear(a, b) {
  if (!walkable(a) || !walkable(b)) return false;
  return OBSTACLES.every((e) => {
    const x = (a.x - e.x) / e.rx, y = (a.y - e.y) / e.ry;
    const dx = (b.x - a.x) / e.rx, dy = (b.y - a.y) / e.ry;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(x * dx + y * dy) / length)) : 0;
    return (x + t * dx) ** 2 + (y + t * dy) ** 2 > 1;
  });
}

// Closest walkable point, searching outward in rings. Used for clicks and ball landings.
export function nearestWalkable(p) {
  const q = { x: Math.round(p.x), y: Math.round(p.y) };
  if (walkable(q)) return q;
  for (let r = 2; r < 80; r += 2)
    for (let a = 0; a < 16; a++) {
      const c = { x: Math.round(q.x + Math.cos((a / 16) * Math.PI * 2) * r), y: Math.round(q.y + Math.sin((a / 16) * Math.PI * 2) * r) };
      if (walkable(c)) return c;
    }
  return { ...HOME };
}

const GRID = 4;
// A* over a 4 px, 8-connected grid, then string-pulled into a few straight legs.
export function findPath(from, to) {
  if (!walkable(from) || !walkable(to)) return [];
  if (clear(from, to)) return [{ x: to.x, y: to.y }];
  // A rounded endpoint can sit inside an obstacle. Connect the actual point to
  // a nearby visible grid node so neither the first nor final leg cuts a corner.
  const cell = (p) => {
    const x = Math.round(p.x / GRID), y = Math.round(p.y / GRID), candidates = [];
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const c = { x: x + dx, y: y + dy }, q = { x: c.x * GRID, y: c.y * GRID };
        if (clear(p, q)) candidates.push({ ...c, distance: Math.hypot(p.x - q.x, p.y - q.y) });
      }
    return candidates.sort((a, b) => a.distance - b.distance)[0];
  };
  const key = (c) => c.x * 1000 + c.y;
  const start = cell(from),
    goal = cell(to);
  if (!start || !goal) return [];
  const open = [start],
    came = new Map([[key(start), null]]),
    cost = new Map([[key(start), 0]]);
  const h = (c) => Math.hypot(c.x - goal.x, c.y - goal.y);
  let found = null;
  while (open.length && !found) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (cost.get(key(open[i])) + h(open[i]) < cost.get(key(open[best])) + h(open[best])) best = i;
    const current = open.splice(best, 1)[0];
    if (current.x === goal.x && current.y === goal.y) found = current;
    else
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const next = { x: current.x + dx, y: current.y + dy };
          // Every edge, including the goal edge, stays outside the obstacles.
          if (!clear({ x: current.x * GRID, y: current.y * GRID }, { x: next.x * GRID, y: next.y * GRID })) continue;
          const g = cost.get(key(current)) + (dx && dy ? Math.SQRT2 : 1);
          if (g < (cost.get(key(next)) ?? Infinity)) {
            cost.set(key(next), g);
            came.set(key(next), current);
            open.push(next);
          }
        }
  }
  if (!found) return [];
  const cells = [];
  for (let c = found; c; c = came.get(key(c))) cells.unshift({ x: c.x * GRID, y: c.y * GRID });
  cells.unshift({ x: from.x, y: from.y });
  cells.push({ x: to.x, y: to.y });
  // String pulling: keep only the waypoints needed to stay on walkable ground.
  const path = [];
  let anchor = { x: from.x, y: from.y };
  for (let i = 1; i < cells.length; i++) {
    if (!clear(anchor, cells[i])) {
      path.push(cells[i - 1]);
      anchor = cells[i - 1];
    }
  }
  path.push(cells[cells.length - 1]);
  return path;
}

// PMD sheet rows: 0 down, 1 down-right, 2 right, 3 up-right, 4 up, 5 up-left, 6 left, 7 down-left.
export function directionTo(dx, dy) {
  if (!dx && !dy) return 0;
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (((Math.round((90 - degrees) / 45) % 8) + 8) % 8);
}
