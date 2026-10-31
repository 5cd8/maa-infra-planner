export const FACILITIES = [
  "control", "manufacture", "trading", "power", "meeting", "hire", "dormitory", "processing", "training",
];

export const FACILITY_LABELS = {
  control: "制御中枢", manufacture: "製造所", trading: "貿易所", power: "発電所", meeting: "応接室",
  hire: "事務室", dormitory: "宿舎", processing: "加工所", training: "訓練室",
};

// 部屋数が可変の施設。ほかは1部屋（宿舎は4）に固定
export const VARIABLE_FACILITIES = ["manufacture", "trading", "power"];

export const PRESETS = {
  "243": { manufacture: 4, trading: 2, power: 3 },
  "153": { manufacture: 5, trading: 1, power: 3 },
  "252": { manufacture: 5, trading: 2, power: 2 },
  "333": { manufacture: 3, trading: 3, power: 3 },
};

export const DORMITORY_COUNT = 4;

export const PRODUCTS = {
  manufacture: ["Battle Record", "Pure Gold", "Dualchip", "Originium Shard"],
  trading: ["LMD", "Orundum"],
};
export const PRODUCT_LABELS = {
  "Battle Record": "作戦記録", "Pure Gold": "純金", Dualchip: "中級SoC",
  "Originium Shard": "源石の欠片", LMD: "龍門幣", Orundum: "合成玉",
};

// 配置して意味のある人数の上限（施設の標準人数。1部屋のSchema上限は5）
export const CAPACITY = {
  control: 5, manufacture: 3, trading: 3, power: 1, meeting: 2, hire: 1, dormitory: 5, processing: 1,
};

let idCounter = 0;
export function newId() {
  idCounter += 1;
  return `p${Date.now().toString(36)}${idCounter}`;
}

export function roomCount(layout, facility) {
  if (facility === "dormitory") return DORMITORY_COUNT;
  if (VARIABLE_FACILITIES.includes(facility)) return layout[facility];
  return 1;
}

export function createRoom(facility) {
  if (facility === "training") return { skip: false, operatorsA: [], operatorsB: [] };
  const room = {
    operators: [], candidates: [],
    sort: ["control", "manufacture", "trading"].includes(facility),
    skip: false,
    autofill: facility === "dormitory",
  };
  if (facility === "manufacture" || facility === "trading") room.product = "";
  return room;
}

export function createPlan(layout) {
  const rooms = {};
  for (const facility of FACILITIES) {
    rooms[facility] = Array.from({ length: roomCount(layout, facility) }, () => createRoom(facility));
  }
  return {
    id: newId(), name: "", description: "", periods: [],
    fiammetta: { enable: false, target: "", order: "pre" },
    drones: { enable: false, room: "trading", index: 1, order: "pre" },
    rooms,
  };
}

export function createProject() {
  const layout = { ...PRESETS["243"], dormitory: DORMITORY_COUNT };
  const plan = createPlan(layout);
  plan.name = "プラン 1";
  return { title: "", description: "", layout, plans: [plan] };
}

function resizeRooms(project, facility, n) {
  for (const plan of project.plans) {
    const rooms = plan.rooms[facility];
    if (!rooms) continue;
    while (rooms.length < n) rooms.push(createRoom(facility));
    rooms.length = n;
  }
}

export function setRoomCount(project, facility, n) {
  if (!VARIABLE_FACILITIES.includes(facility)) return;
  const count = Math.min(9, Math.max(1, Math.trunc(n)));
  project.layout[facility] = count;
  resizeRooms(project, facility, count);
}

export function applyPreset(project, name) {
  const preset = PRESETS[name];
  if (!preset) return;
  for (const facility of VARIABLE_FACILITIES) setRoomCount(project, facility, preset[facility]);
}

export function isRoomEmpty(room) {
  return !(
    room.operators?.length || room.candidates?.length || room.operatorsA?.length || room.operatorsB?.length
  );
}

// 縮めたときに消える部屋のうち、配置が空でないものがあるか
export function wouldDiscard(project, facility, n) {
  return project.plans.some((plan) => (plan.rooms[facility] ?? []).slice(n).some((r) => !isRoomEmpty(r)));
}

export function setFacilityEnabled(plan, facility, on, layout) {
  if (!on) {
    delete plan.rooms[facility];
    return;
  }
  if (plan.rooms[facility]) return;
  const rooms = Array.from({ length: roomCount(layout, facility) }, () => createRoom(facility));
  // 標準順を保つため、キーを並べ直す
  const next = {};
  for (const f of FACILITIES) {
    if (f === facility) next[f] = rooms;
    else if (plan.rooms[f]) next[f] = plan.rooms[f];
  }
  plan.rooms = next;
}

export function duplicatePlan(project, index) {
  if (!project.plans[index]) return;
  const copy = structuredClone(project.plans[index]);
  copy.id = newId();
  copy.name = `${copy.name} のコピー`;
  project.plans.splice(index + 1, 0, copy);
}

export function movePlan(project, index, delta) {
  const to = index + delta;
  if (!project.plans[index] || !project.plans[to]) return;
  const [plan] = project.plans.splice(index, 1);
  project.plans.splice(to, 0, plan);
}

export function removePlan(project, index) {
  if (!project.plans[index]) return;
  project.plans.splice(index, 1);
}

export function addPlan(project) {
  const plan = createPlan(project.layout);
  plan.name = `プラン ${project.plans.length + 1}`;
  project.plans.push(plan);
}
