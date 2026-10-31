const KEY = "maa-infra-planner:v1";
const VERSION = 1;
const DEBOUNCE_MS = 300;

export function createStorage(backend, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null;
  let pending = null;

  function slimOperbox(operbox) {
    if (!operbox) return null;
    return {
      operators: operbox.operators.map(
        ({ id, name, elite, level, own, potential, rarity }) => ({ id, name, elite, level, own, potential, rarity }),
      ),
    };
  }

  function writeNow(project, operbox) {
    try {
      backend.setItem(KEY, JSON.stringify({ version: VERSION, project, operbox: slimOperbox(operbox) }));
    } catch {
      // 保存できない環境でも画面は動かし続ける
    }
  }

  return {
    // 保存内容がなければ null。version 不一致や壊れたデータも破棄して null
    load() {
      try {
        const raw = backend.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.version !== VERSION || !data.project) return null;
        return { project: data.project, operbox: data.operbox };
      } catch {
        return null;
      }
    },
    save(project, operbox) {
      if (timer !== null) clearTimer(timer);
      pending = { project, operbox };
      timer = setTimer(() => {
        timer = null;
        pending = null;
        writeNow(project, operbox);
      }, DEBOUNCE_MS);
    },
    // タブを閉じる直前など、デバウンス待ちの保存を即時に書き切る
    flush() {
      if (timer === null) return;
      clearTimer(timer);
      timer = null;
      const { project, operbox } = pending;
      pending = null;
      writeNow(project, operbox);
    },
    saveNow: writeNow,
  };
}
