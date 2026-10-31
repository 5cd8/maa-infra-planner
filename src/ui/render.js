import {
  FACILITIES, FACILITY_LABELS, PRODUCTS, PRODUCT_LABELS, addPlan, duplicatePlan, isRoomEmpty, movePlan,
  removePlan, roomCount, setFacilityEnabled,
} from "../core/model.js";
import { validate } from "../core/validator.js";
import { fill, h } from "./dom.js";

const ROOM_FIELD_LABELS = { operators: "配置", candidates: "候補", operatorsA: "訓練するオペレーター A", operatorsB: "訓練するオペレーター B" };

// root: #app。ctx は main.js が渡す（state・名前表・ファイル操作のコールバック）
export function createView(root, ctx) {
  const { state, nameIndex } = ctx;
  const planListEl = h("div", { id: "planList" });
  const validationEl = h("div", { id: "validation" });
  const statusEl = h("span", { class: "status" });

  const plan = () => state.project.plans[state.selected];

  // 構造が変わる操作（プラン切替・追加削除・部屋の編集など）
  function update(fn) {
    fn();
    ctx.changed();
    renderAll();
  }
  // 入力中の文字列など、フォーカスを保ちたい変更。左のプラン一覧と検証だけ描き直す
  function light(fn) {
    fn();
    ctx.changed();
    refreshSide();
  }

  function takenNames(p) {
    const taken = new Set();
    for (const rooms of Object.values(p.rooms)) for (const r of rooms) (r.operators ?? []).forEach((n) => taken.add(n));
    return taken;
  }

  function chipList(list, { onChange, title, p }) {
    const items = list.map((name, i) => h("div", { class: `chip${nameIndex.jpNameSet.has(name) ? "" : " unresolved"}` },
      h("span", { class: "name" }, name),
      h("button", { "aria-label": `${name}を上へ`, disabled: i === 0, onClick: () => update(() => { swap(list, i, i - 1); onChange?.(); }) }, "↑"),
      h("button", { "aria-label": `${name}を下へ`, disabled: i === list.length - 1, onClick: () => update(() => { swap(list, i, i + 1); onChange?.(); }) }, "↓"),
      h("button", { "aria-label": `${name}を削除`, onClick: () => update(() => { list.splice(i, 1); onChange?.(); }) }, "✕")));
    const add = h("button", {
      onClick: () => ctx.openPicker({
        title, taken: takenNames(p),
        onPick: (name) => update(() => { list.push(name); }),
      }),
    }, "＋追加");
    return h("div", {}, h("div", { class: "chips" }, items), add);
  }

  function swap(list, a, b) {
    if (a < 0 || b < 0 || a >= list.length || b >= list.length) return;
    [list[a], list[b]] = [list[b], list[a]];
  }

  function check(label, obj, key, { disabled = false } = {}) {
    return h("label", { class: disabled ? "disabled" : "" },
      h("input", { type: "checkbox", checked: obj[key], disabled, onChange: (e) => update(() => { obj[key] = e.target.checked; }) }),
      ` ${label}`);
  }

  function roomCard(facility, rooms, p) {
    const cards = rooms.map((room, r) => {
      const training = facility === "training";
      const fields = training ? ["operatorsA", "operatorsB"] : ["operators"];
      return h("div", { class: "room", "data-room": `${state.selected}-${facility}-${r}` },
        rooms.length > 1 && h("h3", {}, `${FACILITY_LABELS[facility]} ${r + 1}`),
        fields.map((field) => h("div", {}, h("div", { class: "muted" }, ROOM_FIELD_LABELS[field]),
          chipList(room[field], { title: `${FACILITY_LABELS[facility]}${rooms.length > 1 ? ` ${r + 1}` : ""}に追加`, p }))),
        h("div", { class: "checks" },
          !training && check("並べ替え(sort)", room, "sort"),
          check("変更しない(skip)", room, "skip"),
          !training && check("自動配置(autofill)", room, "autofill")),
        (facility === "manufacture" || facility === "trading") && h("div", { class: "row" },
          "製品 ",
          h("select", { "aria-label": "製品", onChange: (e) => update(() => { room.product = e.target.value; }) },
            h("option", { value: "" }, "指定なし"),
            PRODUCTS[facility].map((v) => h("option", { value: v, selected: room.product === v }, PRODUCT_LABELS[v])),
            room.product && !PRODUCTS[facility].includes(room.product)
              && h("option", { value: room.product, selected: true }, room.product))),
        !training && h("div", { class: room.autofill ? "disabled" : "" },
          h("div", { class: "muted" }, room.autofill ? `${ROOM_FIELD_LABELS.candidates}（自動配置中は使えません）` : ROOM_FIELD_LABELS.candidates),
          room.autofill
            ? h("div", { class: "chips" }, room.candidates.map((n) => h("div", { class: "chip" }, n)))
            : chipList(room.candidates, { title: `${FACILITY_LABELS[facility]}の候補に追加`, p })));
    });
    return h("section", { class: "panel facility-card" }, h("h2", {}, FACILITY_LABELS[facility]), h("div", { class: "rooms" }, cards));
  }

  function planForm(p) {
    const periods = p.periods.map((period, i) => h("div", { class: "row period-row" },
      h("input", { type: "text", "aria-label": "開始", placeholder: "HH:MM", value: period[0] ?? "", onInput: (e) => light(() => setPeriod(p, i, 0, e.target.value)) }),
      "〜",
      h("input", { type: "text", "aria-label": "終了", placeholder: "HH:MM", value: period[1] ?? "", onInput: (e) => light(() => setPeriod(p, i, 1, e.target.value)) }),
      h("button", { "aria-label": "時間帯を削除", onClick: () => update(() => p.periods.splice(i, 1)) }, "✕")));

    const droneMax = roomCount(state.project.layout, p.drones.room);
    const droneIndexes = Array.from({ length: droneMax }, (_, i) => i + 1);
    if (!droneIndexes.includes(p.drones.index)) droneIndexes.push(p.drones.index);

    return h("div", { class: "stack" },
      h("div", {}, h("div", { class: "muted" }, "プラン名"),
        h("input", { type: "text", "aria-label": "プラン名", value: p.name, onInput: (e) => light(() => { p.name = e.target.value; }) })),
      h("div", {}, h("div", { class: "muted" }, "説明"),
        h("input", { type: "text", "aria-label": "プランの説明", value: p.description, onInput: (e) => light(() => { p.description = e.target.value; }) })),
      h("div", {}, h("h3", {}, "時間帯(period)"), periods,
        h("button", { onClick: () => update(() => p.periods.push(["08:00", "10:00"])) }, "＋時間帯を追加"),
        h("p", { class: "muted" }, "開始が終了より遅い（日をまたぐ）区間も入力できます。出力時に2区間へ分割されます。")),
      h("div", {}, h("h3", {}, "フィアメッタ"),
        check("有効", p.fiammetta, "enable"),
        h("div", { class: "row" }, "回復対象: ",
          h("button", {
            onClick: () => ctx.openPicker({ title: "フィアメッタの回復対象", taken: new Set(), onPick: (n) => update(() => { p.fiammetta.target = n; }) }),
          }, p.fiammetta.target || "未指定"),
          p.fiammetta.target && h("button", { "aria-label": "回復対象を解除", onClick: () => update(() => { p.fiammetta.target = ""; }) }, "✕")),
        orderSelect(p.fiammetta)),
      h("div", {}, h("h3", {}, "ドローン"),
        check("使う", p.drones, "enable"),
        h("div", { class: "row" },
          h("select", { "aria-label": "ドローンを使う施設", onChange: (e) => update(() => { p.drones.room = e.target.value; }) },
            h("option", { value: "trading", selected: p.drones.room === "trading" }, "貿易所"),
            h("option", { value: "manufacture", selected: p.drones.room === "manufacture" }, "製造所")),
          h("select", { "aria-label": "施設番号", onChange: (e) => update(() => { p.drones.index = Number(e.target.value); }) },
            droneIndexes.map((n) => h("option", { value: String(n), selected: p.drones.index === n }, `${n}番目`)))),
        orderSelect(p.drones)),
      h("div", {}, h("h3", {}, "編集する施設"),
        h("p", { class: "muted" }, "オフにした施設は、このプランの出力にキーを出しません（MAAの標準アルゴリズムに任せます）。"),
        h("div", { class: "facility-toggles" }, FACILITIES.map((f) => h("label", {},
          h("input", {
            type: "checkbox", checked: Boolean(p.rooms[f]),
            onChange: (e) => {
              const on = e.target.checked;
              if (!on && p.rooms[f].some((r) => !isRoomEmpty(r))
                && !window.confirm(`${FACILITY_LABELS[f]}の配置が削除されます。続けますか？`)) {
                e.target.checked = true;
                return;
              }
              update(() => setFacilityEnabled(p, f, on, state.project.layout));
            },
          }), ` ${FACILITY_LABELS[f]}`)))));
  }

  function orderSelect(obj) {
    return h("div", { class: "row" }, "実行順 ",
      h("select", { "aria-label": "実行順", onChange: (e) => update(() => { obj.order = e.target.value; }) },
        h("option", { value: "pre", selected: obj.order === "pre" }, "交代の前(pre)"),
        h("option", { value: "post", selected: obj.order === "post" }, "交代の後(post)")));
  }

  function setPeriod(p, i, side, value) {
    const current = Array.isArray(p.periods[i]) ? p.periods[i] : ["", ""];
    const next = [current[0] ?? "", current[1] ?? ""];
    next[side] = value;
    p.periods[i] = next;
  }

  function refreshSide() {
    fill(planListEl,
      state.project.plans.map((p, i) => h("button", {
        class: `plan-item${i === state.selected ? " selected" : ""}`,
        onClick: () => update(() => { state.selected = i; }),
      }, p.name || `プラン ${i + 1}`)));

    const issues = validate(state.project, nameIndex, state.operbox);
    const errors = issues.filter((x) => x.level === "error").length;
    const warns = issues.length - errors;
    fill(validationEl,
      h("h2", {}, "検証 ",
        h("span", { class: "badge error" }, `エラー ${errors}`), h("span", { class: "badge warn" }, `警告 ${warns}`)),
      issues.length === 0 && h("p", { class: "muted" }, "問題は見つかりませんでした。"),
      issues.map((issue) => h("button", { class: `issue ${issue.level}`, onClick: () => jumpTo(issue) },
        `${issue.level === "error" ? "エラー" : "警告"}: ${issue.message}`)));

    const box = state.operbox;
    statusEl.textContent = box
      ? `OperBox: ${box.operators.length}件（所持 ${box.operators.filter((o) => o.own).length}件）`
      : "OperBox: 未読み込み";
  }

  function jumpTo(issue) {
    if (issue.plan !== null && issue.plan !== undefined) state.selected = issue.plan;
    renderAll();
    if (issue.facility) {
      const el = root.querySelector(`[data-room="${state.selected}-${issue.facility}-${issue.room ?? 0}"]`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.classList.add("flash");
      }
    }
  }

  function topBar() {
    const project = state.project;
    return h("header", { class: "topbar" },
      h("button", { onClick: ctx.onLoadOperBox }, "OperBoxを読み込む"),
      h("button", { onClick: ctx.onImport }, "JSONを取り込む"),
      h("button", { onClick: ctx.onLayout }, "基地の構成"),
      h("button", { class: "primary", onClick: ctx.onDownload }, "ダウンロード"),
      h("button", { onClick: ctx.onCopy }, "コピー"),
      h("button", { onClick: ctx.onNew }, "新規"),
      statusEl,
      h("input", { class: "grow", type: "text", "aria-label": "タイトル", placeholder: "タイトル", value: project.title, onInput: (e) => light(() => { project.title = e.target.value; }) }),
      h("input", { class: "grow", type: "text", "aria-label": "説明", placeholder: "説明", value: project.description, onInput: (e) => light(() => { project.description = e.target.value; }) }),
    );
  }

  function renderAll() {
    if (state.selected >= state.project.plans.length) state.selected = Math.max(0, state.project.plans.length - 1);
    const p = plan();
    const left = h("aside", { class: "panel" },
      h("h2", {}, "プラン"), planListEl,
      h("div", { class: "row" },
        h("button", { onClick: () => update(() => { addPlan(state.project); state.selected = state.project.plans.length - 1; }) }, "追加"),
        h("button", { disabled: !p, onClick: () => update(() => { duplicatePlan(state.project, state.selected); state.selected += 1; }) }, "複製"),
        h("button", { "aria-label": "プランを上へ", disabled: !p || state.selected === 0, onClick: () => update(() => { movePlan(state.project, state.selected, -1); state.selected -= 1; }) }, "↑"),
        h("button", { "aria-label": "プランを下へ", disabled: !p || state.selected >= state.project.plans.length - 1, onClick: () => update(() => { movePlan(state.project, state.selected, 1); state.selected += 1; }) }, "↓"),
        h("button", {
          disabled: !p || state.project.plans.length <= 1,
          onClick: () => { if (window.confirm(`「${p.name}」を削除しますか？`)) update(() => removePlan(state.project, state.selected)); },
        }, "削除")),
      p && planForm(p));
    const center = h("main", { class: "stack" },
      p ? FACILITIES.filter((f) => p.rooms[f]).map((f) => roomCard(f, p.rooms[f], p))
        : h("p", { class: "muted" }, "プランがありません"),
      p && FACILITIES.every((f) => !p.rooms[f]) && h("p", { class: "muted" }, "編集する施設が選ばれていません。左のフォームでオンにしてください。"));
    const right = h("aside", { class: "panel" }, validationEl);
    root.replaceChildren(topBar(), h("div", { class: "layout" }, left, center, right));
    refreshSide();
  }

  return { renderAll, refreshSide };
}
