import { readFile, mkdir, copyFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const source = resolve("dist/hermes-pokemon");
const destination = join(
  process.env.HERMES_HOME || join(homedir(), ".hermes"),
  "desktop-plugins",
  "hermes-pokemon",
);
const info = JSON.parse(
  await readFile(join(source, "build-info.json"), "utf8"),
);
const content = await readFile(join(source, "plugin.js"));
if (createHash("sha256").update(content).digest("hex") !== info.sha256)
  throw new Error("Bundle checksum mismatch. Rebuild before installing.");
await mkdir(destination, { recursive: true });
try {
  await access(join(destination, "plugin.js"));
  await copyFile(
    join(destination, "plugin.js"),
    join(destination, "plugin.js.backup"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
for (const file of [
  "README.md",
  "CREDITS.md",
  "LICENSE",
  "build-info.json",
  "plugin.js",
])
  await copyFile(join(source, file), join(destination, file));
await mkdir(join(destination, "docs"), { recursive: true });
for (const file of ["SDK.md", "VERIFICATION.md"])
  await copyFile(join(source, "docs", file), join(destination, "docs", file));
console.log(
  `Installed ${destination}\nEnable Hermes Pokémon in Capabilities → Plugins. Use Reload desktop plugins if needed.`,
);
