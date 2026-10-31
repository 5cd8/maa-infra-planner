import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { parseOperBox } from "../src/core/operbox.js";
import { importPlan } from "../src/core/importer.js";
import { exportPlan } from "../src/core/exporter.js";
import { validate } from "../src/core/validator.js";
import { nameIndex } from "./helpers.js";

// 実データ（OperBox・一图流の出力）のパスが環境変数にあるときだけ実行する
const operboxPath = process.env.MAA_OPERBOX;
const refPath = process.env.MAA_REF_JSON;
const skip = !operboxPath || !refPath;

const schema = JSON.parse(readFileSync(new URL("../schema/maa-infra.schema.json", import.meta.url), "utf8"));
const validateSchema = new Ajv({ strict: false, allErrors: true }).compile(schema);

test("実データ: OperBoxの全 name が名前表の name_jp と一致する", { skip }, () => {
  const text = readFileSync(operboxPath, "utf8");
  const box = parseOperBox(text, nameIndex);
  const raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  assert.equal(raw.length, 415);
  assert.equal(raw.filter((o) => o.own).length, 408);
  const missing = raw.filter((o) => nameIndex.idsByJp(o.name).length === 0);
  assert.deepEqual(missing, []);
  assert.ok(box.operators.length >= 415);
});

test("実データ: 参考ファイルの取り込みと書き出し", { skip }, () => {
  const text = readFileSync(refPath, "utf8");
  const original = JSON.parse(text.replace(/^\uFEFF/, ""));
  const { project, report } = importPlan(text, nameIndex);
  assert.deepEqual(report.unresolved, []);
  // 回収ステーションを除く名前の延べ件数（Fiammetta.target を含む）
  assert.equal(report.converted, countNames(original));
  const distinct = new Set();
  for (const plan of project.plans) {
    for (const rooms of Object.values(plan.rooms)) {
      for (const room of rooms) {
        for (const field of ["operators", "candidates", "operatorsA", "operatorsB"]) (room[field] ?? []).forEach((n) => distinct.add(n));
      }
    }
    if (plan.fiammetta.target) distinct.add(plan.fiammetta.target);
  }
  // 参考ファイルごとに変わる値は、元のJSONから数える
  const originalDistinct = new Set();
  for (const plan of original.plans) {
    for (const [facility, rooms] of Object.entries(plan.rooms)) {
      if (facility === "recycle") continue;
      for (const room of rooms) {
        for (const field of ["operators", "candidates", "operatorsA", "operatorsB"]) (room[field] ?? []).forEach((n) => originalDistinct.add(n));
      }
    }
    if (plan.Fiammetta?.target) originalDistinct.add(plan.Fiammetta.target);
  }
  assert.equal(distinct.size, originalDistinct.size);
  const recycleDrops = original.plans.filter((p) => p.rooms.recycle).length
    + ((original.layout ?? []).some((l) => l.type === "recycle") ? 1 : 0);
  assert.equal(report.dropped.filter((d) => d.includes("recycle")).length, recycleDrops);

  const exported = JSON.parse(exportPlan(project, nameIndex));
  assert.ok(validateSchema(exported), JSON.stringify(validateSchema.errors));
  original.plans.forEach((plan, i) => {
    const out = exported.plans[i];
    for (const [facility, rooms] of Object.entries(plan.rooms)) {
      if (facility === "recycle") continue;
      rooms.forEach((room, r) => {
        assert.deepEqual(out.rooms[facility][r].operators ?? [], room.operators ?? [], `${plan.name} ${facility}${r}`);
      });
    }
    assert.equal(out.Fiammetta?.target, plan.Fiammetta?.target);
    // プランごとの施設キーの有無が元のまま（回収ステーションは除外される）
    const keys = (rooms) => Object.keys(rooms).filter((k) => k !== "recycle").sort();
    assert.deepEqual(keys(out.rooms), keys(plan.rooms), plan.name);
  });

  const box = parseOperBox(readFileSync(operboxPath, "utf8"), nameIndex);
  const notOwned = validate(project, nameIndex, box).filter((i) => i.code === "not-owned");
  assert.deepEqual(notOwned, []);
});

function countNames(original) {
  let n = 0;
  for (const plan of original.plans) {
    for (const [facility, rooms] of Object.entries(plan.rooms)) {
      if (facility === "recycle") continue;
      for (const room of rooms) {
        for (const field of ["operators", "candidates", "operatorsA", "operatorsB"]) n += (room[field] ?? []).length;
      }
    }
    if (plan.Fiammetta?.target) n += 1;
  }
  return n;
}
