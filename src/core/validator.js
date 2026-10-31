import {
  CAPACITY, FACILITIES, FACILITY_LABELS, PRODUCTS, roomCount,
} from "./model.js";
import { isOwned } from "./operbox.js";
import { isValidPeriod, splitPeriods, toMinutes } from "./time.js";

const ALL_PRODUCTS = [...PRODUCTS.manufacture, ...PRODUCTS.trading];

// 名前を持つ欄を { name, facility, room } で列挙する。facility が null ならフィアメッタの回復対象
function* eachNameSlot(plan) {
  for (const facility of FACILITIES) {
    const rooms = plan.rooms[facility] ?? [];
    for (let r = 0; r < rooms.length; r++) {
      for (const field of ["operators", "candidates", "operatorsA", "operatorsB"]) {
        for (const name of rooms[r][field] ?? []) yield { name, facility, room: r };
      }
    }
  }
  if (plan.fiammetta.target) yield { name: plan.fiammetta.target, facility: null, room: null };
}

// 区間同士が重なるか。端点が接するだけなら重ならない（連続するシフトの正しい書き方）
function overlaps(a, b) {
  return toMinutes(a[0]) < toMinutes(b[1]) && toMinutes(b[0]) < toMinutes(a[1]);
}

export function validate(project, nameIndex, operbox) {
  const issues = [];
  const add = (level, code, message, plan, facility, room) => {
    const issue = { level, code, message, plan };
    if (facility !== undefined && facility !== null) issue.facility = facility;
    if (room !== undefined && room !== null) issue.room = room;
    issues.push(issue);
  };

  project.plans.forEach((plan, p) => {
    const label = plan.name || `プラン ${p + 1}`;

    // E1
    const seen = new Set();
    const reported = new Set();
    for (const facility of FACILITIES) {
      (plan.rooms[facility] ?? []).forEach((room, r) => {
        for (const name of room.operators ?? []) {
          if (seen.has(name) && !reported.has(name)) {
            reported.add(name);
            add("error", "dup-operator", `${label}: ${name} が複数の枠に配置されています`, p, facility, r);
          }
          seen.add(name);
        }
      });
    }

    for (const facility of FACILITIES) {
      (plan.rooms[facility] ?? []).forEach((room, r) => {
        const where = `${label}: ${FACILITY_LABELS[facility]}${r + 1}`;
        const operators = room.operators ?? [];
        if (room.autofill && (room.candidates ?? []).length > 0) {
          add("error", "autofill-candidates", `${where}: 自動配置と候補は併用できません`, p, facility, r);
        }
        if (operators.length >= 6) {
          add("error", "too-many", `${where}: 1部屋に配置できるのは5人までです`, p, facility, r);
        } else if (CAPACITY[facility] !== undefined && operators.length > CAPACITY[facility]) {
          add("warn", "capacity", `${where}: 標準人数(${CAPACITY[facility]}人)を超えています`, p, facility, r);
        }
        if (room.product && !ALL_PRODUCTS.includes(room.product)) {
          add("error", "product", `${where}: 未知の製品 ${room.product} です`, p, facility, r);
        } else if (room.product && facility === "manufacture" && PRODUCTS.trading.includes(room.product)) {
          add("warn", "product-room", `${where}: 製造所に ${room.product} は指定できません`, p, facility, r);
        } else if (room.product && facility === "trading" && PRODUCTS.manufacture.includes(room.product)) {
          add("warn", "product-room", `${where}: 貿易所に ${room.product} は指定できません`, p, facility, r);
        }
      });
    }

    // E4
    plan.periods.forEach((period) => {
      if (!isValidPeriod(period)) {
        add("error", "period-format",
          `${label}: 時間帯 ${JSON.stringify(period)} の形式が不正です(HH:MM)`, p);
      }
    });

    // E5
    if (plan.drones.enable) {
      const max = roomCount(project.layout, plan.drones.room);
      const index = plan.drones.index;
      if (!Number.isInteger(index) || index < 1 || index > max) {
        add("error", "drones-index", `${label}: ドローンの施設番号は1〜${max}にしてください`, p);
      }
    }
    // E6
    if (plan.fiammetta.enable && !plan.fiammetta.target) {
      add("error", "fiammetta-target", `${label}: フィアメッタの回復対象が未指定です`, p);
    }

    // W1 / W2
    const warned = new Set();
    for (const slot of eachNameSlot(plan)) {
      const key = `${slot.name}|${slot.facility}|${slot.room}`;
      if (warned.has(key)) continue;
      warned.add(key);
      const where = slot.facility
        ? `${label}: ${FACILITY_LABELS[slot.facility]}${slot.room + 1}` : `${label}: フィアメッタの回復対象`;
      if (!nameIndex.jpNameSet.has(slot.name)) {
        add("warn", "unresolved", `${where}: ${slot.name} は名前表にありません`, p, slot.facility, slot.room);
      } else if (isOwned(slot.name, nameIndex, operbox) === false) {
        add("warn", "not-owned", `${where}: ${slot.name} は未所持です`, p, slot.facility, slot.room);
      }
    }
  });

  // W3: 出力と同じ分割後の区間で比べる
  const spans = project.plans.map((plan) => splitPeriods(plan.periods).filter(isValidPeriod));
  for (let a = 0; a < spans.length; a++) {
    for (let b = a + 1; b < spans.length; b++) {
      if (spans[a].some((x) => spans[b].some((y) => overlaps(x, y)))) {
        const nameA = project.plans[a].name || `プラン ${a + 1}`;
        const nameB = project.plans[b].name || `プラン ${b + 1}`;
        add("warn", "period-overlap", `${nameA} と ${nameB} の時間帯が重なっています`, a);
      }
    }
  }

  // W6
  const withPeriod = project.plans.filter((plan) => plan.periods.length > 0).length;
  if (withPeriod > 0 && withPeriod < project.plans.length) {
    add("warn", "period-partial",
      "一部のプランにだけ時間帯が設定されています。MAAが予期しない動作をする場合があります", null);
  }

  const order = { error: 0, warn: 1 };
  return issues.sort((x, y) => order[x.level] - order[y.level]);
}
