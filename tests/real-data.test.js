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
  // 回収ステーションを除く63名（Fiammetta.target を含む、延べ件数）
  assert.equal(report.converted, countNames(original));
  const distinct = new Set();
  for (const plan of project.plans) {
    for (const rooms of Object.values(plan.rooms)) {
      for (const room of rooms) {
        for (const field of ["operators", "candidates", "operatorsA", "operatorsB"]) (room[field] ?? []).forEach((n) => distinct.add(n));
      }
    }
    distinct.add(plan.fiammetta.target);
  }
  assert.equal(distinct.size, 63);
  assert.equal(report.dropped.filter((d) => d.includes("recycle")).length, original.plans.length + 1);

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
    assert.equal(out.Fiammetta.target, plan.Fiammetta.target);
  });
  assert.equal("processing" in exported.plans[0].rooms, "processing" in original.plans[0].rooms);
  assert.equal("training" in exported.plans[1].rooms, true);

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
