import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { importPlan } from "../src/core/importer.js";
import { exportPlan } from "../src/core/exporter.js";
import { createProject } from "../src/core/model.js";
import { fixture, nameIndex, withoutIds } from "./helpers.js";

const imp = (text) => importPlan(typeof text === "string" ? text : JSON.stringify(text), nameIndex);
const exp = (project) => exportPlan(project, nameIndex);
const minimal = (plan, extra = {}) => ({ plans: [{ name: "P", rooms: {}, ...plan }], ...extra });

const schema = JSON.parse(readFileSync(new URL("../schema/maa-infra.schema.json", import.meta.url), "utf8"));
const validateSchema = new Ajv({ strict: false, allErrors: true }).compile(schema);

test("I1: 中国語名が日本語に変換される（§7.2の手計算）", () => {
  const { project, report } = imp(fixture("cn-243-min.json"));
  const [b, a] = project.plans;
  assert.deepEqual(b.rooms.control[0].operators, ["ケルシー"]);
  assert.deepEqual(b.rooms.meeting[0].operators, ["チェン", "レッド"]);
  assert.deepEqual(a.rooms.control[0].operators, ["アーミヤ"]);
  assert.equal(b.fiammetta.target, "プロヴァイゾ");
  // B班: 1 + 2 + 3 + Fiammetta 1 = 7、A班: 1 + 1 + 2 + Fiammetta 1 = 5（回収ステーションは数えない）
  assert.equal(report.converted, 12);
  assert.deepEqual(report.unresolved, []);
});

test("I1b: 拡張 operators は配列形でもIDキーのオブジェクト形でも同じ結果", () => {
  const data = JSON.parse(fixture("cn-243-min.json"));
  const asObject = Object.fromEntries(data.operators.map(({ id, ...rest }) => [id, rest]));
  const a = imp(data);
  const b = imp({ ...data, operators: asObject });
  assert.deepEqual(withoutIds(a.project), withoutIds(b.project));
  // id が名前表に無い要素は名前表の中国語名にフォールバックする
  const c = imp({ ...data, operators: data.operators.map((o) => ({ ...o, id: "char_none" })) });
  assert.deepEqual(withoutIds(a.project), withoutIds(c.project));
});

test("I2: layout から部屋数、recycle と超過は dropped", () => {
  const { project, report } = imp(fixture("cn-243-min.json"));
  assert.deepEqual(
    [project.layout.manufacture, project.layout.trading, project.layout.power, project.layout.dormitory],
    [4, 2, 3, 4],
  );
  assert.deepEqual(report.dropped.filter((d) => d.includes("recycle")).length, 3);
  const many = Array.from({ length: 10 }, () => ({ type: "manufacture" }))
    .concat(Array.from({ length: 5 }, () => ({ type: "dormitory" })));
  const r = imp({ layout: many, plans: [{ name: "P", rooms: { dormitory: [{}, {}, {}, {}, {}] } }] });
  assert.equal(r.project.layout.manufacture, 9);
  assert.equal(r.project.plans[0].rooms.dormitory.length, 4);
  assert.ok(r.report.dropped.some((d) => d.includes("manufacture")));
  assert.ok(r.report.dropped.some((d) => d.startsWith("P: dormitory")));
});

test("I2b: processing・training はA班にだけある。書き出しも同じ", () => {
  const { project } = imp(fixture("cn-243-min.json"));
  assert.deepEqual(Object.keys(project.plans[0].rooms), ["control", "trading", "meeting", "hire", "dormitory"]);
  assert.ok("processing" in project.plans[1].rooms && "training" in project.plans[1].rooms);
  const out = JSON.parse(exp(project));
  assert.equal("processing" in out.plans[0].rooms, false);
  assert.equal("training" in out.plans[0].rooms, false);
  assert.ok("processing" in out.plans[1].rooms && "training" in out.plans[1].rooms);
});

test("I3: layout が無ければ rooms の配列長、どこにも無ければ243", () => {
  const { project } = imp(minimal({ rooms: { manufacture: [{}, {}], trading: [{}, {}, {}] } }));
  assert.deepEqual([project.layout.manufacture, project.layout.trading, project.layout.power], [2, 3, 3]);
});

