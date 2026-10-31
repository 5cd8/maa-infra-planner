import test from "node:test";
import assert from "node:assert/strict";
import { parseOperBox, isOwned } from "../src/core/operbox.js";
import { nameIndex } from "./helpers.js";

const kalts = { id: "char_003_kalts", name: "ケルシー", elite: 2, level: 90, own: true, potential: 1, rarity: 6 };
const amiya3 = { id: "char_1037_amiya3", name: "アーミヤ", elite: 2, level: 80, own: true, potential: 1, rarity: 5 };

test("O1: BOM付きを読める", () => {
  const box = parseOperBox("\uFEFF" + JSON.stringify([kalts, amiya3]), nameIndex);
  assert.equal(box.operators.length, 2);
});

test("O1: 配列でない・必須キー欠落はエラー", () => {
  assert.throws(() => parseOperBox("{}", nameIndex), /配列/);
  assert.throws(() => parseOperBox(JSON.stringify([kalts, { id: "x", name: "y" }]), nameIndex), /2番目.*own/);
});

test("O1: 任意キーが無ければ null", () => {
  const box = parseOperBox(JSON.stringify([{ id: "char_003_kalts", name: "ケルシー", own: true }]), nameIndex);
  const o = box.operators.find((x) => x.id === "char_003_kalts");
  assert.equal(o.elite, null);
  assert.equal(o.level, null);
  assert.equal(o.rarity, null);
});

test("O2: アーミヤの名前が無いときだけ補完する", () => {
  const without = parseOperBox(JSON.stringify([kalts]), nameIndex);
  const added = without.operators.find((o) => o.id === "char_002_amiya");
  assert.equal(added.name, "アーミヤ");
  assert.equal(added.source, "名前表");
  const withAmiya3 = parseOperBox(JSON.stringify([kalts, amiya3]), nameIndex);
  assert.equal(withAmiya3.operators.some((o) => o.id === "char_002_amiya"), false);
});

test("O2: isOwned はID重複を考慮し、未読み込みは null", () => {
  const box = parseOperBox(JSON.stringify([kalts, amiya3]), nameIndex);
  assert.equal(isOwned("アーミヤ", nameIndex, box), true);
  assert.equal(isOwned("チェン", nameIndex, box), false);
  assert.equal(isOwned("ケルシー", nameIndex, null), null);
  const notOwned = parseOperBox(JSON.stringify([{ ...kalts, own: false }]), nameIndex);
  assert.equal(isOwned("ケルシー", nameIndex, notOwned), false);
});
