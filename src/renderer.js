import { assets } from "./assets.generated.js";
import { drawBackground, drawForeground, drawTree, P, pen } from "./garden.js";
import { Ambient, GRADES, bitmap, drawBubble } from "./ambient.js";
import { WORLD } from "./world.js";
import { SPECIES } from "./species.js";
import { animMeta } from "./anim-meta.generated.js";

const ZZ = ["1111", "0010", "0100", "1111"];
const ZZ_SMALL = ["111", "001", "010", "111"];

const images = new Map();
function loadImage(url) {
  if (!images.has(url))
    images.set(
      url,
      new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      }),
    );
  return images.get(url);
}
export async function loadSprites(species) {
  const entries = await Promise.all(
    Object.entries(assets[species]).map(async ([name, data]) => [name, { ...data, image: await loadImage(data.url) }]),
  );
  return Object.fromEntries(entries);
}

export function frameAt(anim, clock, once) {
  const total = anim.durations.reduce((sum, d) => sum + d, 0);
  let t = once ? Math.min(clock, total - 0.001) : clock % total,
    frame = 0;
  while (t >= anim.durations[frame] && frame < anim.durations.length - 1) t -= anim.durations[frame++];
  return frame;
}

// Draw one frame so that its shadow anchor lands exactly on (x, y), the Pokémon's feet.
export function drawSprite(c, sprites, name, clock, dir, x, y, { once = false, reduced = false, k = 1 } = {}) {
  const a = sprites[name] || sprites.Idle;
  const frame = reduced ? (once ? a.durations.length - 1 : 0) : frameAt(a, clock, once);
  const row = a.rows === 1 ? 0 : dir;
  const i = a.anchors.length > 2 ? (row * a.durations.length + frame) * 2 : 0;
  const snap = (v) => Math.round(v * k) / k;
  c.drawImage(a.image, frame * a.width, row * a.height, a.width, a.height, snap(x - a.anchors[i]), snap(y - a.anchors[i + 1]), a.width, a.height);
}

const BALL = [
  ["..###..", ".#rrr#.", "#rrRrr#", "#kkwkk#", "#wwwww#", ".#www#.", "..###.."],
  ["..###..", ".#rrr#.", "#rrrrr#", "#rkkkw#", "#wwwww#", ".#www#.", "..###.."],
  ["..###..", ".#rrr#.", "#rrrrr#", "#wkkkr#", "#wwwww#", ".#www#.", "..###.."],
];
const BALL_COLORS = { "#": "#2c3a33", r: "#e5544b", R: "#ffb3a8", w: "#f7f4ea", k: "#2c3a33" };
function drawPixels(c, rows, x, y, colors) {
  rows.forEach((row, iy) =>
    [...row].forEach((ch, ix) => {
      if (colors[ch]) {
        c.fillStyle = colors[ch];
        c.fillRect(x + ix, y + iy, 1, 1);
      }
    }),
  );
}

