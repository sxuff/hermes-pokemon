import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const { version: VERSION } = JSON.parse(await readFile("package.json", "utf8"));
const manifest = await readFile("plugin.yaml", "utf8");
if (!manifest.includes(`version: "${VERSION}"`)) throw new Error("plugin.yaml version must match package.json");
// Sheets bundled per species. Single-row sheets face the viewer (or away, for LookUp/Sit).
export const ANIMS = [
  "Idle",
  "Walk",
  "Sleep",
  "Wake",
  "Laying",
  "Hop",
  "Eat",
  "Nod",
  "Pose",
  "LookUp",
  "Sit",
  "Rotate",
  "DeepBreath",
];

const FORMS = [
  "bulbasaur", "ivysaur", "venusaur",
  "charmander", "charmeleon", "charizard",
  "squirtle", "wartortle", "blastoise",
];
// These five original sets do not have the extended gesture sheets. Keep the
// original art intact and explicitly reuse that form's Idle; never another Pokémon.
// Wild visitors: a few small sheets each, never a companion.
export const VISITORS = ["pidgey", "caterpie", "magikarp", "hoothoot"];
const VISITOR_ANIMS = ["Idle", "Walk", "Hop"];
// Extra gestures, bundled wherever the pinned set has a real sheet for that form. A form without
// one reuses its own nearest existing move (never another Pokémon's art).
export const EXTRA_ANIMS = {
  LeapForth: "Hop", Tumble: "Rotate", Trip: "Nod", Charge: "DeepBreath",
  EventSleep: "Sleep", Shake: "Rotate", Withdraw: "Laying", Kick: "Nod",
};
const IDLE_ALIASES = ["Wake", "Laying", "Eat", "Nod", "Pose", "LookUp", "Sit", "DeepBreath"];
const LIMITED_FORMS = new Set(["ivysaur", "venusaur", "charizard", "wartortle", "blastoise"]);

