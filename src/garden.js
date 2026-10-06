import { WORLD, POND, TREE, SUN_PATCH, HOME } from "./world.js";

// Original, deterministic pixel art, authored on the same 1:1 grid as the sprites.
// Static layers are drawn once and cached; ambient.js animates on top of them.
export const P = {
  sky0: "#8fcbe0",
  sky1: "#a9d8e6",
  sky2: "#c6e6ea",
  sky3: "#e2f1e4",
  hill0: "#a7d0ae",
  hill1: "#8cbf98",
  trees0: "#6aa57c",
  trees1: "#558f69",
  wood: "#c79a68",
  woodLight: "#e2bd8a",
  woodDark: "#9b7149",
  woodLine: "#6b4b31",
  grass: "#88c36b",
  grassLight: "#9fd17a",
  grassLighter: "#b6de8b",
  grassDark: "#71ad5c",
  grassDarker: "#5a944f",
  sun: "#c3e08a",
  sunLight: "#d8eb9c",
  stone: "#dcd3b8",
  stoneLight: "#efe8d3",
  stoneDark: "#b3a988",
  sand: "#e3d4a2",
  sandDark: "#c4b282",
  rock: "#a9b2ae",
  rockDark: "#7f8a87",
  water0: "#3f8fb4",
  water1: "#58a9cb",
  water2: "#7cc3da",
  water3: "#b6e3ec",
  trunk: "#8b6343",
  trunkLight: "#aa7d54",
  trunkDark: "#664530",
  leaf0: "#2f6e45",
  leaf1: "#3f8a50",
  leaf2: "#58a55a",
  leaf3: "#7cc066",
  leaf4: "#a8d97c",
  outline: "#2c4a37",
  pink: "#f19ab4",
  yellow: "#f6d562",
  white: "#fbf7e8",
  red: "#e5675a",
  violet: "#b493dd",
  berry: "#4e7fd6",
};

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}
export function pen(c) {
  const rect = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const dot = (x, y, color) => rect(x, y, 1, 1, color);
  // Pixel ellipse built from rows — never antialiased.
  const ellipse = (cx, cy, rx, ry, color, filter) => {
    for (let y = Math.ceil(-ry); y <= ry; y++) {
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)) + 0.25);
      if (!filter) rect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1, color);
      else
        for (let x = -half; x <= half; x++)
          if (filter(Math.round(cx + x), Math.round(cy + y), x / rx, y / ry)) dot(Math.round(cx + x), Math.round(cy + y), color);
    }
  };
  return { rect, dot, ellipse };
}
const checker = (x, y) => (x + y) % 2 === 0;
// Smooth value noise on a coarse lattice: organic edges without checkerboard dithering.
const hash = (x, y) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
};
export function noise(x, y, cell = 4) {
  const gx = x / cell,
    gy = y / cell,
    x0 = Math.floor(gx),
    y0 = Math.floor(gy),
    fx = gx - x0,
    fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
  const bottom = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}
