// Wild visitors: now and then a small wild Pokémon stops by, stays a little, and leaves.
// Pure simulation (no DOM). The renderer draws them; the companion only watches.
import { POND } from "./world.js";

export const VISITORS = {
  pidgey: { name: "Pidgey", seasons: ["spring", "summer", "autumn"], phases: ["dawn", "day", "dusk"], flies: true,
    from: { x: 170, y: 46 }, to: { x: 88, y: 49 }, speed: 26 },
  caterpie: { name: "Caterpie", seasons: ["spring", "summer"], phases: ["day"],
    from: { x: -10, y: 106 }, to: { x: 34, y: 106 }, speed: 6 },
  magikarp: { name: "Magikarp", seasons: ["spring", "summer", "autumn"], phases: ["dawn", "day", "dusk"], pond: true,
    to: { x: POND.x + 6, y: POND.y + 2 } },
  hoothoot: { name: "Hoothoot", seasons: ["spring", "summer", "autumn", "winter"], phases: ["night"],
    from: { x: -10, y: 68 }, to: { x: 46, y: 68 }, speed: 14 },
};
export const FIRST_VISIT = [60, 120];
export const VISIT_GAP = [180, 360];
export const STAY = [8, 14];

const between = (random, [lo, hi]) => lo + random() * (hi - lo);

export function eligibleVisitors(phase, season, weather) {
  if (weather === "rain") return [];
  return Object.entries(VISITORS)
    .filter(([, v]) => v.seasons.includes(season) && v.phases.includes(phase))
    .map(([id]) => id);
}

export class Visitors {
  constructor(random = Math.random) {
    this.random = random;
    this.current = null;
    this.events = [];
    this.nextAt = between(random, FIRST_VISIT);
    this.time = 0;
  }
  drain() {
    return this.events.splice(0);
  }
  // Starts a visit now if one is allowed. `species` forces a choice (preview only).
  summon({ phase, season, weather }, species) {
    if (this.current) return false;
    const options = species ? [species] : eligibleVisitors(phase, season, weather);
    const id = options[Math.floor(this.random() * options.length) % Math.max(1, options.length)];
    if (!id || !VISITORS[id]) return false;
    const v = VISITORS[id];
    const start = v.pond ? v.to : v.from;
    this.current = {
      species: id, x: start.x, y: start.y, z: v.flies ? 28 : 0,
      dir: v.pond ? 0 : start.x > v.to.x ? 6 : 2,
      phase: v.pond ? "stay" : "arrive", anim: v.pond ? "Hop" : "Walk", clock: 0, elapsed: 0,
      stay: between(this.random, STAY),
    };
    if (v.pond) {
      this.events.push({ type: "splash", x: start.x, y: start.y });
      this.events.push({ type: "arrived", species: id, x: start.x, y: start.y });
    }
    return true;
  }
  // Movement is linear with a little lift for fliers; ticks are bounded so a stall never jumps.
  tick(dt, { phase, season, weather, reduced }) {
    dt = Math.max(0, Math.min(dt, 0.1));
    this.time += dt;
    const c = this.current;
    if (reduced) {
      // A still garden has no comings and goings; a visitor already here quietly leaves.
      if (c) this.current = null;
      this.nextAt = Math.max(this.nextAt, this.time + 30);
      return;
    }
    if (!c) {
      if (this.time >= this.nextAt) {
        this.nextAt = this.time + between(this.random, VISIT_GAP);
        this.summon({ phase, season, weather });
      }
      return;
    }
    const v = VISITORS[c.species];
    c.clock += dt * 60;
    c.elapsed += dt;
    if (c.phase === "stay") {
      if (v.pond) {
        // Splash, bob under, splash again, gone.
        if (c.anim === "Hop" && c.elapsed > 1.2) Object.assign(c, { anim: "Idle", clock: 0 });
        if (c.elapsed >= c.stay) {
          this.events.push({ type: "splash", x: c.x, y: c.y });
          this.events.push({ type: "left", species: c.species });
          this.current = null;
        }
        return;
      }
      if (c.elapsed >= c.stay) Object.assign(c, { phase: "leave", anim: "Walk", clock: 0, dir: v.from.x > c.x ? 2 : 6 });
      return;
    }
    const target = c.phase === "arrive" ? v.to : v.from;
    const dx = target.x - c.x, dy = target.y - c.y, d = Math.hypot(dx, dy);
    const step = v.speed * dt;
    if (d <= step) {
      Object.assign(c, { x: target.x, y: target.y });
      if (c.phase === "arrive") {
        Object.assign(c, { phase: "stay", anim: "Idle", clock: 0, elapsed: 0, z: 0, dir: 0 });
        this.events.push({ type: "arrived", species: c.species, x: c.x, y: c.y });
      } else {
        this.events.push({ type: "left", species: c.species });
        this.current = null;
      }
      return;
    }
    c.x += (dx / d) * step;
    c.y += (dy / d) * step;
    if (v.flies) {
      const total = Math.hypot(v.to.x - v.from.x, v.to.y - v.from.y) || 1;
      const k = c.phase === "arrive" ? d / total : 1 - d / total;
      c.z = Math.round(28 * Math.max(0, Math.min(1, k)));
    }
  }
}
