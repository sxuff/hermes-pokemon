import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, unlink, utimes, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { packagePlugin } from "../scripts/package.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "hermes-pokemon-package-test-"));
  t.after(async () => {
    // Remove only the direct temp child created by this test, on every platform.
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.match(basename(root), /^hermes-pokemon-package-test-/);
    await rm(root, { recursive: true, force: true });
  });
  const source = join(root, "dist", "hermes-pokemon");
  await mkdir(join(source, "docs"), { recursive: true });
  const plugin = 'export default { id: "hermes-pokemon", register() {} };\n';
  await writeFile(join(root, "package.json"), JSON.stringify({ version: "0.4.0" }));
  await writeFile(join(source, "plugin.js"), plugin);
  await writeFile(join(source, "build-info.json"), JSON.stringify({ version: "0.4.0", sha256: sha256(plugin) }));
  for (const file of ["README.md", "LICENSE", "CREDITS.md", "docs/SDK.md", "docs/VERIFICATION.md"])
    await writeFile(join(source, file), `Fixture ${file}\n`);
  return { root, source };
}

test("release ZIP and checksum are reproducible despite file timestamp changes", async (t) => {
  const { root, source } = await fixture(t);
  const first = await packagePlugin(root);
  const path = join(root, "release", first.filename);
  const original = await readFile(path);
  await utimes(join(source, "plugin.js"), new Date("2001-02-03T04:05:06Z"), new Date("2001-02-03T04:05:06Z"));
  const second = await packagePlugin(root);
  assert.deepEqual(await readFile(path), original);
  assert.equal(second.checksum, first.checksum);
  assert.equal(first.checksum, `${sha256(original)}  hermes-pokemon-0.4.0.zip\n`);
  assert.equal(await readFile(join(root, "release", "hermes-pokemon-0.4.0.sha256"), "utf8"), first.checksum);
});

test("packaging rejects a bundle modified after build-info was generated", async (t) => {
  const { root, source } = await fixture(t);
  await writeFile(join(source, "plugin.js"), "// changed after build\n");
  await assert.rejects(packagePlugin(root), /checksum differs/);
});

test("packaging rejects unexpected files instead of including local data", async (t) => {
  const { root, source } = await fixture(t);
  await writeFile(join(source, "private.env"), "TEST_FIXTURE_ONLY=true\n");
  await assert.rejects(packagePlugin(root), /Unexpected package entry: private.env/);
});

test("packaging rejects a stale build version", async (t) => {
  const { root } = await fixture(t);
  await writeFile(join(root, "package.json"), JSON.stringify({ version: "0.5.0" }));
  await assert.rejects(packagePlugin(root), /Build version 0.4.0 differs from package version 0.5.0/);
});

test("packaging rejects missing release documentation", async (t) => {
  const { root, source } = await fixture(t);
  await unlink(join(source, "LICENSE"));
  await assert.rejects(packagePlugin(root), /Release files are missing/);
});
