import test from "node:test";
import assert from "node:assert/strict";
import { exportPlan } from "../src/core/exporter.js";
import { createPlan, createProject } from "../src/core/model.js";
import { nameIndex } from "./helpers.js";

const out = (project) => JSON.parse(exportPlan(project, nameIndex));

test("X1: 既定値は省略、配置が空の部屋は {} か {sort:true}、キー順は標準順", () => {
  const project = createProject();
  const rooms = out(project).plans[0].rooms;
  assert.deepEqual(Object.keys(rooms), [
    "control", "manufacture", "trading", "power", "meeting", "hire", "dormitory", "processing", "training",
  ]);
  assert.deepEqual(rooms.manufacture, [{ sort: true }, { sort: true }, { sort: true }, { sort: true }]);
  assert.deepEqual(rooms.power[0], {});
  assert.deepEqual(rooms.dormitory[0], { autofill: true });
  assert.deepEqual(rooms.training, [{}]);
});

test("X1: キーを持たない施設はキー無し。訓練室は skip と operatorsA/B だけ", () => {
  const project = createProject();
  const plan = project.plans[0];
  delete plan.rooms.processing;
  plan.rooms.training[0] = { skip: true, operatorsA: ["ケルシー"], operatorsB: [], operators: ["x"], sort: true };
  const rooms = out(project).plans[0].rooms;
  assert.equal("processing" in rooms, false);
  assert.deepEqual(rooms.training, [{ operatorsA: ["凯尔希"], skip: true }]);
});

test("X2b: Fiammetta/drones は無効でも既定値と異なれば出る", () => {
  const project = createProject();
  const plan = project.plans[0];
  assert.equal("Fiammetta" in out(project).plans[0], false);
  assert.equal("drones" in out(project).plans[0], false);
  plan.fiammetta.target = "ケルシー";
  plan.drones.index = 2;
  const o = out(project).plans[0];
  assert.deepEqual(o.Fiammetta, { enable: false, target: "凯尔希", order: "pre" });
  assert.deepEqual(o.drones, { enable: false, room: "trading", index: 2, order: "pre" });
  plan.fiammetta = { enable: true, target: "", order: "pre" };
  assert.equal(out(project).plans[0].Fiammetta.enable, true);
});

test("X2: ユニコードエスケープなし・BOMなし・インデント2・末尾改行", () => {
  const project = createProject();
  project.title = "テスト";
  project.plans[0].rooms.control[0].operators = ["アーミヤ"];
  const text = exportPlan(project, nameIndex);
  assert.ok(text.includes("阿米娅"));
  assert.ok(!text.includes(String.fromCharCode(92) + "u"));
  assert.notEqual(text.charCodeAt(0), 0xfeff);
  assert.ok(text.startsWith('{\n  "title"'));
  assert.ok(text.endsWith("}\n"));
});

test("X5: 人名が中国語名で出る。未解決名は原文のまま", () => {
  const project = createProject();
  const plan = project.plans[0];
  plan.rooms.control[0].operators = ["ケルシー", "未知の名前"];
  plan.rooms.control[0].candidates = ["アーミヤ"];
  plan.rooms.training[0].operatorsB = ["ケルシー"];
  plan.fiammetta = { enable: true, target: "ケルシー", order: "pre" };
  const o = out(project).plans[0];
  assert.deepEqual(o.rooms.control[0].operators, ["凯尔希", "未知の名前"]);
  assert.deepEqual(o.rooms.control[0].candidates, ["阿米娅"]);
  assert.deepEqual(o.rooms.training[0].operatorsB, ["凯尔希"]);
  assert.equal(o.Fiammetta.target, "凯尔希");
});

test("X6: 日またぎの分割", () => {
  const project = createProject();
  const plan = project.plans[0];
  plan.periods = [["22:00", "02:00"], ["08:00", "10:00"], ["8:00", "10:00"], ["25:00", "01:00"], ["1:00"]];
  assert.deepEqual(out(project).plans[0].period, [
    ["22:00", "23:59"], ["00:00", "02:00"], ["08:00", "10:00"], ["8:00", "10:00"], ["25:00", "01:00"], ["1:00"],
  ]);
});

test("部屋数が layout と合わない配列は layout に合わせて出る", () => {
  const project = createProject();
  project.plans.push(createPlan({ ...project.layout, trading: 1 }));
  assert.equal(out(project).plans[1].rooms.trading.length, 2);
});
