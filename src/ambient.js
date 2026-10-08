import { P, pen } from "./garden.js";
import { POND, TREE, SUN_PATCH } from "./world.js";

// Living garden: everything that moves but isn't the Pokémon. Visual only — it never
// influences behavior. Also owns short-lived particles requested by behavior events.

const inPondPoint = (x, y) => ((x - POND.x) / (POND.rx - 3)) ** 2 + ((y - POND.y) / (POND.ry - 2)) ** 2 <= 1;
const GLINTS = [[-14, -3, 3, 1.7], [-6, 3, 2, 2.3], [3, -5, 3, 1.4], [10, 2, 2, 2.0], [-1, 6, 2, 1.1], [14, -1, 2, 2.6]];
export const PHASES = ["dawn", "day", "dusk", "night"];
// Day length follows the season: long summer evenings, early winter dusks. Hours are local
// decimal hours for [dawn start, day start] and [dusk start, night start]. The season is
// already flipped for the Southern Hemisphere, so these tables need no hemisphere of their own.
export const DAYLIGHT = {
  spring: { dawn: [5.5, 8], dusk: [18, 20.5] },
  summer: { dawn: [4.5, 7], dusk: [19.5, 22] },
  autumn: { dawn: [6, 8.5], dusk: [17.5, 20] },
  winter: { dawn: [7, 9], dusk: [16.5, 18.5] },
};
const DEFAULT_DAYLIGHT = { dawn: [5, 8], dusk: [18, 20.5] };
export function phaseForHour(hour, season) {
  const { dawn, dusk } = DAYLIGHT[season] || DEFAULT_DAYLIGHT;
  if (hour >= dawn[0] && hour < dawn[1]) return "dawn";
  if (hour >= dawn[1] && hour < dusk[0]) return "day";
  if (hour >= dusk[0] && hour < dusk[1]) return "dusk";
  return "night";
}
// The moon's real phase, 0 = new, 0.5 = full, from a reference new moon and the mean synodic
// month. Accurate to within a day, which is all a seven-pixel moon can show.
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_DAYS = 29.530588853;
export function moonPhase(date = new Date()) {
  const t = date instanceof Date ? date.getTime() : NaN;
  if (!Number.isFinite(t)) return 0.5;
  const days = (t - NEW_MOON) / 86_400_000;
  return ((days / SYNODIC_DAYS) % 1 + 1) % 1;
}
export const moonIllumination = (phase) => (1 - Math.cos(phase * 2 * Math.PI)) / 2;
// Whole-scene grade: a multiply tint, plus how much "light" (fireflies, flame glow) shows.
export const GRADES = {
  dawn: { tint: "#ffd9d2", sky: "#ffc7b8", glow: 0.25 },
  day: { tint: null, sky: null, glow: 0 },
  dusk: { tint: "#ffbf93", sky: "#ff9d77", glow: 0.45 },
  night: { tint: "#4f62a6", sky: "#26305e", glow: 1 },
};

const CLOUDS = [
  [
    "..XXXX......",
    ".XXXXXXX.XX.",
    "XXXXXXXXXXXX",
    ".ssssssssss.",
  ],
  [
    "...XXX...",
    ".XXXXXXX.",
    "XXXXXXXXX",
    ".sssssss.",
  ],
];
const SMALL_HEART = ["01010", "11111", "01110", "00100"];
const ICONS = {
  heart: SMALL_HEART,
  "!": ["1", "1", "1", "0", "1"],
  "?": ["111", "001", "011", "000", "010"],
  note: ["0011", "0010", "0010", "1110", "1100"],
  sparkle: ["00100", "00100", "11011", "00100", "00100"],
  dots: ["10101"],
};

