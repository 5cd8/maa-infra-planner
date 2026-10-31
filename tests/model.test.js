import test from "node:test";
import assert from "node:assert/strict";
import {
  FACILITIES, applyPreset, createProject, duplicatePlan, movePlan, removePlan, addPlan,
  setFacilityEnabled, setRoomCount, wouldDiscard,
} from "../src/core/model.js";

test("M1: createPlan は全9施設のキーを持つ", () => {
  const project = createProject();
  assert.deepEqual(Object.keys(project.plans[0].rooms), FACILITIES);
  assert.equal(project.plans[0].rooms.training.length, 1);
  assert.equal(project.plans[0].rooms.dormitory.length, 4);
});

test("M1: プリセットで部屋数が変わり、増えた部屋は既定値", () => {
  const project = createProject();
  applyPreset(project, "153");
  const rooms = project.plans[0].rooms;
  assert.equal(rooms.manufacture.length, 5);
  assert.equal(rooms.trading.length, 1);
  assert.equal(rooms.manufacture[4].sort, true);
  assert.equal(rooms.manufacture[4].autofill, false);
  assert.equal(project.layout.manufacture, 5);
});

test("M1: 縮めて空でない部屋が消えるとき wouldDiscard が真", () => {
  const project = createProject();
  assert.equal(wouldDiscard(project, "manufacture", 2), false);
  project.plans[0].rooms.manufacture[3].operators.push("ケルシー");
  assert.equal(wouldDiscard(project, "manufacture", 2), true);
  assert.equal(wouldDiscard(project, "manufacture", 4), false);
  setRoomCount(project, "manufacture", 2);
  assert.equal(project.plans[0].rooms.manufacture.length, 2);
});

test("M1: プランの複製で id が変わり、範囲外の添字は何もしない", () => {
  const project = createProject();
  duplicatePlan(project, 0);
  assert.equal(project.plans.length, 2);
  assert.notEqual(project.plans[0].id, project.plans[1].id);
  duplicatePlan(project, 5);
  movePlan(project, 0, -1);
  movePlan(project, 1, 1);
  removePlan(project, 9);
  assert.equal(project.plans.length, 2);
  addPlan(project);
  movePlan(project, 2, -1);
  assert.equal(project.plans[1].name, "プラン 3");
  removePlan(project, 0);
  assert.equal(project.plans.length, 2);
});

test("M1: 施設をオフにするとキーが消え、オンに戻すと既定の部屋ができる", () => {
  const project = createProject();
  const plan = project.plans[0];
  setFacilityEnabled(plan, "training", false, project.layout);
  assert.equal("training" in plan.rooms, false);
  setFacilityEnabled(plan, "manufacture", false, project.layout);
  setFacilityEnabled(plan, "manufacture", true, project.layout);
  assert.equal(plan.rooms.manufacture.length, 4);
  assert.deepEqual(Object.keys(plan.rooms), FACILITIES.filter((f) => f !== "training"));
});
