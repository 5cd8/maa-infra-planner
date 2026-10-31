import test from "node:test";
import assert from "node:assert/strict";
import { createStorage } from "../src/core/storage.js";
import { createProject } from "../src/core/model.js";
import { buildOperBox } from "../src/core/operbox.js";

function memoryBackend() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
}
const throwing = {
  getItem() { throw new Error("denied"); },
  setItem() { throw new Error("denied"); },
};

test("S1: 保存→復元で project・operbox が等しい", () => {
  const storage = createStorage(memoryBackend());
  const project = createProject();
  const operbox = buildOperBox([
    { id: "char_003_kalts", name: "ケルシー", elite: 2, level: 90, own: true, potential: 1, rarity: 6, extra: "x" },
  ]);
  storage.saveNow(project, operbox);
  const loaded = storage.load();
  assert.deepEqual(loaded.project, project);
  assert.deepEqual(loaded.operbox.operators, [
    { id: "char_003_kalts", name: "ケルシー", elite: 2, level: 90, own: true, potential: 1, rarity: 6 },
  ]);
});

test("S1: localStorage が例外を投げても落ちない", () => {
  const storage = createStorage(throwing);
  storage.saveNow(createProject(), null);
  assert.equal(storage.load(), null);
});

test("S1: version 不一致・壊れたデータは破棄", () => {
  const backend = memoryBackend();
  const storage = createStorage(backend);
  backend.setItem("maa-infra-planner:v1", JSON.stringify({ version: 2, project: {} }));
  assert.equal(storage.load(), null);
  backend.setItem("maa-infra-planner:v1", "{broken");
  assert.equal(storage.load(), null);
});

test("S1: 保存はデバウンスされ最後の内容だけ書く", () => {
  const backend = memoryBackend();
  const timers = [];
  const storage = createStorage(backend, {
    setTimer: (fn) => timers.push(fn) - 1,
    clearTimer: (id) => { timers[id] = () => {}; },
  });
  const a = createProject();
  a.title = "a";
  const b = createProject();
  b.title = "b";
  storage.save(a, null);
  storage.save(b, null);
  timers.forEach((fn) => fn());
  assert.equal(storage.load().project.title, "b");
});

test("flush: デバウンス待ちの保存を即時に書き切る", () => {
  const written = [];
  const timers = [];
  const storage = createStorage(
    { getItem: () => null, setItem: (k, v) => written.push(v) },
    { setTimer: (fn) => timers.push(fn) - 1, clearTimer: () => {} },
  );
  storage.flush();
  assert.equal(written.length, 0);
  storage.save(createProject(), null);
  assert.equal(written.length, 0);
  storage.flush();
  assert.equal(written.length, 1);
  storage.flush();
  assert.equal(written.length, 1);
});