// Minimal PNG decoder (8-bit grey/RGB/palette/RGBA), used only for build-time geometry.
function decodePng(buffer) {
  let pos = 8,
    width,
    height,
    type,
    depth,
    palette,
    idat = [];
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos),
      name = buffer.toString("ascii", pos + 4, pos + 8),
      data = buffer.subarray(pos + 8, pos + 8 + length);
    if (name === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
    } else if (name === "PLTE") palette = data;
    else if (name === "IDAT") idat.push(data);
    pos += 12 + length;
  }
  if (depth !== 8 || ![0, 2, 3, 4, 6].includes(type))
    throw new Error(`Unsupported PNG format ${type}/${depth}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = inflateSync(Buffer.concat(idat)),
    stride = width * channels,
    pixels = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)],
      line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0,
        b = prev[i],
        c = i >= channels ? prev[i - channels] : 0;
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      line[i] =
        (line[i] +
          [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter]) &
        255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4,
        s = x * channels;
      if (type === 6) line.copy(pixels, o, s, s + 4);
      else if (type === 2) pixels.set([line[s], line[s + 1], line[s + 2], 255], o);
      else if (type === 3)
        pixels.set([...palette.subarray(line[s] * 3, line[s] * 3 + 3), 255], o);
      else pixels.set([line[s], line[s], line[s], type === 4 ? line[s + 1] : 255], o);
    }
    prev = line;
  }
  return { width, height, pixels };
}

// The white pixel in each Shadow frame marks where the body meets the ground. Some sheets
// (e.g. Bulbasaur's walk) shift the body inside the frame, so every frame gets its own anchor.
function anchors(png, width, height, frames, rows) {
  const result = [];
  for (let row = 0; row < rows; row++)
    for (let frame = 0; frame < frames; frame++) {
      let found = [width / 2, height / 2 + 4];
      search: for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const o = ((row * height + y) * png.width + frame * width + x) * 4;
          if (png.pixels[o] === 255 && png.pixels[o + 1] === 255 && png.pixels[o + 2] === 255 && png.pixels[o + 3]) {
            found = [x, y];
            break search;
          }
        }
      result.push(...found);
    }
  // Most sheets have a single constant anchor; store those compactly.
  return result.every((v, i) => v === result[i % 2]) ? result.slice(0, 2) : result;
}

// Transparent frame padding is often much taller than the body (especially Hop).
// Measure real body pixels above the foot anchor so bubbles clear evolved heads.
function visualHeight(png, width, height, frames, rows, offsets) {
  let result = 0;
  for (let row = 0; row < rows; row++)
    for (let frame = 0; frame < frames; frame++) {
      const anchorY = offsets[offsets.length > 2 ? (row * frames + frame) * 2 + 1 : 1];
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const o = ((row * height + y) * png.width + frame * width + x) * 4;
          if (png.pixels[o + 3]) result = Math.max(result, anchorY - y);
        }
    }
  return result;
}

const assets = {},
  meta = {};
const aliasStatements = [];
for (const species of [...FORMS, ...VISITORS]) {
  const anims = VISITORS.includes(species) ? VISITOR_ANIMS : ANIMS;
  const base = `assets/sprites/${species}`;
  const xml = await readFile(`${base}/AnimData.xml`, "utf8");
  const shadowSize = Number(xml.match(/<ShadowSize>(\d+)<\/ShadowSize>/)?.[1] ?? 1);
  assets[species] = {};
  meta[species] = { shadowSize, visualHeight: 0, anims: {} };
  for (const name of anims) {
    if (LIMITED_FORMS.has(species) && IDLE_ALIASES.includes(name)) continue;
    const section = [...xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)]
      .map((m) => m[1])
      .find((s) => s.includes(`<Name>${name}</Name>`));
    if (!section) throw new Error(`Missing animation ${species}/${name}`);
    const width = Number(section.match(/<FrameWidth>(\d+)<\/FrameWidth>/)[1]);
    const height = Number(section.match(/<FrameHeight>(\d+)<\/FrameHeight>/)[1]);
    const durations = [...section.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((m) => Number(m[1]));
    const png = await readFile(`${base}/${name}-Anim.png`);
    const sheetWidth = png.readUInt32BE(16),
      sheetHeight = png.readUInt32BE(20);
    const rows = sheetHeight / height;
    if (sheetWidth !== width * durations.length || ![1, 8].includes(rows))
      throw new Error(`Invalid sprite geometry: ${species}/${name}`);
    const shadow = decodePng(await readFile(`${base}/${name}-Shadow.png`));
    if (shadow.width !== sheetWidth || shadow.height !== sheetHeight)
      throw new Error(`Shadow sheet mismatch: ${species}/${name}`);
    const offsets = anchors(shadow, width, height, durations.length, rows);
    if (["Idle", "Pose", "LookUp"].includes(name))
      meta[species].visualHeight = Math.max(
        meta[species].visualHeight,
        visualHeight(decodePng(png), width, height, durations.length, rows, offsets),
      );
    meta[species].anims[name] = { durations, rows };
    assets[species][name] = {
      width,
      height,
      durations,
      rows,
      anchors: offsets,
      url: `data:image/png;base64,${png.toString("base64")}`,
    };
  }
  if (LIMITED_FORMS.has(species))
    for (const name of IDLE_ALIASES) {
      meta[species].anims[name] = { ...meta[species].anims.Idle, source: "Idle" };
      aliasStatements.push(`assets.${species}.${name} = assets.${species}.Idle;`);
    }
  if (VISITORS.includes(species)) continue;
  for (const [name, fallback] of Object.entries(EXTRA_ANIMS)) {
    const section = [...xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)].map((m) => m[1]).find((s) => s.includes(`<Name>${name}</Name>`));
    let png = null;
    try { png = section && !section.includes("<CopyOf>") ? await readFile(`${base}/${name}-Anim.png`) : null; } catch { png = null; }
    if (!png) {
      const target = meta[species].anims[fallback];
      meta[species].anims[name] = { ...target, source: target.source ?? fallback };
      aliasStatements.push(`assets.${species}.${name} = assets.${species}.${fallback};`);
      continue;
    }
    const width = Number(section.match(/<FrameWidth>(\d+)<\/FrameWidth>/)[1]);
    const height = Number(section.match(/<FrameHeight>(\d+)<\/FrameHeight>/)[1]);
    const durations = [...section.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((m) => Number(m[1]));
    const sheetWidth = png.readUInt32BE(16), sheetHeight = png.readUInt32BE(20), rows = sheetHeight / height;
    if (sheetWidth !== width * durations.length || ![1, 8].includes(rows)) throw new Error(`Invalid sprite geometry: ${species}/${name}`);
    const shadow = decodePng(await readFile(`${base}/${name}-Shadow.png`));
    if (shadow.width !== sheetWidth || shadow.height !== sheetHeight) throw new Error(`Shadow sheet mismatch: ${species}/${name}`);
    meta[species].anims[name] = { durations, rows };
    assets[species][name] = { width, height, durations, rows, anchors: anchors(shadow, width, height, durations.length, rows), url: `data:image/png;base64,${png.toString("base64")}` };
  }
}
await writeFile(
  "src/assets.generated.js",
  `// Generated from bundled original sheets by scripts/build.mjs.\nexport const assets = ${JSON.stringify(assets)};\n// Explicit same-form aliases for poses absent from the pinned originals.\n${aliasStatements.join("\n")}\n`,
);
await writeFile(
  "src/anim-meta.generated.js",
  `// Generated by scripts/build.mjs: animation timing and body geometry, no image data.\nexport const animMeta = ${JSON.stringify(meta)};\n`,
);
await mkdir("dist/hermes-pokemon", { recursive: true });
await build({
  entryPoints: ["src/plugin.jsx"],
  bundle: true,
  outfile: "dist/hermes-pokemon/plugin.js",
  format: "esm",
  target: "es2022",
  external: ["@hermes/plugin-sdk", "react", "react/jsx-runtime"],
  loader: { ".css": "text" },
  jsx: "automatic",
  legalComments: "inline",
  define: { __VERSION__: JSON.stringify(VERSION) },
  banner: {
    js: `// Hermes Pokémon v${VERSION} — bundled sprites: CHUNSOFT and SpriteCollab contributors. See CREDITS.md.`,
  },
});
const output = await readFile("dist/hermes-pokemon/plugin.js");
// The catalog installs a native plugin package directly from a reviewed git pin.
// Commit this ready-to-run entry so installation never needs Node or a build step.
await mkdir("desktop", { recursive: true });
await writeFile("desktop/plugin.js", output);
// The Hermes disk loader accepts only these import specifiers. No runtime relative/asset imports.
const text = output.toString();
for (const match of text.matchAll(/(?:from\s+|import\s*\()(["'])([^"']+)\1/g)) {
  if (!["@hermes/plugin-sdk", "react", "react/jsx-runtime"].includes(match[2]))
    throw new Error(`Unsupported runtime import: ${match[2]}`);
}
const copyText = async (source, target) => writeFile(target, (await readFile(source, "utf8")).replace(/\r\n/g, "\n"));
for (const file of ["README.md", "CREDITS.md", "LICENSE"]) await copyText(file, `dist/hermes-pokemon/${file}`);
await mkdir("dist/hermes-pokemon/docs", { recursive: true });
for (const file of ["SDK.md", "VERIFICATION.md"]) await copyText(`docs/${file}`, `dist/hermes-pokemon/docs/${file}`);
await writeFile(
  "dist/hermes-pokemon/build-info.json",
  JSON.stringify(
    {
      version: VERSION,
      sdkCommit: "439334127f012e1ee0685acd5dba288e459af0ec",
      nativeHostSourceCommit: "8b66a51036c1e20920a17cdd049fdf55c968d683",
      spriteCommit: "29ba3aa2c026fffb47166d2ec647c47d1d9ff305",
      sha256: createHash("sha256").update(output).digest("hex"),
    },
    null,
    2,
  ),
);
await build({
  entryPoints: ["demo/main.jsx"],
  bundle: true,
  outfile: "demo/bundle.js",
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  alias: {
    "@hermes/plugin-sdk": fileURLToPath(new URL("../demo/mock-sdk.js", import.meta.url)),
  },
  define: { "process.env.NODE_ENV": '"production"' },
  sourcemap: true,
});
console.log(
  `Built installable ESM plugin v${VERSION} (${Math.round(output.length / 1024)} KB, all sprites embedded) and browser demo.`,
);
