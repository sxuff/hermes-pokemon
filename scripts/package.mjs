import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const FILES = ["CREDITS.md", "LICENSE", "README.md", "build-info.json", "docs/SDK.md", "docs/VERIFICATION.md", "plugin.js"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function listFiles(base, directory = "") {
  const files = [];
  for (const entry of await readdir(join(base, directory), { withFileTypes: true })) {
    const name = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory() && name === "docs") files.push(...await listFiles(base, name));
    else if (entry.isFile() && FILES.includes(name)) files.push(name);
    else throw new Error(`Unexpected package entry: ${name}. Only release files are allowed.`);
  }
  return files.sort();
}

// ZIP32, STORE method: no platform-dependent compressor, timestamps or permissions.
// Fixed order, UTF-8 names and a 1980-01-01 timestamp make identical inputs reproducible.
function createZip(files) {
  const local = [], central = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    if (bytes.length > 0xffffffff) throw new Error("Package exceeds ZIP32 size limits.");
    const filename = Buffer.from(`hermes-pokemon/${name}`, "utf8");
    const checksum = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(0x0021, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, bytes);

    const index = Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50, 0);
    index.writeUInt16LE(0x0314, 4);
    index.writeUInt16LE(20, 6);
    index.writeUInt16LE(0x0800, 8);
    index.writeUInt16LE(0x0021, 14);
    index.writeUInt32LE(checksum, 16);
    index.writeUInt32LE(bytes.length, 20);
    index.writeUInt32LE(bytes.length, 24);
    index.writeUInt16LE(filename.length, 28);
    index.writeUInt32LE((0o100644 * 65536) >>> 0, 38);
    index.writeUInt32LE(offset, 42);
    central.push(index, filename);
    offset += header.length + filename.length + bytes.length;
    if (offset > 0xffffffff) throw new Error("Package exceeds ZIP32 size limits.");
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

export async function packagePlugin(root = ROOT) {
  const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error("Invalid package version.");
  const source = join(root, "dist", "hermes-pokemon");
  if ((await listFiles(source)).join("\n") !== FILES.join("\n")) throw new Error("Release files are missing. Run npm run build first.");
  const files = await Promise.all(FILES.map(async (name) => ({ name, bytes: await readFile(join(source, name)) })));
  const info = JSON.parse(files.find((file) => file.name === "build-info.json").bytes.toString("utf8"));
  if (info.version !== version) throw new Error(`Build version ${info.version} differs from package version ${version}. Rebuild first.`);
  if (sha256(files.find((file) => file.name === "plugin.js").bytes) !== info.sha256)
    throw new Error("Plugin checksum differs from build-info.json. Rebuild first.");

  const archive = createZip(files), filename = `hermes-pokemon-${version}.zip`;
  const destination = join(root, "release");
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, filename), archive);
  const checksum = `${sha256(archive)}  ${filename}\n`;
  await writeFile(join(destination, `hermes-pokemon-${version}.sha256`), checksum);
  return { filename, checksum, bytes: archive.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await packagePlugin();
  console.log(`Packaged release/${result.filename} (${result.bytes} bytes, 7 verified files).\n${result.checksum.trim()}`);
}
