import test from "node:test";
import assert from "node:assert/strict";
import { renderSnapshot, snapshotName, saveSnapshot, BAND } from "../src/snapshot.js";

function fakeDocument() {
  const calls = [], anchors = [];
  const context = () => new Proxy({ imageSmoothingEnabled: true, fillStyle: "", font: "", textBaseline: "" }, {
    get: (t, k) => k in t ? t[k] : (...args) => { calls.push([k, ...args]); },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return {
    calls, anchors,
    body: { append(a) { anchors.push(a); } },
    createElement(tag) {
      if (tag === "canvas") return { width: 0, height: 0, getContext: context, toDataURL: () => "data:image/png;base64,AAAA" };
      return { tag, click() { this.clicked = true; }, remove() { this.removed = true; } };
    },
  };
}

test("a snapshot keeps the garden pixel for pixel and adds a caption band", () => {
  const doc = fakeDocument();
  const canvas = renderSnapshot({ width: 640, height: 480 }, { nickname: "Dario", form: "Charmander", days: 42 }, doc);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 480 + BAND * 4, "band scales with the canvas");
  assert.ok(doc.calls.some(([k, src, x, y]) => k === "drawImage" && x === 0 && y === 0));
  const text = doc.calls.find(([k]) => k === "fillText");
  assert.equal(text[1], "Dario · Charmander · day 42");
  assert.equal(renderSnapshot(null, {}, doc), null);
  assert.equal(renderSnapshot({ width: 0, height: 0 }, {}, doc), null);
  assert.equal(renderSnapshot({ width: 160, height: 120 }, { form: "Squirtle" }, doc).height, 120 + BAND);
  assert.equal(doc.calls.filter(([k]) => k === "fillText").at(-1)[1], "Squirtle");
});
test("snapshot files are named safely and the download is an ordinary anchor click", () => {
  assert.equal(snapshotName("Dario Jr!", new Date(2026, 9, 8)), "hermes-pokemon-dario-jr-2026-10-08.png");
  assert.equal(snapshotName("", new Date(2026, 0, 1)), "hermes-pokemon-garden-2026-01-01.png");
  assert.equal(snapshotName("日本", new Date(2026, 0, 1)), "hermes-pokemon-garden-2026-01-01.png");
  const doc = fakeDocument();
  const name = saveSnapshot({ width: 320, height: 240 }, { nickname: "Brook" }, doc);
  assert.match(name, /^hermes-pokemon-brook-\d{4}-\d{2}-\d{2}\.png$/);
  assert.equal(doc.anchors.length, 1);
  assert.equal(doc.anchors[0].download, name);
  assert.ok(doc.anchors[0].href.startsWith("data:image/png"));
  assert.ok(doc.anchors[0].clicked && doc.anchors[0].removed);
  assert.equal(saveSnapshot(null, {}, doc), null);
});
