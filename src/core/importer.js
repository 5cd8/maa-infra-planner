import {
  DORMITORY_COUNT, FACILITIES, PRESETS, VARIABLE_FACILITIES, createPlan, createRoom, newId,
} from "./model.js";
import { normalizeTime } from "./time.js";

const KNOWN_FACILITIES = new Set(FACILITIES);
const DRONE_ROOMS = ["trading", "manufacture"];

// 拡張フィールド operators は配列形（2.0）とIDキーのオブジェクト形（1.0）がある
function buildExtensionNameToId(operators) {
  const map = new Map();
  if (Array.isArray(operators)) {
    for (const o of operators) {
      if (o && typeof o.name === "string" && typeof o.id === "string") map.set(o.name, o.id);
    }
  } else if (operators && typeof operators === "object") {
    for (const [id, o] of Object.entries(operators)) {
      if (o && typeof o.name === "string") map.set(o.name, id);
    }
  }
  return map;
}

function countLayout(layout) {
  const counts = {};
  if (!Array.isArray(layout)) return counts;
  for (const item of layout) {
    if (item && typeof item.type === "string") counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  return counts;
}

export function importPlan(text, nameIndex) {
  const data = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!data || !Array.isArray(data.plans)) throw new Error("plans が配列ではありません");

  const report = { converted: 0, unresolved: [], dropped: [], warnings: [] };
  const droppedSet = new Set();
  const drop = (scope, key, message) => {
    const entry = `${scope}: ${key}: ${message}`;
    if (!droppedSet.has(entry)) {
      droppedSet.add(entry);
      report.dropped.push(entry);
    }
  };
  const nameToId = buildExtensionNameToId(data.operators);

  function convertName(name) {
    if (typeof name !== "string" || name === "") return name;
    let result = null;
    const id = nameToId.get(name);
    const entry = id ? nameIndex.idToEntry(id) : null;
    if (entry && entry.jpAvailable) result = entry.nameJp;
    if (result === null) result = nameIndex.cnToJp(name);
    if (result === null && nameIndex.jpNameSet.has(name)) result = name;
    if (result === null) {
      if (!report.unresolved.includes(name)) report.unresolved.push(name);
      return name;
    }
    report.converted += 1;
    return result;
  }
  const convertNames = (list) => (Array.isArray(list) ? list.map(convertName) : []);

  // 部屋数
  const layoutCounts = countLayout(data.layout);
  if (layoutCounts.recycle) drop("全体", "recycle", "回収ステーションは未対応のため除外");
  if (data.groups) drop("全体", "groups", "オペレーターグループは未対応のため除外");
  const layout = { dormitory: DORMITORY_COUNT };
  for (const facility of VARIABLE_FACILITIES) {
    let n = layoutCounts[facility] ?? 0;
    if (n === 0) {
      for (const plan of data.plans) {
        const arr = plan?.rooms?.[facility];
        if (Array.isArray(arr)) n = Math.max(n, arr.length);
      }
    }
    if (n === 0) n = PRESETS["243"][facility];
    if (n > 9) {
      drop("全体", facility, `部屋数が上限(9)を超えたため${n}から9に切り詰め`);
      n = 9;
    }
    layout[facility] = n;
  }
  if ((layoutCounts.dormitory ?? 0) > DORMITORY_COUNT) {
    drop("全体", "dormitory", `宿舎が${DORMITORY_COUNT}部屋を超えたため切り詰め`);
  }
  for (const facility of ["control", "meeting", "hire", "processing", "training"]) {
    if ((layoutCounts[facility] ?? 0) > 1) drop("全体", facility, "1部屋を超えたため切り詰め");
  }

  const project = {
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : "",
    layout,
    plans: [],
  };

  data.plans.forEach((src, index) => {
    const plan = createPlan(layout);
    plan.rooms = {};
    plan.id = newId();
    const planName = typeof src?.name === "string" && src.name !== "" ? src.name : `プラン ${index + 1}`;
    plan.name = planName;
    plan.description = typeof src?.description === "string" ? src.description : "";
    plan.periods = Array.isArray(src?.period)
      ? src.period.map((p) => (Array.isArray(p) ? p.map(normalizeTime) : p))
      : [];

    const f = src?.Fiammetta;
    if (f && typeof f === "object") {
      plan.fiammetta = {
        enable: f.enable === undefined ? true : f.enable === true,
        target: typeof f.target === "string" ? convertName(f.target) : "",
        order: f.order === "post" ? "post" : "pre",
      };
    }

    const d = src?.drones;
    if (d && typeof d === "object") {
      const validRoom = DRONE_ROOMS.includes(d.room);
      if (!validRoom) report.warnings.push(`${planName}: drones.room が不正または未指定のため、ドローンを無効にしました`);
      plan.drones = {
        enable: validRoom && (d.enable === undefined ? true : d.enable === true),
        room: validRoom ? d.room : "trading",
        index: Number.isInteger(d.index) ? d.index : 1,
        order: d.order === "post" ? "post" : "pre",
      };
    }

    if (src?.groups) drop(planName, "groups", "オペレーターグループは未対応のため除外");

    const rooms = src?.rooms && typeof src.rooms === "object" ? src.rooms : {};
    for (const facility of Object.keys(rooms)) {
      if (facility === "recycle") {
        drop(planName, "recycle", "回収ステーションは未対応のため除外");
        continue;
      }
      if (!KNOWN_FACILITIES.has(facility)) {
        report.warnings.push(`${planName}: 未知の施設キー ${facility} を無視しました`);
      }
    }
    for (const facility of FACILITIES) {
      const list = rooms[facility];
      if (list === undefined) continue;
      if (!Array.isArray(list)) {
        report.warnings.push(`${planName}: ${facility} が配列ではないため無視しました`);
        continue;
      }
      const count = facility === "dormitory" ? DORMITORY_COUNT
        : VARIABLE_FACILITIES.includes(facility) ? layout[facility] : 1;
      if (list.length > count) drop(planName, facility, `部屋数(${count})を超えた分を切り詰め`);
      plan.rooms[facility] = Array.from({ length: count }, (_, i) => readRoom(facility, list[i]));
    }
    project.plans.push(plan);

    function readRoom(fac, room) {
      const out = createRoom(fac);
      if (fac === "training") {
        if (room && typeof room === "object") {
          out.skip = room.skip === true;
          out.operatorsA = convertNames(room.operatorsA);
          out.operatorsB = convertNames(room.operatorsB);
        }
        return out;
      }
      // 不足分は「配置の意思なし」の部屋にする（既定値のsort・autofillを使わない）
      out.sort = false;
      out.autofill = false;
      if (!room || typeof room !== "object") return out;
      if (room.use_operator_groups === true) {
        drop(planName, fac, "use_operator_groups: オペレーターグループは未対応のため除外");
      } else {
        out.operators = convertNames(room.operators);
      }
      out.candidates = convertNames(room.candidates);
      out.sort = room.sort === true;
      out.skip = room.skip === true;
      out.autofill = room.autofill === true;
      if ("product" in out) out.product = typeof room.product === "string" ? room.product : "";
      return out;
    }
  });

  return { project, report };
}