export class Ambient {
  constructor(random = Math.random) {
    this.random = random;
    this.time = 0;
    this.particles = [];
    this.clouds = [
      { x: 20, y: 3, shape: 0, speed: 1.6 },
      { x: 92, y: 9, shape: 1, speed: 1.1 },
      { x: 140, y: 2, shape: 1, speed: 1.9 },
    ];
    this.butterflies = [{ x: 60, y: 70, phase: 0, color: P.white, ttl: Infinity }];
    this.fireflies = Array.from({ length: 7 }, (_, i) => ({ x: 10 + i * 21, y: 50 + ((i * 17) % 55), phase: i * 1.7 }));
    this.ripples = [];
    this.blooms = [];
    this.floaters = [];
    this.season = "summer";
    this.weather = "clear";
    // Tonight's moon: its phase and, south of the equator, which side is lit.
    this.moon = { phase: 0.5, flip: false };
    this.rainLevel = 0;
    // Fixed set of drops recycled forever: rain never allocates per frame.
    this.drops = Array.from({ length: 34 }, () => ({ x: random() * 176, y: random() * 124, speed: 65 + random() * 35 }));
    this.nextRipple = 1;
    this.nextLeaf = 3;
    this.nextFish = 9;
    this.nextFlake = 0.5;
  }
  spawn(p) {
    this.particles.push({ age: 0, vx: 0, vy: 0, ...p });
    if (this.particles.length > 120) this.particles.shift();
  }
  // Translate behavior events into particles.
  handle(event, pet) {
    const { x, y } = event;
    const r = this.random;
    switch (event.type) {
      case "hearts":
        for (let i = 0; i < (event.count || 1); i++)
          this.spawn({ kind: "heart", x: x - 6 + r() * 12, y: y - 22 - r() * 4, vy: -9 - r() * 4, delay: i * 0.18, life: 1.3 });
        break;
      case "splash":
        this.ripples.push({ x, y: y - 2, age: 0, big: true });
        this.ripples = this.ripples.slice(-24);
        for (let i = 0; i < 12; i++)
          this.spawn({ kind: "drop", x: x + (r() - 0.5) * 8, y: y - 2, z: 0, vz: 30 + r() * 25, vx: (r() - 0.5) * 30, life: 0.9 });
        break;
      case "tend":
        this.blooms.push({ x: x + 7, y: y + 2, age: 0, life: 9 });
        this.blooms = this.blooms.slice(-6);
        for (let i = 0; i < 4; i++) this.spawn({ kind: "petal", x: x + 7, y: y - 3, vx: (r() - 0.5) * 8, vy: -5 - r() * 5, color: [P.pink, P.white][i % 2], life: 1.6, delay: 0.7 + i * 0.2 });
        break;
      case "warm":
        for (let i = 0; i < 5; i++) this.spawn({ kind: "warmth", x: x - 3 + r() * 6, y: y - 9, vy: -2, life: 2.4, delay: i * 0.12 });
        break;
      case "pond-rings":
        for (let i = 0; i < 3; i++) this.ripples.push({ x, y, age: -i * 0.4, big: true, deliberate: true });
        this.ripples = this.ripples.slice(-24);
        for (let i = 0; i < 4; i++) this.spawn({ kind: "drop", x: x - 2 + i, y, z: 0, vz: 12 + r() * 10, vx: (i - 1.5) * 4, life: 0.7 });
        break;
      case "bounce":
      case "dust":
        for (let i = 0; i < 5; i++)
          this.spawn({ kind: "dust", x: x + (r() - 0.5) * 6, y, vx: (r() - 0.5) * 14, vy: -3 - r() * 4, life: 0.45 });
        break;
      case "sparkle":
      case "confetti": {
        const colors = event.type === "confetti" ? [P.pink, P.yellow, P.berry, P.white, P.red] : [P.yellow, P.white];
        for (let i = 0; i < (event.type === "confetti" ? 18 : 8); i++) {
          const a = r() * Math.PI * 2,
            s = 18 + r() * 24;
          this.spawn({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 18, color: colors[i % colors.length], life: 0.9 + r() * 0.4 });
        }
        break;
      }
      case "leaves":
        for (let i = 0; i < 4; i++) this.spawnLeaf(x + (r() - 0.5) * 30, y + r() * 8, i * 0.4);
        break;
      case "blossoms":
        for (let i = 0; i < 9; i++)
          this.spawn({ kind: "petal", x: x + (r() - 0.5) * 36, y: y + r() * 10, vx: 3 + r() * 4, vy: 5 + r() * 4, color: [P.pink, "#fde3ec"][i % 2], life: 3.2, delay: i * 0.25, drift: true });
        break;
      case "pond-leaf":
        this.floaters.push({ x: x - 4, y, age: 0, life: 9, color: ["#cf6f30", "#e5993c", "#a4502b"][Math.floor(r() * 3)] });
        this.floaters = this.floaters.slice(-3);
        this.ripples.push({ x, y, age: 0, deliberate: true });
        this.ripples = this.ripples.slice(-24);
        break;
      case "embers":
        for (let i = 0; i < 8; i++)
          this.spawn({ kind: "ember", x: x + (r() - 0.5) * 4, y: y - 12, vx: (r() - 0.5) * 10, vy: -10 - r() * 10, life: 1 + r() * 0.6, delay: i * 0.05 });
        break;
      case "petals":
        for (let i = 0; i < 5; i++)
          this.spawn({ kind: "petal", x: x + (r() - 0.5) * 10, y: y + 2, vx: (r() - 0.5) * 12, vy: -12 - r() * 8, color: [P.pink, P.white, P.violet][i % 3], life: 1.4 });
        break;
      case "tidy":
        // The gathered leaves blow away in a small flurry.
        for (let i = 0; i < 4 + (event.size || 1) * 3; i++)
          this.spawn({ kind: "leaf", x: x + (r() - 0.5) * 8, y: y - 1 - r() * 3, vx: 6 + r() * 10, vy: -8 - r() * 6, sway: r() * 6, life: 1.6 + r() * 0.8, land: 200,
            color: ["#cf6f30", "#e5993c", "#a4502b"][i % 3], delay: i * 0.05 });
        break;
      case "butterfly":
        this.butterflies.push({ x: pet.x + 14, y: pet.y - 6, phase: r() * 6, color: [P.yellow, P.pink, P.white][Math.floor(r() * 3)], ttl: 9, orbit: pet });
        this.butterflies = this.butterflies.slice(-4);
        break;
    }
  }
  spawnLeaf(x, y, delay = 0) {
    const autumn = ["#cf6f30", "#e5993c", "#a4502b", "#f3c35a"];
    const color = this.season === "autumn" ? autumn[Math.floor(this.random() * 4)] : this.season === "spring" && this.random() < 0.5 ? P.pink : null;
    this.spawn({ kind: "leaf", x, y, vy: 7 + this.random() * 4, sway: this.random() * 6, life: 4.5, delay, land: 58 + this.random() * 18, color });
  }
  tick(dt, phase, reduced = false, season = this.season, weather = this.weather) {
    this.season = season;
    this.weather = weather;
    // Showers fade in and out over about twenty seconds instead of switching on.
    const rainTarget = weather === "rain" ? 1 : 0;
    this.rainLevel = reduced ? rainTarget : this.rainLevel + Math.sign(rainTarget - this.rainLevel) * Math.min(Math.abs(rainTarget - this.rainLevel), dt / 20);
    for (const bloom of this.blooms) bloom.age += dt;
    this.blooms = this.blooms.filter(bloom => bloom.age < bloom.life);
    for (const f of this.floaters) f.age += dt;
    this.floaters = this.floaters.filter((f) => f.age < f.life);
    for (const butterfly of this.butterflies) butterfly.ttl -= dt;
    // No resident butterfly in winter; a summoned one still visits briefly.
    this.butterflies = this.butterflies.filter(b => b.ttl === Infinity ? phase !== "night" && season !== "winter" && weather !== "rain" : b.ttl > 0);
    if (reduced) {
      // Still garden: nothing drifts; reaction particles simply expire in place.
      for (const p of this.particles) {
        p.delay = 0;
        p.age += dt;
      }
      this.particles = this.particles.filter((p) => p.age < p.life);
      this.ripples = this.ripples.filter(ripple => ripple.deliberate && (ripple.age += dt) < 1.6).slice(0, 1);
      return;
    }
    this.time += dt;
    const r = this.random;
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x > 170) cloud.x = -16;
    }
    if (this.rainLevel > 0)
      for (const d of this.drops) {
        d.y += d.speed * dt;
        d.x -= d.speed * 0.18 * dt;
        if (d.y > 124) { d.y -= 128; d.x = r() * 176; }
      }
    // Pond life: rings, an occasional fish. Rain dimples the water much more often.
    this.nextRipple -= dt;
    if (this.nextRipple <= 0) {
      this.nextRipple = weather === "rain" ? 0.15 + r() * 0.25 : 1.6 + r() * 2.5;
      const a = r() * Math.PI * 2,
        d = Math.sqrt(r()) * 0.7;
      this.ripples.push({ x: POND.x + Math.cos(a) * d * POND.rx, y: POND.y + Math.sin(a) * d * POND.ry, age: 0 });
    }
    this.nextFish -= dt;
    if (this.nextFish <= 0) {
      this.nextFish = 10 + r() * 14;
      const x = POND.x - 10 + r() * 20,
        y = POND.y - 2 + r() * 6;
      this.spawn({ kind: "fish", x, y, life: 0.8, dir: r() < 0.5 ? -1 : 1 });
      this.ripples.push({ x, y, age: -0.75, big: true });
    }
    for (const ripple of this.ripples) ripple.age += dt;
    this.ripples = this.ripples.filter((ripple) => ripple.age < 1.6);
    // Leaves drift from the tree now and then.
    this.nextLeaf -= dt;
    if (this.nextLeaf <= 0) {
      // Autumn sheds often; the winter evergreen hardly at all.
      this.nextLeaf = season === "autumn" ? 1.5 + r() * 2.5 : season === "winter" ? 25 + r() * 20 : 5 + r() * 7;
      this.spawnLeaf(TREE.x - 18 + r() * 36, TREE.canopyY + 6 + r() * 10);
    }
    // Gentle snowfall in winter: a handful of flakes, never a blizzard.
    if (season === "winter") {
      this.nextFlake -= dt;
      if (this.nextFlake <= 0) {
        this.nextFlake = 0.35 + r() * 0.45;
        if (this.particles.filter((p) => p.kind === "snow").length < 28)
          this.spawn({ kind: "snow", x: r() * 164 - 2, y: -2, vx: (r() - 0.5) * 3, vy: 6 + r() * 4, sway: r() * 6, life: 9 + r() * 6, land: 34 + r() * 82 });
      }
    }
    for (const b of this.butterflies) {
      b.phase += dt;
      const home = b.orbit ? { x: b.orbit.x, y: b.orbit.y - 16 } : { x: 70 + Math.sin(b.phase * 0.13) * 50, y: 62 + Math.sin(b.phase * 0.21) * 22 };
      b.x += (home.x + Math.cos(b.phase * 1.3) * 12 - b.x) * Math.min(1, dt * 1.5);
      b.y += (home.y + Math.sin(b.phase * 2.1) * 6 - b.y) * Math.min(1, dt * 1.5);
    }
    if (!this.butterflies.length && phase === "day" && season !== "winter" && weather !== "rain") this.butterflies.push({ x: -8, y: 60, phase: 0, color: P.white, ttl: Infinity });
    for (const f of this.fireflies) {
      f.phase += dt;
      f.x += Math.cos(f.phase * 0.7 + f.y) * dt * 4;
      f.y += Math.sin(f.phase * 0.9 + f.x) * dt * 3;
      f.x = (f.x + 160) % 160;
      f.y = Math.min(112, Math.max(36, f.y));
    }
    for (const p of this.particles) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "drop") {
        p.vz -= 140 * dt;
        p.z += p.vz * dt;
        if (p.z < 0) p.age = p.life;
      } else if (p.kind === "spark") {
        p.vy += 50 * dt;
        p.vx *= 1 - dt * 2;
      } else if (p.kind === "petal" && p.drift) p.x += Math.sin(p.age * 3) * dt * 6;
      else if (p.kind === "petal" || p.kind === "ember") p.vy += (p.kind === "petal" ? 20 : 2) * dt;
      else if (p.kind === "leaf") {
        if (p.y >= p.land) p.vy = 0;
        else if (p.land >= 200) p.vy += 14 * dt; // scattered pile leaves arc and fall away
        p.x += Math.sin(p.age * 3 + p.sway) * dt * 8;
      } else if (p.kind === "snow") {
        if (p.y >= p.land) { p.vy = 0; p.vx = 0; }
        else p.x += Math.sin(p.age * 1.7 + p.sway) * dt * 3;
      } else if (p.kind === "dust") p.vx *= 1 - dt * 5;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  // ---- drawing ---------------------------------------------------------------------------
  // Under the Pokémon: sky motion, water, swaying plants.
  drawBack(c, phase, reduced) {
    const { rect, dot } = pen(c);
    const t = reduced ? 0 : this.time;
    if (phase !== "night") {
      const sunY = phase === "day" ? 4 : 11;
      const sx = phase === "dawn" ? 66 : 134;
      rect(sx, sunY, 8, 6, "#fff2b8");
      rect(sx + 1, sunY - 1, 6, 8, "#fff2b8");
      rect(sx + 2, sunY + 1, 3, 2, "#ffffff");
    }
    for (const cloud of this.clouds) {
      CLOUDS[cloud.shape].forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch !== ".") dot(Math.round(cloud.x) + x, cloud.y + y, ch === "X" ? "#ffffff" : "#d9eef3");
        }),
      );
    }
    // Water shimmer: a few short glints scattered across the water (deliberately not in a line),
    // each drifting a little and blinking on its own rhythm.
    GLINTS.forEach(([dx, dy, w, speed], i) => {
      if (Math.sin(t * speed + i * 2.4) < 0.15) return;
      const x = Math.round(POND.x + dx + Math.sin(t * 0.5 + i) * 1.5), y = POND.y + dy;
      if (inPondPoint(x, y) && inPondPoint(x + w - 1, y)) rect(x, y, w, 1, P.water3);
    });
    for (const ripple of this.ripples) {
      if (ripple.age < 0) continue;
      const k = reduced ? 0.5 : ripple.age / 1.6,
        rx = 2 + k * (ripple.big ? 10 : 6),
        ry = rx * 0.4;
      c.globalAlpha = 1 - k;
      for (let a = 0; a < 20; a++) {
        const ang = (a / 20) * Math.PI * 2;
        dot(Math.round(ripple.x + Math.cos(ang) * rx), Math.round(ripple.y + Math.sin(ang) * ry), P.water3);
      }
      c.globalAlpha = 1;
    }
    for (const bloom of this.blooms) {
      const open = reduced || bloom.age > 0.7;
      const x = Math.round(bloom.x), y = Math.round(bloom.y);
      c.globalAlpha = reduced || bloom.age < 7 ? 1 : (bloom.life - bloom.age) / 2;
      rect(x, y - 4, 1, 5, P.leaf2);
      dot(x - 1, y - 2, P.leaf3); dot(x + 1, y - 3, P.leaf3);
      if (open) { rect(x - 2, y - 6, 5, 3, P.pink); rect(x - 1, y - 7, 3, 5, P.pink); dot(x, y - 5, P.yellow); }
      else rect(x, y - 6, 2, 2, P.pink);
      c.globalAlpha = 1;
    }
    // Autumn leaves floating on the pond, turning slowly as they drift.
    for (const f of this.floaters) {
      const k = f.age / f.life;
      c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      const x = Math.round(f.x + (reduced ? 0 : f.age * 1.1)), y = Math.round(f.y - 1 + (reduced ? 0 : Math.sin(f.age * 1.3) * 0.6));
      rect(x, y, 3, 1, f.color);
      dot(x + 1, y - 1, f.color);
      c.globalAlpha = 1;
    }
    // Lily pads bob a pixel; one has a flower.
    for (const [x, y, flower, i] of [
      [POND.x - 14, POND.y + 3, true, 0],
      [POND.x + 11, POND.y - 3, false, 1],
      [POND.x + 4, POND.y + 6, false, 2],
    ]) {
      const bob = Math.round(Math.sin(t * 1.2 + i * 2) * 0.6);
      rect(x - 3, y + bob, 7, 3, "#4f9a52");
      rect(x - 2, y - 1 + bob, 5, 1, "#62b05f");
      dot(x, y + bob, "#3f8a50");
      if (flower) {
        rect(x - 1, y - 2 + bob, 3, 2, P.pink);
        dot(x, y - 3 + bob, "#fbd3df");
      }
    }
    // Reeds at the pond's west and east lips: two-tone stems, a blade, and a cattail.
    for (const [x, y, h, i] of [
      [POND.x - POND.rx - 1, POND.y + 3, 12, 0],
      [POND.x - POND.rx + 2, POND.y + 6, 8, 1],
      [POND.x + POND.rx, POND.y, 13, 2],
      [POND.x + POND.rx - 3, POND.y + 5, 9, 3],
    ]) {
      const sway = Math.round(Math.sin(t * 1.3 + i * 1.7) * 1);
      for (let k = 0; k < h; k++) dot(x + (k > h * 0.55 ? sway : 0), y - k, k < 3 ? P.leaf1 : P.leaf2);
      dot(x + 1, y - 3, P.leaf2);
      dot(x + 2, y - 4, P.leaf3);
      if (i % 2 === 0) {
        rect(x + sway, y - h - 3, 2, 4, "#7a4a2e");
        dot(x + sway + 1, y - h - 3, "#a8724a");
        dot(x + sway, y - h - 4, P.leaf2);
      }
    }
    // Tall grass tufts that sway out of phase.
    for (let i = 0; i < 14; i++) {
      const x = 6 + ((i * 47) % 150),
        y = 44 + ((i * 29) % 70);
      if (Math.abs(x - SUN_PATCH.x) < 14 && Math.abs(y - SUN_PATCH.y) < 6) continue;
      if (((x - POND.x) / (POND.rx + 6)) ** 2 + ((y - POND.y) / (POND.ry + 5)) ** 2 < 1) continue;
      const s = Math.round(Math.sin(t * 1.6 + i * 0.8));
      dot(x, y, P.grassDarker);
      dot(x - 1, y - 1, P.grassDark);
      dot(x + 1, y - 1, P.grassDark);
      dot(x - 1 + s, y - 2, P.grassLight);
      dot(x + 2 + s, y - 2, P.grassLight);
      dot(x + s, y - 3, P.grassLighter);
    }
    // Sun twinkles in Charmander's favorite patch (not on a winter day).
    if (phase === "day" && this.season !== "winter")
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.5 + i / 3) % 1;
        if (k < 0.25) {
          const x = SUN_PATCH.x - 12 + ((i * 13 + Math.floor(t * 0.5)) * 7) % 24,
            y = SUN_PATCH.y - 3 + ((i * 5) % 6);
          dot(x, y, "#ffffff");
          if (k > 0.08 && k < 0.17) {
            dot(x - 1, y, "#fff5c4");
            dot(x + 1, y, "#fff5c4");
            dot(x, y - 1, "#fff5c4");
            dot(x, y + 1, "#fff5c4");
          }
        }
      }
  }
  // Above the Pokémon: particles, butterflies, falling leaves.
  drawFront(c, phase, reduced) {
    const { rect, dot } = pen(c);
    const t = reduced ? 0 : this.time;
    for (const p of this.particles) {
      if (p.delay > 0) continue;
      const k = p.age / p.life,
        x = Math.round(p.x),
        y = Math.round(p.y);
      if (p.kind === "heart") {
        c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        bitmap(c, SMALL_HEART, x - 2, y, "#e8657a");
        dot(x - 1, y + 1, "#ffc2cc");
        c.globalAlpha = 1;
      } else if (p.kind === "drop") dot(x, Math.round(p.y - p.z), P.water3);
      else if (p.kind === "dust") {
        c.globalAlpha = 0.8 * (1 - k);
        rect(x, y, k < 0.5 ? 2 : 1, 1, "#e8e2c9");
        c.globalAlpha = 1;
      } else if (p.kind === "spark") {
        c.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        dot(x, y, p.color);
        if (k < 0.4) dot(x + 1, y, p.color);
        c.globalAlpha = 1;
      } else if (p.kind === "warmth") {
        c.globalAlpha = reduced ? 0.8 : Math.min(1, (1 - k) * 2);
        dot(x, y, k < 0.6 ? "#ffe5a3" : "#edac64");
        if (k < 0.5) dot(x + 1, y, "#f6c67e");
        c.globalAlpha = 1;
      } else if (p.kind === "ember") {
        dot(x, y, k < 0.4 ? "#fff1a6" : k < 0.7 ? "#ffad4a" : "#c95a33");
      } else if (p.kind === "petal") {
        c.globalAlpha = 1 - k;
        dot(x, y, p.color);
        c.globalAlpha = 1;
      } else if (p.kind === "leaf") {
        c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
        const flip = Math.sin(p.age * 5 + p.sway) > 0;
        rect(x, y, flip ? 2 : 1, 1, p.color || P.leaf3);
        dot(x + (flip ? 0 : 1), y + 1, p.color || P.leaf2);
        c.globalAlpha = 1;
      } else if (p.kind === "snow") {
        c.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 0.95;
        dot(x, y, "#ffffff");
        c.globalAlpha = 1;
      } else if (p.kind === "fish") {
        const arc = Math.sin(k * Math.PI) * 6;
        rect(x + Math.round(p.dir * (k - 0.5) * 8), Math.round(y - arc), 3, 1, "#f3a25b");
        dot(x + Math.round(p.dir * (k - 0.5) * 8) + (p.dir > 0 ? -1 : 3), Math.round(y - arc - 1), "#f3a25b");
      }
    }
    for (const b of this.butterflies) {
      if (phase === "night" && b.ttl === Infinity) continue;
      const x = Math.round(b.x),
        y = Math.round(b.y),
        open = reduced || Math.sin(t * 18 + b.phase) > 0;
      dot(x, y, P.outline);
      if (open) {
        rect(x - 2, y - 1, 2, 2, b.color);
        rect(x + 1, y - 1, 2, 2, b.color);
      } else {
        dot(x - 1, y - 1, b.color);
        dot(x + 1, y - 1, b.color);
      }
    }
  }
  // Soft drizzle: a cool wash plus thin slanted streaks. Reduced motion shows still drops.
  drawRain(c, reduced) {
    const level = this.rainLevel;
    if (level <= 0) return;
    c.globalCompositeOperation = "multiply";
    c.globalAlpha = level;
    c.fillStyle = "#c9d3e0";
    c.fillRect(0, 0, 160, 120);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 0.55 * level;
    c.fillStyle = "#e8f1ff";
    const shown = Math.ceil(this.drops.length * level);
    for (const d of this.drops.slice(0, shown)) {
      const x = Math.round(d.x), y = Math.round(d.y);
      // Longer, lighter streaks read as rain, distinct from the grass texture below.
      if (reduced) c.fillRect(x, y, 1, 2);
      else { c.fillRect(x, y, 1, 3); c.fillRect(x - 1, y + 3, 1, 2); }
    }
    c.globalAlpha = 1;
  }
  // Lights are added after the scene grade so they glow in the dark.
  drawLights(c, phase, glowSource, reduced, lights = []) {
    const grade = GRADES[phase];
    const { dot, rect } = pen(c);
    const t = reduced ? 0 : this.time;
    if (phase === "night") {
      for (let i = 0; i < 18; i++) {
        const x = (i * 37 + 11) % 160,
          y = (i * 13) % 17;
        if (x < 56 || (x > 126 && x < 140 && y < 13)) continue; // behind the tree and the moon
        if (Math.sin(t * 1.5 + i * 2.3) > -0.6) dot(x, y, i % 4 ? "#c9d4ff" : "#ffffff");
      }
      // The moon keeps its real phase: the lit side grows from the right while waxing and
      // shrinks from the left while waning (mirrored in the Southern Hemisphere).
      const { phase: moon, flip } = this.moon;
      const lit = moonIllumination(moon);
      const edge = Math.cos(moon * 2 * Math.PI);
      for (let y = 3; y <= 11; y++) {
        const half = y === 3 || y === 11 ? 2 : 3, w = half + 0.5;
        for (let x = 133 - half; x <= 133 + half; x++) {
          const px = (x - 133) * (flip ? -1 : 1);
          const bright = moon < 0.5 ? px > w * edge : px < -w * edge;
          dot(x, y, bright ? "#f4f1d8" : "#3a4578");
        }
      }
      if (lit > 0.3) {
        rect(132, 5, 2, 2, "#dcd8bd");
        rect(134, 8, 1, 1, "#dcd8bd");
      }
      // Moon on the water: a soft column of short glints under the moon, shimmering gently,
      // and fainter as the moon thins. A new moon leaves the pond dark.
      if (lit > 0.08) {
        const widths = [4, 3, 5, 2, 3, 1];
        widths.forEach((w, i) => {
          const y = POND.y - 6 + i * 2;
          const x = Math.round(129 - w / 2 + (reduced ? 0 : Math.sin(t * 1.3 + i * 1.7) * 0.8));
          if (!inPondPoint(x, y) || !inPondPoint(x + w - 1, y)) return;
          c.globalAlpha = (0.5 - i * 0.06) * (0.35 + 0.65 * lit);
          rect(x, y, w, 1, "#f4f1d8");
        });
        c.globalAlpha = 1;
      }
    }
    if (!grade.glow) return;
    c.globalCompositeOperation = "lighter";
    const glow = (x, y, r, color, strength) => {
      for (let i = 3; i >= 1; i--) {
        c.globalAlpha = strength * 0.13;
        pen(c).ellipse(Math.round(x), Math.round(y), Math.round((r * i) / 3), Math.round((r * i * 0.7) / 3), color);
      }
      c.globalAlpha = 1;
    };
    if (glowSource) glow(glowSource.x, glowSource.y, 16, "#ff9a3c", grade.glow * (0.85 + Math.sin(t * 9) * 0.08));
    // Fixed lights in the garden, like a lantern earned together: a warm pool plus a bright core.
    for (const light of lights) {
      glow(light.x, light.y, light.r || 10, light.color || "#ffb347", grade.glow * (light.strength ?? 0.8) * (0.9 + Math.sin(t * 5 + light.x) * 0.06));
      c.globalAlpha = 0.85 * grade.glow;
      rect(light.x - 1, light.y - 2, 3, 4, "#fff1a6");
      c.globalAlpha = 1;
    }
    // Summer nights are firefly season; spring and autumn get a few, winter none.
    const fireflies = this.weather === "rain" ? 0 : this.season === "summer" ? this.fireflies.length : this.season === "winter" ? 0 : 3;
    if (phase === "night" || phase === "dusk")
      for (const f of this.fireflies.slice(0, fireflies)) {
        const on = (Math.sin(f.phase * 1.7) + 1) / 2;
        if (on < 0.35) continue;
        glow(f.x, f.y, 4, "#d9ff6b", grade.glow * on);
        c.globalAlpha = on;
        dot(Math.round(f.x), Math.round(f.y), "#f6ffb8");
        c.globalAlpha = 1;
      }
    c.globalCompositeOperation = "source-over";
  }
}

