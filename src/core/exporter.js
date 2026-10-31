import { FACILITIES, roomCount } from "./model.js";
import { splitPeriods } from "./time.js";

// 中国語名は MAA がOCR結果を置換した文字列と完全一致で照合される。
// 名前表から引いた値は trim や正規化をせずにそのまま出す。
function toOutputName(name, nameIndex) {
  return nameIndex.jpToCn(name) ?? name;
}

function exportRoom(facility, room, nameIndex) {
  const names = (list) => list.map((n) => toOutputName(n, nameIndex));
  const out = {};
  if (facility === "training") {
    if (room.operatorsA?.length) out.operatorsA = names(room.operatorsA);
    if (room.operatorsB?.length) out.operatorsB = names(room.operatorsB);
    if (room.skip) out.skip = true;
    return out;
  }
  if (room.operators?.length) out.operators = names(room.operators);
  if (room.candidates?.length) out.candidates = names(room.candidates);
  if (room.sort) out.sort = true;
  if (room.product) out.product = room.product;
  if (room.skip) out.skip = true;
  if (room.autofill) out.autofill = true;
  return out;
}

function exportPlanEntry(plan, layout, nameIndex) {
  const out = { name: plan.name };
  if (plan.description) out.description = plan.description;
  if (plan.periods.length > 0) out.period = splitPeriods(plan.periods);

  const f = plan.fiammetta;
  if (f.enable || f.target !== "" || f.order !== "pre") {
    out.Fiammetta = { enable: f.enable, target: toOutputName(f.target, nameIndex), order: f.order };
  }
  const d = plan.drones;
  if (d.enable || d.room !== "trading" || d.index !== 1 || d.order !== "pre") {
    out.drones = { enable: d.enable, room: d.room, index: d.index, order: d.order };
  }

  const rooms = {};
  for (const facility of FACILITIES) {
    const list = plan.rooms[facility];
    if (!list) continue;
    rooms[facility] = Array.from({ length: roomCount(layout, facility) }, (_, i) =>
      list[i] ? exportRoom(facility, list[i], nameIndex) : {});
  }
  out.rooms = rooms;
  return out;
}

export function exportPlan(project, nameIndex) {
  const out = {};
  if (project.title) out.title = project.title;
  if (project.description) out.description = project.description;
  out.plans = project.plans.map((p) => exportPlanEntry(p, project.layout, nameIndex));
  return JSON.stringify(out, null, 2) + "\n";
}
