import { PRESETS, VARIABLE_FACILITIES, FACILITY_LABELS, wouldDiscard } from "../core/model.js";
import { fill, h } from "./dom.js";

export function openImportDialog({ dialog, report, onConfirm }) {
  const section = (title, items) => items.length > 0 && h("div", {},
    h("h3", {}, `${title}(${items.length})`), h("ul", {}, items.map((i) => h("li", {}, i))));
  dialog.replaceChildren(
    h("h2", {}, "取り込み結果"),
    h("div", { class: "report" },
      h("p", {}, `名前の変換: ${report.converted} 件`),
      section("未解決名（原文のまま保持します）", report.unresolved),
      section("除外した項目", report.dropped),
      section("警告", report.warnings),
      h("p", { class: "muted" }, "取り込むと、現在の編集内容は置き換えられます。")),
    h("div", { class: "dialog-actions" },
      h("button", { onClick: () => dialog.close() }, "キャンセル"),
      h("button", { class: "primary", onClick: () => { dialog.close(); onConfirm(); } }, "取り込む")),
  );
  dialog.showModal();
}

export function openLayoutDialog({ dialog, project, onApplyPreset, onSetCount }) {
  function discardOk(facility, n) {
    return !wouldDiscard(project, facility, n)
      || window.confirm(`${FACILITY_LABELS[facility]}を${n}部屋に減らすと、配置済みの部屋が削除されます。続けますか？`);
  }
  const presetSelect = h("select", {
    "aria-label": "プリセット",
    onChange: (e) => {
      const preset = PRESETS[e.target.value];
      if (!preset) return;
      const ok = VARIABLE_FACILITIES.every((f) => discardOk(f, preset[f]));
      if (ok) onApplyPreset(e.target.value);
      render();
    },
  }, h("option", { value: "" }, "選択して適用"), Object.keys(PRESETS).map((k) => h("option", { value: k }, k)));

  const body = h("div", { class: "stack" });
  function render() {
    fill(body,
      h("div", { class: "row" }, h("label", {}, "プリセット ", presetSelect)),
      VARIABLE_FACILITIES.map((facility) => h("div", { class: "row" },
        h("label", {}, `${FACILITY_LABELS[facility]}の数 `,
          h("input", {
            type: "number", min: "1", max: "9", value: String(project.layout[facility]),
            onChange: (e) => {
              const n = Math.min(9, Math.max(1, Math.trunc(Number(e.target.value)) || 1));
              if (discardOk(facility, n)) onSetCount(facility, n);
              render();
            },
          })))),
      h("p", { class: "muted" }, "全プラン共通です。宿舎は4部屋に固定されています。"),
    );
  }
  render();
  dialog.replaceChildren(
    h("h2", {}, "基地の構成"), body,
    h("div", { class: "dialog-actions" }, h("button", { class: "primary", onClick: () => dialog.close() }, "閉じる")),
  );
  dialog.showModal();
}
