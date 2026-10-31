import { isOwned } from "../core/operbox.js";
import { h } from "./dom.js";

// 選択肢は名前表の日本語名とOperBoxの和集合。OperBoxの昇進・レベル・レアリティで上書きする
export function buildChoices(nameIndex, operbox) {
  const byName = new Map();
  for (const e of nameIndex.entries()) {
    if (e.jpAvailable && !byName.has(e.nameJp)) {
      byName.set(e.nameJp, { name: e.nameJp, rarity: e.rarity, elite: null, level: null });
    }
  }
  if (operbox) {
    for (const o of operbox.operators) {
      const base = byName.get(o.name) ?? { name: o.name, rarity: o.rarity, elite: null, level: null };
      // 同名で複数IDがあるとき（アーミヤの形態など）は所持している方の情報を使う
      if (o.own || !byName.has(o.name) || base.elite === null) {
        byName.set(o.name, { ...base, rarity: o.rarity ?? base.rarity, elite: o.elite, level: o.level });
      }
    }
  }
  const choices = [...byName.values()].map((c) => ({ ...c, owned: isOwned(c.name, nameIndex, operbox) }));
  return choices.sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0) || a.name.localeCompare(b.name, "ja"));
}

// dialog: <dialog> 要素。onPick は選ばれた名前を受け取る。taken は同一プランで配置済みの名前の集合
export function openPicker({ dialog, nameIndex, operbox, title, taken, onPick }) {
  const choices = buildChoices(nameIndex, operbox);
  let query = "";
  let ownedOnly = operbox !== null;
  let rarity = "";

  const list = h("div", { class: "picker-list", role: "listbox" });
  const search = h("input", {
    type: "text", placeholder: "名前で検索", "aria-label": "名前で検索",
    onInput: (e) => { query = e.target.value; renderList(); },
  });
  const ownedBox = h("input", {
    type: "checkbox", checked: ownedOnly, disabled: operbox === null,
    onChange: (e) => { ownedOnly = e.target.checked; renderList(); },
  });
  const rarityBox = h("select", { "aria-label": "レアリティ", onChange: (e) => { rarity = e.target.value; renderList(); } },
    h("option", { value: "" }, "すべて"),
    [6, 5, 4, 3, 2, 1].map((r) => h("option", { value: String(r) }, `★${r}`)));

  function renderList() {
    list.replaceChildren();
    const rows = choices.filter((c) =>
      c.name.includes(query)
      && (!ownedOnly || c.owned !== false)
      && (rarity === "" || String(c.rarity) === rarity));
    for (const c of rows) {
      list.append(h("button", {
        class: `pick-row${taken.has(c.name) ? " taken" : ""}`, role: "option",
        onClick: () => { dialog.close(); onPick(c.name); },
      },
      h("span", {}, c.name),
      h("span", {}, c.rarity ? `★${c.rarity}` : ""),
      h("span", {}, c.elite !== null && c.elite !== undefined ? `昇進${c.elite} Lv${c.level ?? "—"}` : "—"),
      h("span", { class: "tag" }, c.owned === false ? "未所持" : taken.has(c.name) ? "配置済み" : "")));
    }
    if (rows.length === 0) list.append(h("p", { class: "muted" }, "該当なし"));
  }

  dialog.replaceChildren(
    h("h2", {}, title),
    h("div", { class: "row" }, search,
      h("label", {}, ownedBox, " 所持のみ"), h("label", {}, "レアリティ ", rarityBox)),
    list,
    h("div", { class: "dialog-actions" }, h("button", { onClick: () => dialog.close() }, "閉じる")),
  );
  renderList();
  dialog.showModal();
  search.focus();
}