const ragged = (amount, cell = 4) => (x, y, nx, ny) => nx * nx + ny * ny < 1 - amount * noise(x, y, cell);
// Wobbly ellipse: concentric layers sharing a phase follow the same natural outline.
function blob(c, cx, cy, rx, ry, color, wobble = 0.07, phase = 0) {
  c.fillStyle = color;
  for (let y = Math.floor(-ry * 1.2); y <= ry * 1.2; y++)
    for (let x = Math.floor(-rx * 1.2); x <= rx * 1.2; x++) {
      const nx = x / rx,
        ny = y / ry,
        a = Math.atan2(ny, nx);
      const edge = 1 + wobble * (Math.sin(3 * a + phase) * 0.6 + Math.sin(5 * a + phase * 2) * 0.4);
      if (Math.hypot(nx, ny) <= edge) c.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
}

export function drawBackground() {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const c = canvas.getContext("2d");
  const { rect, dot, ellipse } = pen(c);
  const rand = rng(1337);

  // Sky bands with dithered seams.
  const bands = [
    [0, P.sky0],
    [6, P.sky1],
    [12, P.sky2],
    [18, P.sky3],
  ];
  bands.forEach(([y, color], i) => {
    rect(0, y, 160, 30 - y, color);
    if (i) for (let x = 0; x < 160; x++) if (checker(x, y)) dot(x, y - 1, color);
  });

  // Far hills and a soft treeline.
  for (let x = 0; x < 160; x++) {
    const h0 = 17 + Math.round(Math.sin(x * 0.045 + 1) * 3 + Math.sin(x * 0.11) * 1.5);
    rect(x, h0, 1, 20, P.hill0);
    const h1 = 22 + Math.round(Math.sin(x * 0.07 + 3) * 2.5 + Math.sin(x * 0.19) * 1);
    rect(x, h1, 1, 20, P.hill1);
  }
  for (let x = -4; x < 168; x += 7 + Math.floor(rand() * 5)) {
    const r = 3 + Math.floor(rand() * 3);
    ellipse(x, 27 - r * 0.4, r, r, P.trees0);
    ellipse(x + 1, 28 - r * 0.2, r - 1, r - 1, P.trees1, (px, py) => py > 27 - r * 0.6);
  }

  // Ground.
  rect(0, 31, 160, 89, P.grass);
  // Mottled meadow: light and dark clumps from layered noise, hard-edged like hand-placed pixels.
  for (let y = 36; y < 120; y++)
    for (let x = 0; x < 160; x++) {
      const n = noise(x, y * 1.8, 9) * 0.65 + noise(x + 40, y * 2, 4) * 0.35;
      if (n > 0.66) dot(x, y, P.grassLight);
      else if (n < 0.3) dot(x, y, P.grassDark);
    }
  // Tufts: little "v" strokes, darker below, lit tips above.
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rand() * 160),
      y = 34 + Math.floor(rand() * 86);
    const dark = rand() < 0.55;
    dot(x, y, dark ? P.grassDark : P.grassLighter);
    if (rand() < 0.6) {
      dot(x - 1, y - 1, dark ? P.grassDark : P.grassLight);
      dot(x + 1, y - 1, dark ? P.grassDarker : P.grassLight);
    }
  }
  // Fence shadow on the grass.
  for (let x = 0; x < 160; x++) {
    rect(x, 34, 1, 2, P.grassDark);
    if (checker(x, 36)) dot(x, 36, P.grassDark);
  }

  // Fence: posts, rails, pickets.
  const fenceY = 21;
  for (const y of [fenceY + 4, fenceY + 9]) {
    rect(0, y, 160, 2, P.wood);
    rect(0, y, 160, 1, P.woodLight);
    rect(0, y + 2, 160, 1, P.woodDark);
  }
  for (let x = 2; x < 160; x += 8) {
    rect(x - 1, fenceY - 1, 6, 15, P.woodLine);
    rect(x, fenceY, 4, 14, P.wood);
    rect(x, fenceY, 1, 14, P.woodLight);
    rect(x + 3, fenceY + 1, 1, 13, P.woodDark);
    rect(x + 1, fenceY - 2, 2, 1, P.woodLine);
    rect(x + 1, fenceY - 1, 2, 1, P.woodLight);
  }

  // Sunny patch: warm, lighter grass with a ragged rim and a bright heart.
  ellipse(SUN_PATCH.x, SUN_PATCH.y, SUN_PATCH.rx + 2, SUN_PATCH.ry + 2, P.sun, ragged(0.35, 3));
  ellipse(SUN_PATCH.x + 2, SUN_PATCH.y - 1, SUN_PATCH.rx - 5, SUN_PATCH.ry - 2, P.sunLight, ragged(0.45, 3));
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2,
      d = Math.sqrt(rand());
    dot(Math.round(SUN_PATCH.x + Math.cos(a) * d * SUN_PATCH.rx), Math.round(SUN_PATCH.y + Math.sin(a) * d * SUN_PATCH.ry), P.white);
  }

  // Tree shade pooled on the grass (drawn before the trunk layer).
  ellipse(TREE.x + 2, TREE.y + 5, 26, 10, P.grassDark, ragged(0.3, 4));
  ellipse(TREE.x + 2, TREE.y + 3, 17, 5, P.grassDarker, ragged(0.35, 3));

  // Stepping-stone path from where you stand toward the middle of the garden.
  for (const [x, y, w] of [
    [HOME.x + 1, 116, 6],
    [HOME.x - 5, 108, 5],
    [HOME.x + 3, 100, 5],
    [HOME.x - 3, 92, 4],
    [HOME.x + 2, 85, 4],
  ]) {
    ellipse(x, y + 1, w, 2, P.grassDarker);
    ellipse(x, y, w, 2, P.stone);
    rect(x - w + 2, y - 1, w * 2 - 4, 1, P.stoneLight);
    rect(x - w + 2, y + 2, w * 2 - 4, 1, P.stoneDark);
  }

  // Pond: shadowed lip, an uneven sandy bank, a few stones, then water in depth bands.
  const { x: px, y: py, rx, ry } = POND;
  const ph = 0.8;
  blob(c, px, py + 2, rx + 4, ry + 3, P.grassDarker, 0.06, ph);
  blob(c, px, py, rx + 3, ry + 2, P.sandDark, 0.06, ph);
  blob(c, px, py - 1, rx + 3, ry + 2, P.sand, 0.06, ph);
  blob(c, px, py, rx, ry, P.water0, 0.06, ph);
  blob(c, px, py + 1.5, rx - 1, ry - 1.5, P.water1, 0.06, ph);
  blob(c, px + 2, py + 2.5, rx - 7, ry - 5, P.water2, 0.1, ph + 1);
  // A foam line where the water meets the near bank.
  for (let x = -rx + 4; x <= rx - 4; x++) {
    const y = Math.round(py + ry * Math.sqrt(1 - (x / rx) ** 2) * (1 + 0.06 * Math.sin(3 * Math.atan2(1, x / rx) + ph))) - 1;
    if (noise(px + x, y, 3) > 0.35) dot(px + x, y, P.water3);
  }
  // Grass creeping over the bank, and a cluster of stones on the east side.
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const x = Math.round(px + Math.cos(a) * (rx + 3.5)),
      y = Math.round(py + Math.sin(a) * (ry + 2.5));
    dot(x, y, P.grassDark);
    if (rand() < 0.5) dot(x, y - 1, P.grassLight);
  }
  for (const [x, y, w] of [
    [px + rx + 1, py + 3, 4],
    [px + rx - 3, py + ry, 3],
    [px + rx + 3, py - 2, 3],
    [px - rx - 2, py - 3, 3],
  ]) {
    rect(x - 1, y, w + 2, 2, P.rockDark);
    rect(x, y - 1, w, 2, P.rock);
    rect(x, y - 1, w - 1, 1, "#c7cecb");
  }
  // Flower bed by the path, small ground flowers sprinkled elsewhere.
  ellipse(21, 107, 15, 6, P.grassDark, ragged(0.3, 3));
  const flower = (x, y, color) => {
    dot(x, y + 1, P.grassDarker);
    dot(x - 1, y, color);
    dot(x + 1, y, color);
    dot(x, y - 1, color);
    dot(x, y + 1, color);
    dot(x, y, P.yellow);
  };
  [
    [10, 104, P.pink],
    [15, 108, P.white],
    [20, 103, P.violet],
    [26, 107, P.pink],
    [31, 104, P.white],
    [24, 111, P.yellow],
    [13, 112, P.violet],
    [33, 110, P.red],
    [58, 40, P.white],
    [100, 38, P.pink],
    [143, 41, P.yellow],
    [48, 116, P.white],
    [112, 108, P.pink],
    [70, 76, P.white],
    [150, 92, P.violet],
  ].forEach(([x, y, color]) => flower(x, y, color));

  // Mushrooms tucked by the roots and a mossy rock.
  const mushroom = (x, y) => {
    rect(x, y - 1, 2, 3, P.white);
    rect(x - 2, y - 3, 6, 2, P.red);
    rect(x - 1, y - 4, 4, 1, P.red);
    dot(x - 1, y - 3, P.white);
    dot(x + 2, y - 4, P.white);
  };
  mushroom(46, 63);
  mushroom(50, 65);
  ellipse(138, 104, 6, 3, P.rockDark);
  ellipse(138, 103, 5, 3, P.rock);
  rect(135, 101, 5, 1, P.grassLight);
  rect(134, 102, 3, 1, P.grassDark);
  return canvas;
}