export function bitmap(c, rows, x, y, color, scale = 1) {
  c.fillStyle = color;
  rows.forEach((row, iy) => [...row].forEach((ch, ix) => ch === "1" && c.fillRect(x + ix * scale, y + iy * scale, scale, scale)));
}

// Speech bubble with a pixel icon; pops in, floats gently.
export function drawBubble(c, bubble, x, y, time, reduced) {
  const icon = ICONS[bubble.kind] || ICONS["!"];
  const age = time - bubble.start,
    left = bubble.until - time;
  const iw = icon[0].length,
    ih = icon.length;
  const w = Math.max(9, iw + 6),
    h = Math.max(9, ih + 4);
  const pop = reduced ? 1 : Math.min(1, age / 0.12);
  const bob = reduced ? 0 : Math.round(Math.sin(age * 4) * 0.6);
  if (pop < 0.5) return;
  const bx = Math.round(x - w / 2),
    by = Math.round(y - h + bob);
  c.globalAlpha = left < 0.25 && !reduced ? Math.max(0, left / 0.25) : 1;
  const { rect, dot } = pen(c);
  rect(bx + 1, by, w - 2, h, "#2c3a33");
  rect(bx, by + 1, w, h - 2, "#2c3a33");
  rect(bx + 1, by + 1, w - 2, h - 2, "#fffdf3");
  rect(bx + 1, by + h - 2, w - 2, 1, "#e6e0cc");
  // Tail
  dot(Math.round(x) - 1, by + h, "#2c3a33");
  dot(Math.round(x), by + h, "#fffdf3");
  dot(Math.round(x) + 1, by + h, "#2c3a33");
  dot(Math.round(x), by + h + 1, "#2c3a33");
  const color = { heart: "#e8657a", "!": "#d9573f", "?": "#4c7fd0", note: "#5f9a4f", sparkle: "#e5a823", dots: "#6c7a70" }[bubble.kind] || "#2c3a33";
  let ix = bx + Math.floor((w - iw) / 2),
    iy = by + Math.floor((h - ih) / 2);
  if (bubble.kind === "dots") {
    // Animated typing dots while Hermes works.
    for (let i = 0; i < 3; i++) dot(ix + i * 2, iy + (!reduced && Math.floor(age * 6) % 3 === i ? -1 : 0), color);
  } else bitmap(c, icon, ix, iy, color);
  c.globalAlpha = 1;
}
