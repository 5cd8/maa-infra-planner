import test from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/core/validator.js";
import { addPlan, createProject } from "../src/core/model.js";
import { buildOperBox } from "../src/core/operbox.js";
import { nameIndex } from "./helpers.js";

const codes = (project, operbox = null) => validate(project, nameIndex, operbox).map((i) => i.code);
const box = (...ops) => buildOperBox(ops.map(([id, name, own]) => ({ id, name, own })));

test("V1 E1: 同一プラン内の重複", () => {
  const p = createProject();
  p.plans[0].rooms.control[0].operators = ["ケルシー"];
  assert.ok(!codes(p).includes("dup-operator"));
  p.plans[0].rooms.meeting[0].operators = ["ケルシー"];
  assert.ok(codes(p).includes("dup-operator"));
  p.plans[0].rooms.meeting[0].operators = [];
  p.plans[0].rooms.control[0].operators = ["ケルシー", "ケルシー"];
  assert.ok(codes(p).includes("dup-operator"));
});

test("V1 E1: 別プランの同名・candidates は対象外", () => {
  const p = createProject();
  addPlan(p);
  p.plans[0].rooms.control[0].operators = ["ケルシー"];
  p.plans[1].rooms.control[0].operators = ["ケルシー"];
  p.plans[0].rooms.control[0].candidates = ["ケルシー"];
  assert.ok(!codes(p).includes("dup-operator"));
});

test("V2 E2: autofill と candidates", () => {
  const p = createProject();
  p.plans[0].rooms.dormitory[0].candidates = ["ケルシー"];
  assert.ok(codes(p).includes("autofill-candidates"));
  p.plans[0].rooms.dormitory[0].autofill = false;
  assert.ok(!codes(p).includes("autofill-candidates"));
});

test("V3 E3: 6人以上はエラー、5人はエラーでない", () => {
  const p = createProject();
  const six = ["ケルシー", "アーミヤ", "チェン", "レッド", "ア", "シュウ"];
  p.plans[0].rooms.control[0].operators = six.slice(0, 5);
  assert.ok(!codes(p).includes("too-many"));
  p.plans[0].rooms.control[0].operators = six;
  assert.ok(codes(p).includes("too-many"));
  assert.ok(!codes(p).includes("capacity"));
});

test("V4 E4: period の形式", () => {
  const p = createProject();
  p.plans[0].periods = [["22:00", "02:00"]];
  assert.ok(!codes(p).includes("period-format"));
  p.plans[0].periods = [["25:00", "02:00"]];
  assert.ok(codes(p).includes("period-format"));
  p.plans[0].periods = [["08:00"]];
  assert.ok(codes(p).includes("period-format"));
});

test("V5 E5: drones の施設番号", () => {
  const p = createProject();
  p.plans[0].drones = { enable: true, room: "trading", index: 2, order: "pre" };
  assert.ok(!codes(p).includes("drones-index"));
  p.plans[0].drones.index = 3;
  assert.ok(codes(p).includes("drones-index"));
  p.plans[0].drones.index = 0;
  assert.ok(codes(p).includes("drones-index"));
  p.plans[0].drones.enable = false;
  assert.ok(!codes(p).includes("drones-index"));
});

test("V6 E6: Fiammetta の target", () => {
  const p = createProject();
  p.plans[0].fiammetta.enable = true;
  assert.ok(codes(p).includes("fiammetta-target"));
  p.plans[0].fiammetta.target = "プロヴァイゾ";
  assert.ok(!codes(p).includes("fiammetta-target"));
});

test("V7 E7: product", () => {
  const p = createProject();
  p.plans[0].rooms.manufacture[0].product = "Pure Gold";
  assert.ok(!codes(p).includes("product"));
  p.plans[0].rooms.manufacture[0].product = "Gold";
  assert.ok(codes(p).includes("product"));
});

test("V8 W1: 未所持。OperBox未読み込みでは出ない", () => {
  const p = createProject();
  p.plans[0].rooms.control[0].operators = ["ケルシー"];
  p.plans[0].fiammetta.target = "チェン";
  assert.ok(!codes(p).includes("not-owned"));
  const owned = box(["char_003_kalts", "ケルシー", true], ["char_010_chen", "チェン", false]);
  const found = validate(p, nameIndex, owned).filter((i) => i.code === "not-owned");
  assert.equal(found.length, 1);
  assert.match(found[0].message, /チェン/);
});

test("V9 W2: 未解決名には W1 を出さない", () => {
  const p = createProject();
  p.plans[0].rooms.control[0].operators = ["不明な人"];
  const found = codes(p, box(["char_003_kalts", "ケルシー", true]));
  assert.ok(found.includes("unresolved"));
  assert.ok(!found.includes("not-owned"));
});

function overlapFor(a, b) {
  const p = createProject();
  addPlan(p);
  p.plans[0].periods = [a];
  p.plans[1].periods = [b];
  return codes(p).includes("period-overlap");
}

test("V10 W3: 重なり（日またぎ・端点）", () => {
  assert.equal(overlapFor(["22:00", "02:00"], ["01:00", "05:00"]), true);
  assert.equal(overlapFor(["22:00", "02:00"], ["03:00", "05:00"]), false);
  assert.equal(overlapFor(["08:00", "10:00"], ["10:00", "12:00"]), false);
  assert.equal(overlapFor(["08:00", "10:01"], ["10:00", "12:00"]), true);
  assert.equal(overlapFor(["8:00", "10:00"], ["9:00", "12:00"]), true);
});

test("V11 W4: 標準人数超過", () => {
  const p = createProject();
  p.plans[0].rooms.manufacture[0].operators = ["ケルシー", "アーミヤ", "チェン"];
  assert.ok(!codes(p).includes("capacity"));
  p.plans[0].rooms.manufacture[0].operators.push("レッド");
  assert.ok(codes(p).includes("capacity"));
});

test("V12 W5: 製品と施設の不一致", () => {
  const p = createProject();
  p.plans[0].rooms.manufacture[0].product = "LMD";
  p.plans[0].rooms.trading[0].product = "Pure Gold";
  assert.equal(codes(p).filter((c) => c === "product-room").length, 2);
  p.plans[0].rooms.manufacture[0].product = "Pure Gold";
  p.plans[0].rooms.trading[0].product = "LMD";
  assert.ok(!codes(p).includes("product-room"));
});

test("V13 W6: period が一部のプランだけ", () => {
  const p = createProject();
  addPlan(p);
  assert.ok(!codes(p).includes("period-partial"));
  p.plans[0].periods = [["08:00", "10:00"]];
  assert.ok(codes(p).includes("period-partial"));
  p.plans[1].periods = [["12:00", "14:00"]];
  assert.ok(!codes(p).includes("period-partial"));
});

test("エラーが警告より先に並ぶ", () => {
  const p = createProject();
  p.plans[0].rooms.control[0].operators = ["不明な人"];
  p.plans[0].fiammetta.enable = true;
  const levels = validate(p, nameIndex, null).map((i) => i.level);
  assert.deepEqual(levels, [...levels].sort());
});
