const KEY = "maa-infra-planner:v1";
const VERSION = 1;
const DEBOUNCE_MS = 300;

export function createStorage(backend, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null;

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
      timer = setTimer(() => {
        timer = null;
        writeNow(project, operbox);
      }, DEBOUNCE_MS);
    },
    saveNow: writeNow,
  };
}