export function createRenderer(canvas, sprites, species, form = species) {
  const c = canvas.getContext("2d");
  const background = drawBackground(),
    tree = drawTree(),
    foreground = drawForeground();
  const ambient = new Ambient();
  const sp = SPECIES[species];
  let k = 1,
    bubbleLift = 0,
    snapCamera = true;
  // Narrow panes get a closer, gently following camera so the Pokémon stays readable.
  const view = { x: 0, y: 0, w: WORLD.width, h: WORLD.height };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function follow(pet, snap) {
    const tx = clamp(pet.x - view.w / 2, 0, WORLD.width - view.w),
      ty = clamp(pet.y - 12 - view.h / 2, 0, WORLD.height - view.h);
    view.x = snap ? tx : view.x + (tx - view.x) * 0.08;
    view.y = snap ? ty : view.y + (ty - view.y) * 0.08;
  }

  function shadow(x, y, rx) {
    c.globalAlpha = 0.4;
    pen(c).ellipse(Math.round(x), Math.round(y) + 1, rx, Math.max(1, Math.round(rx * 0.36)), "#1f3d26");
    c.globalAlpha = 1;
  }
  function drawPet(pet, reduced) {
    const anim = pet.anim;
    const shadowRx = [5, 8, 10][animMeta[pet.form || form].shadowSize] || 8;
    if (pet.swimming) {
      // Only the top of a swimming Pokémon shows above the waterline.
      c.save();
      c.beginPath();
      c.rect(0, 0, WORLD.width, Math.round(pet.y - 3));
      c.clip();
      drawSprite(c, sprites, anim.name, pet.animClock, pet.dir, pet.x, pet.y, { once: anim.once, reduced, k });
      c.restore();
      c.globalAlpha = 0.85;
      const t = pet.time;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2 + (reduced ? 0 : t);
        c.fillStyle = P.water3;
        c.fillRect(Math.round(pet.x + Math.cos(ang) * 8), Math.round(pet.y - 3 + Math.sin(ang) * 2.5), 1, 1);
      }
      c.globalAlpha = 1;
      return;
    }
    shadow(pet.x, pet.y, shadowRx);
    drawSprite(c, sprites, anim.name, pet.animClock, pet.dir, pet.x, pet.y, { once: anim.once, reduced, k });
  }
  function drawBall(ball, reduced) {
    if (ball.phase !== "carried") shadow(ball.x, ball.y, Math.max(2, 3 - ball.z / 12));
    const frame = reduced ? 0 : Math.floor(ball.spin) % 3;
    drawPixels(c, BALL[frame], Math.round(ball.x - 3), Math.round(ball.y - 6 - ball.z), BALL_COLORS);
  }
  function drawTreat(treat) {
    shadow(treat.x, treat.y, 2);
    const x = Math.round(treat.x - 2),
      y = Math.round(treat.y - 5 - treat.z);
    const rows = [".gg..", "bbbb.", "bLbbb", "bbbbb", ".bbb."].map((row, i) =>
      i >= 5 - treat.bites ? row.replace(/[bL]/g, ".") : row,
    );
    drawPixels(c, rows, x, y, { b: P.berry, L: "#a9cdfb", g: P.leaf2 });
  }

  function draw(pet, phase, reduced) {
    follow(pet, reduced || snapCamera);
    snapCamera = false;
    c.setTransform(k, 0, 0, k, -Math.round(view.x * k), -Math.round(view.y * k));
    c.imageSmoothingEnabled = false;
    for (const event of pet.drain()) ambient.handle(event, pet);
    c.drawImage(background, 0, 0);
    ambient.drawBack(c, phase, reduced);
    // Depth-sort everything that stands on the ground.
    const items = [{ y: tree.baseY, draw: () => c.drawImage(tree.canvas, tree.x, tree.y) }];
    items.push({ y: pet.swimming ? pet.y - 6 : pet.y, draw: () => drawPet(pet, reduced) });
    if (pet.ball) items.push({ y: pet.ball.phase === "carried" ? pet.y + 0.5 : pet.ball.y, draw: () => drawBall(pet.ball, reduced) });
    if (pet.ball?.phase === "carried") bubbleLift = 9;
    else bubbleLift = 0;
    if (pet.treat) items.push({ y: pet.treat.y, draw: () => drawTreat(pet.treat) });
    items.sort((a, b) => a.y - b.y).forEach((item) => item.draw());
    c.drawImage(foreground, 0, 0);
    ambient.drawFront(c, phase, reduced);
    // Time-of-day grade over the whole scene, then lights that should glow through it.
    const grade = GRADES[phase];
    if (grade.tint) {
      c.globalCompositeOperation = "multiply";
      c.fillStyle = grade.tint;
      c.fillRect(0, 0, WORLD.width, WORLD.height);
      c.globalAlpha = 0.55;
      c.fillStyle = grade.sky;
      c.fillRect(0, 0, WORLD.width, 22);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    }
    const flame = sp.glow && !pet.swimming ? { x: pet.x + [-5, -6, -7, -3, 5, 6, 7, 3][pet.dir], y: pet.y - 10 } : null;
    ambient.drawLights(c, phase, flame, reduced);
    const bodyHeight = animMeta[pet.form || form].visualHeight || 22;
    if (pet.bubble) drawBubble(c, pet.bubble, pet.x, pet.y - Math.max(pet.swimming ? 20 : 26, bodyHeight + 4) - bubbleLift, pet.time, reduced);
    if (pet.asleep && !reduced) {
      // Two little Zs drift up and fade.
      for (let i = 0; i < 2; i++) {
        const q = (pet.time * 0.45 + i * 0.5) % 1;
        c.globalAlpha = q < 0.75 ? 1 : (1 - q) / 0.25;
        bitmap(c, q < 0.4 ? ZZ_SMALL : ZZ, Math.round(pet.x + 6 + q * 6), Math.round(pet.y - Math.max(18, bodyHeight - 4) - q * 12), "#fffdf3");
        c.globalAlpha = 1;
      }
    }
  }
  return {
    ambient,
    // Backing store is an integer multiple of the art grid; CSS scales it with pixelated sampling.
    resize(cssWidth, dpr) {
      snapCamera = true;
      const zoom = cssWidth < 300 ? 1.4 : 1;
      view.w = Math.round(WORLD.width / zoom);
      view.h = Math.round(WORLD.height / zoom);
      k = Math.max(1, Math.min(8, Math.round((cssWidth * dpr) / view.w)));
      if (canvas.width !== view.w * k || canvas.height !== view.h * k) {
        canvas.width = view.w * k;
        canvas.height = view.h * k;
      }
    },
    // Canvas fraction (0–1) → garden coordinates, through the camera.
    toWorld(fx, fy) {
      return { x: view.x + fx * view.w, y: view.y + fy * view.h };
    },
    tick(dt, phase, reduced) {
      ambient.tick(dt, phase, reduced);
    },
    draw,
  };
}