// The tree is its own layer so the Pokémon can walk behind the trunk.
// Canopy palettes per season; spring adds blossoms, winter a dusting of snow on top.
export const CANOPY = {
  spring: [P.leaf0, P.leaf1, P.leaf2, P.leaf3, P.leaf4],
  summer: [P.leaf0, P.leaf1, P.leaf2, P.leaf3, P.leaf4],
  autumn: ["#7a3b22", "#a4502b", "#cf6f30", "#e5993c", "#f3c35a"],
  winter: ["#24493a", "#2f5b46", "#3f6f55", "#5c8770", "#7fa58d"],
};
export const SNOW = "#f4f8fb";
export const FROST = "#dfeaf2";
export function drawTree(season = "summer") {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const c = canvas.getContext("2d");
  const { rect, dot } = pen(c);
  const ox = TREE.x - 32,
    oy = 0; // canvas origin in world space
  const rand = rng(99);
  const W = (x) => x - ox,
    H = (y) => y - oy;

  // Trunk with flared roots, lit from the upper right.
  for (let y = 26; y <= 59; y++) {
    const flare = y > 54 ? [0, 1, 1, 2, 3, 4][y - 54] ?? 4 : 0;
    const left = TREE.x - 4 - flare,
      right = TREE.x + 4 + flare;
    rect(W(left - 1), H(y), right - left + 3, 1, P.outline);
    rect(W(left), H(y), right - left + 1, 1, P.trunk);
    rect(W(right - 2), H(y), 2, 1, P.trunkLight);
    rect(W(left), H(y), 2, 1, P.trunkDark);
  }
  for (const [x, y] of [
    [TREE.x - 1, 36],
    [TREE.x + 1, 44],
    [TREE.x - 2, 50],
  ]) {
    rect(W(x), H(y), 2, 3, P.trunkDark);
  }
  rect(W(TREE.x - 3), H(30), 2, 2, P.trunkDark); // knot

  // Canopy: overlapping blobs, each shaded by its own light direction, then outlined.
  const blobs = [
    [TREE.x - 12, 25, 12],
    [TREE.x + 12, 24, 13],
    [TREE.x, 16, 15],
    [TREE.x - 8, 9, 9],
    [TREE.x + 9, 8, 9],
    [TREE.x - 16, 36, 8],
    [TREE.x + 16, 35, 8],
    [TREE.x, 33, 11],
  ];
  const leaf = new Map();
  for (const [bx, by, r] of blobs)
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y) / r;
        if (d > 1) continue;
        // Light comes from the upper right; underside and lower-left fall into shade.
        const light = (x * 0.55 - y * 0.85) / r + (rand() - 0.5) * 0.35;
        const tone = light > 0.62 ? 4 : light > 0.25 ? 3 : light > -0.25 ? 2 : light > -0.6 ? 1 : 0;
        const key = `${bx + x},${by + y}`;
        // Later (front) blobs overwrite earlier ones, except their dark rims stay readable.
        leaf.set(key, d > 0.88 ? Math.min(tone, 1) : tone);
      }
  const tones = CANOPY[season] || CANOPY.summer;
  for (const [key, tone] of leaf) {
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (!leaf.has(`${x + dx},${y + dy}`)) dot(W(x + dx), H(y + dy), P.outline);
    dot(W(x), H(y), tones[tone]);
  }
  // Leaf clumps: little crescents give texture without noise.
  for (let i = 0; i < 46; i++) {
    const [bx, by, r] = blobs[Math.floor(rand() * blobs.length)];
    const a = rand() * Math.PI * 2,
      d = rand() * r * 0.8;
    const x = Math.round(bx + Math.cos(a) * d),
      y = Math.round(by + Math.sin(a) * d);
    const tone = leaf.get(`${x},${y}`);
    if (tone === undefined) continue;
    const up = tones[Math.min(4, tone + 1)],
      down = tones[Math.max(0, tone - 1)];
    rect(W(x - 1), H(y), 3, 1, up);
    dot(W(x - 2), H(y + 1), down);
    dot(W(x + 2), H(y + 1), down);
  }
  if (season === "spring")
    // Blossom clusters: small five-dot flowers, deterministic so the tree never flickers.
    for (let i = 0; i < 26; i++) {
      const [bx, by, r] = blobs[Math.floor(rand() * blobs.length)];
      const a = rand() * Math.PI * 2, d = rand() * r * 0.85;
      const x = Math.round(bx + Math.cos(a) * d), y = Math.round(by + Math.sin(a) * d);
      if (!leaf.has(`${x},${y}`)) continue;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) dot(W(x + dx), H(y + dy), dx || dy ? P.pink : "#fde3ec");
    }
  if (season === "winter")
    // Snow settles on every upward-facing edge of the canopy.
    for (const key of leaf.keys()) {
      const [x, y] = key.split(",").map(Number);
      if (!leaf.has(`${x},${y - 1}`)) {
        dot(W(x), H(y), SNOW);
        if (leaf.has(`${x},${y + 1}`) && (x + y) % 3) dot(W(x), H(y + 1), FROST);
      }
    }
  // A few Oran Berries hiding in the leaves (gone in winter).
  for (const [x, y] of season === "winter" ? [] : [
    [TREE.x - 10, 30],
    [TREE.x + 13, 28],
    [TREE.x + 3, 37],
  ]) {
    rect(W(x), H(y + 1), 4, 2, P.berry);
    rect(W(x + 1), H(y), 2, 4, P.berry);
    dot(W(x + 2), H(y + 1), "#b5d3fb");
    dot(W(x + 1), H(y - 1), P.leaf0);
  }
  return { canvas, x: ox, y: oy, baseY: TREE.y };
}