test("I4: groups と use_operator_groups が dropped に載り operators は空", () => {
  const { project, report } = imp(minimal(
    { rooms: { control: [{ operators: ["g1"], use_operator_groups: true }] } },
    { groups: [{ name: "g1", operators: [] }] },
  ));
  assert.deepEqual(project.plans[0].rooms.control[0].operators, []);
  assert.ok(report.dropped.some((d) => d.includes("groups")));
  assert.ok(report.dropped.some((d) => d.includes("use_operator_groups")));
});

test("I5: 未解決名は原文のまま残り unresolved に載る", () => {
  const { project, report } = imp(minimal({ rooms: { control: [{ operators: ["不明な人", "不明な人", "凯尔希"] }] } }));
  assert.deepEqual(project.plans[0].rooms.control[0].operators, ["不明な人", "不明な人", "ケルシー"]);
  assert.deepEqual(report.unresolved, ["不明な人"]);
  assert.equal(report.converted, 1);
});

test("I6: 日本語JSONと再取り込みで project が等しい", () => {
  const jp = minimal({
    period: [["8:00", "10:00"]],
    rooms: { control: [{ operators: ["ケルシー", "アーミヤ"], sort: true }], dormitory: [{ autofill: true }] },
  });
  const first = imp(jp).project;
  assert.deepEqual(first.plans[0].rooms.control[0].operators, ["ケルシー", "アーミヤ"]);
  assert.deepEqual(first.plans[0].periods, [["08:00", "10:00"]]);
  const second = imp(exp(first)).project;
  assert.deepEqual(withoutIds(second), withoutIds(first));
});

test("I7: drones / Fiammetta / 短い配列 / 無効項目 / 未知キー", () => {
  const { project, report } = imp(minimal({
    drones: { room: "manufacturing", index: 2 },
    Fiammetta: { target: "但书" },
    rooms: {
      dormitory: [{ operators: ["凯尔希"] }],
      training: [{ operators: ["x"], sort: true, autofill: true, skip: true, operatorsA: ["阿"] }],
      unknown: [{}],
    },
  }));
  const plan = project.plans[0];
  assert.equal(plan.drones.enable, false);
  assert.equal(plan.drones.room, "trading");
  assert.equal(plan.drones.index, 2);
  assert.equal(plan.drones.order, "pre");
  assert.equal(plan.fiammetta.enable, true);
  assert.equal(plan.fiammetta.order, "pre");
  assert.equal(plan.rooms.dormitory.length, 4);
  assert.equal(plan.rooms.dormitory[0].autofill, false);
  assert.equal(plan.rooms.dormitory[3].autofill, false);
  assert.deepEqual(plan.rooms.training[0], { skip: true, operatorsA: ["ア"], operatorsB: [] });
  assert.equal(report.warnings.length, 2);
  const enabled = imp(minimal({ drones: { room: "trading" } })).project.plans[0].drones;
  assert.equal(enabled.enable, true);
});

test("X3: 書き出し→取り込み→書き出しが不動点", () => {
  const source = {
    layout: [{ type: "manufacture" }, { type: "manufacture" }, { type: "trading" }],
    plans: [
      {
        name: "夜", period: [["22:00", "02:00"]], Fiammetta: { enable: false, target: "但书", order: "post" },
        rooms: { control: [{ operators: ["阿米娅（近卫）", "凯尔希"] }], manufacture: [{ operators: ["陈"] }] },
      },
      { name: "昼", description: "d", period: [["08:00", "10:00"]], rooms: { dormitory: [{ autofill: true }] } },
    ],
  };
  const y = exp(imp(source).project);
  assert.equal(exp(imp(y).project), y);
});

test("X4: フィクスチャの出力がSchemaに適合する", () => {
  const projects = [imp(fixture("cn-243-min.json")).project, createProject()];
  for (const project of projects) {
    const ok = validateSchema(JSON.parse(exp(project)));
    assert.ok(ok, JSON.stringify(validateSchema.errors));
  }
});

test("X7: 状態の往復", () => {
  const s = createProject();
  s.title = "t";
  const plan = s.plans[0];
  plan.periods = [["08:00", "10:00"]];
  plan.fiammetta = { enable: false, target: "ケルシー", order: "post" };
  plan.drones = { enable: false, room: "manufacture", index: 3, order: "post" };
  plan.rooms.control[0].operators = ["アーミヤ"];
  plan.rooms.training[0].operatorsA = ["ケルシー"];
  plan.rooms.trading[0].product = "LMD";
  const back = imp(exp(s)).project;
  assert.deepEqual(withoutIds(back), withoutIds(s));
});
