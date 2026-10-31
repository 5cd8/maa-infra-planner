import { createNameIndex } from "../core/names.js";
import { buildOperBox, parseOperBox } from "../core/operbox.js";
import { importPlan } from "../core/importer.js";
import { exportPlan } from "../core/exporter.js";
import { applyPreset, createProject, setRoomCount } from "../core/model.js";
import { createStorage } from "../core/storage.js";
import { validate } from "../core/validator.js";
import { h } from "./dom.js";
import { openImportDialog, openLayoutDialog } from "./dialogs.js";
import { openPicker } from "./picker.js";
import { createView } from "./render.js";

const nameIndex = createNameIndex(JSON.parse(document.getElementById("names").textContent));
const dialog = document.getElementById("dialog");
const root = document.getElementById("app");

// localStorage が使えない環境（プライベートウィンドウなど）ではアクセサ自体が例外を投げる
const backend = {
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
};
const storage = createStorage(backend);

const state = { project: createProject(), operbox: null, selected: 0 };
const saved = storage.load();
if (saved) {
  state.project = saved.project;
  if (saved.operbox) state.operbox = buildOperBox(saved.operbox.operators);
}

const view = createView(root, {
  state,
  nameIndex,
  changed: () => storage.save(state.project, state.operbox),
  openPicker: ({ title, taken, onPick }) =>
    openPicker({ dialog, nameIndex, operbox: state.operbox, title, taken, onPick }),
  onLoadOperBox: () => chooseFile((text) => loadOperBox(text)),
  onImport: () => chooseFile((text) => loadPlan(text)),
  onLayout: () => openLayoutDialog({
    dialog,
    project: state.project,
    onApplyPreset: (name) => { applyPreset(state.project, name); touch(); },
    onSetCount: (facility, n) => { setRoomCount(state.project, facility, n); touch(); },
  }),
  onDownload: () => output((text) => {
    const blob = new Blob([text], { type: "application/json" });
    const link = h("a", { href: URL.createObjectURL(blob), download: `${state.project.title || "maa-infra"}.json` });
    link.click();
    URL.revokeObjectURL(link.href);
  }),
  onCopy: () => output((text) => Promise.resolve()
    .then(() => navigator.clipboard.writeText(text))
    .then(
      () => notice("クリップボードにコピーしました。"),
      () => notice("コピーできませんでした。ダウンロードを使ってください。"))),
  onNew: () => {
    if (!window.confirm("現在の編集内容を破棄して新規作成しますか？")) return;
    state.project = createProject();
    state.selected = 0;
    touch();
  },
});

function touch() {
  storage.save(state.project, state.operbox);
  view.renderAll();
}

function notice(message) {
  dialog.replaceChildren(h("p", {}, message),
    h("div", { class: "dialog-actions" }, h("button", { class: "primary", onClick: () => dialog.close() }, "閉じる")));
  dialog.showModal();
}

// エラーがあっても書き出しは止めない。件数を示して1回だけ確認する
function output(write) {
  const errors = validate(state.project, nameIndex, state.operbox).filter((i) => i.level === "error").length;
  if (errors > 0 && !window.confirm(
    `検証エラーが${errors}件あります。時間帯(period)の形式が不正だと、MAAがファイル全体を読み込めません。それでも出力しますか？`)) {
    return;
  }
  write(exportPlan(state.project, nameIndex));
}

function chooseFile(handler) {
  const input = h("input", { type: "file", accept: ".json,application/json" });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (file) await handler(await file.text());
  });
  input.click();
}

function loadOperBox(text) {
  try {
    state.operbox = parseOperBox(text, nameIndex);
    touch();
  } catch (e) {
    notice(`OperBoxを読み込めませんでした: ${e.message}`);
  }
}

function loadPlan(text) {
  let result;
  try {
    result = importPlan(text, nameIndex);
  } catch (e) {
    notice(`JSONを取り込めませんでした: ${e.message}`);
    return;
  }
  openImportDialog({
    dialog,
    report: result.report,
    onConfirm: () => {
      state.project = result.project;
      state.selected = 0;
      touch();
    },
  });
}

// ドロップしたJSONが OperBox か基地スケジュールかは、配列か plans を持つオブジェクトかで判別する
function routeDropped(text) {
  let data;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    notice(`JSONとして読めませんでした: ${e.message}`);
    return;
  }
  if (Array.isArray(data)) loadOperBox(text);
  else if (data && Array.isArray(data.plans)) loadPlan(text);
  else notice("OperBox でも基地スケジュールでもないJSONです。");
}

window.addEventListener("dragover", (e) => { e.preventDefault(); document.body.classList.add("drop-active"); });
window.addEventListener("dragleave", (e) => { if (e.target === document.documentElement) document.body.classList.remove("drop-active"); });
window.addEventListener("drop", async (e) => {
  e.preventDefault();
  document.body.classList.remove("drop-active");
  const file = e.dataTransfer?.files?.[0];
  if (file) routeDropped(await file.text());
});

view.renderAll();