// Seasonal ground details over the cached background: spring buds, autumn leaf litter,
// winter frost and an icy pond rim. Summer is the original garden.
export function drawSeasonGround(season) {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  if (season === "summer") return canvas;
  const c = canvas.getContext("2d");
  const { rect, dot, ellipse } = pen(c);
  const rand = rng(season === "spring" ? 31 : season === "autumn" ? 57 : 83);
  const inPondArea = (x, y) => ((x - POND.x) / (POND.rx + 4)) ** 2 + ((y - POND.y) / (POND.ry + 3)) ** 2 < 1;
  // Keep the stepping-stone path and the flower bed readable in every season.
  const onPath = (x, y) => Math.abs(x - HOME.x) < 9 && y > 80;
  const clear = (x, y) => !inPondArea(x, y) && !onPath(x, y) && y >= 38 && y < 119 && x > 1 && x < 158;
  if (season === "spring") {
    // A few small clumps of spring flowers: each a leafy base with 2-3 stemmed blooms.
    const clumps = [[66, 52], [118, 48], [148, 66], [40, 88], [104, 112], [150, 112], [78, 100]];
    clumps.forEach(([cx, cy], i) => {
      if (!clear(cx, cy)) return;
      ellipse(cx, cy + 1, 4, 1.5, P.grassDarker);
      const color = [P.white, P.pink, P.yellow, P.violet][i % 4];
      for (const [dx, h] of [[-2, 2], [1, 3], [3, 2]].slice(0, 2 + (i % 2))) {
        rect(cx + dx, cy - h + 1, 1, h, P.grassDark);
        dot(cx + dx - 1, cy - h, color);
        dot(cx + dx + 1, cy - h, color);
        dot(cx + dx, cy - h - 1, color);
        dot(cx + dx, cy - h, P.yellow);
      }
    });
  } else if (season === "autumn") {
    const colors = ["#cf6f30", "#e5993c", "#a4502b", "#f3c35a"];
    // Fallen leaves gather in a few soft piles: a wide one under the tree, small drifts
    // by the fence and the path, each a dark base with lighter leaves on top.
    const piles = [[TREE.x - 6, TREE.y + 6, 13, 3], [TREE.x + 14, TREE.y + 3, 7, 2], [88, 42, 6, 1.5], [132, 44, 5, 1.5], [44, 100, 6, 2], [118, 104, 5, 1.5]];
    for (const [cx, cy, rx, ry] of piles) {
      // Only the big pile gets a solid base; small drifts are loose leaves, so they never
      // read as sticks or stones.
      if (rx >= 10) ellipse(cx, cy, rx - 2, ry - 0.5, "#a4502b", ragged(0.55, 3));
      for (let i = 0; i < rx * 3; i++) {
        const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 1.25;
        const x = Math.round(cx + Math.cos(a) * d * rx), y = Math.round(cy + Math.sin(a) * d * (ry + 1));
        if (!clear(x, y) && rx < 10) continue;
        rect(x, y, 2, 1, colors[i % 4]);
        if (i % 3 === 0) dot(x + 1, y - 1, colors[(i + 1) % 4]);
      }
    }
    // A handful of single leaves blown across the grass.
    for (let i = 0; i < 14; i++) {
      const x = Math.round(20 + rand() * 130), y = Math.round(50 + rand() * 62);
      if (!clear(x, y)) continue;
      rect(x, y, 2, 1, colors[i % 4]);
      dot(x + (i % 2), y - 1, colors[(i + 2) % 4]);
    }
  } else {
    // A light snowfall settles in a few soft drifts: shaded underside, white top.
    const drifts = [[18, 46, 14, 3], [62, 44, 11, 2.5], [128, 42, 16, 3], [148, 80, 9, 3], [50, 84, 10, 3],
      [TREE.x + 18, TREE.y + 8, 9, 2.5], [96, 114, 13, 3], [14, 116, 9, 2.5], [150, 116, 8, 2.5]];
    for (const [cx, cy, rx, ry] of drifts) {
      if (inPondArea(cx, cy) || onPath(cx, cy)) continue;
      ellipse(cx, cy + 1, rx, ry, FROST, ragged(0.3, 4));
      ellipse(cx, cy, rx - 1, ry - 0.5, SNOW, ragged(0.35, 4));
    }
    // Snow along the fence rails, in clean continuous lines.
    rect(0, 25, 160, 1, SNOW);
    rect(0, 30, 160, 1, FROST);
    // A thin rim of ice inside the pond's edge.
    for (let a = 0; a < 180; a++) {
      const ang = (a / 180) * Math.PI * 2;
      dot(Math.round(POND.x + Math.cos(ang) * (POND.rx - 1)), Math.round(POND.y + Math.sin(ang) * (POND.ry - 1)), "#cfe4ee");
    }
  }
  return canvas;
}

// Foreground bush and grass lip: always in front of the Pokémon.
export function drawForeground() {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const c = canvas.getContext("2d");
  const { rect, ellipse } = pen(c);
  const rand = rng(7);
  const bush = (cx, cy, r) => {
    ellipse(cx, cy, r + 1, r * 0.75 + 1, P.outline);
    ellipse(cx, cy, r, r * 0.75, P.leaf1);
    ellipse(cx + 2, cy - 2, r - 3, r * 0.75 - 3, P.leaf2);
    ellipse(cx + 3, cy - 3, r - 7, r * 0.75 - 6, P.leaf3);
  };
  bush(152, 116, 11);
  bush(141, 121, 8);
  rect(151, 109, 2, 2, P.pink);
  rect(146, 113, 2, 2, P.pink);
  rect(156, 112, 2, 2, P.white);
  for (let x = 0; x < 132; x += 2 + Math.floor(rand() * 3)) {
    const h = 2 + Math.floor(rand() * 3);
    rect(x, 120 - h, 1, h, rand() < 0.5 ? P.grassDarker : P.grassDark);
  }
  return canvas;
}
