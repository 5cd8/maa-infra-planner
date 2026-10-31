const AMIYA_ID = "char_002_amiya";
const REQUIRED_KEYS = ["id", "name", "own"];

export function parseOperBox(text, nameIndex) {
  const data = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!Array.isArray(data)) throw new Error("OperBoxは配列である必要があります");

  const operators = data.map((item, i) => {
    if (item === null || typeof item !== "object") {
      throw new Error(`${i + 1}番目の要素がオブジェクトではありません`);
    }
    for (const key of REQUIRED_KEYS) {
      if (!(key in item)) throw new Error(`${i + 1}番目の要素に必須キー ${key} がありません`);
    }
    return {
      id: item.id,
      name: item.name,
      elite: item.elite ?? null,
      level: item.level ?? null,
      own: item.own,
      potential: item.potential ?? null,
      rarity: item.rarity ?? null,
    };
  });

  // OperBoxは char_002_amiya を含まず、別形態 char_1037_amiya3 だけを含む。
  // アーミヤの名前が1件も無いときだけ補う（あれば選択ダイアログに2行出る）。
  const amiya = nameIndex.idToEntry(AMIYA_ID);
  if (amiya && !operators.some((o) => o.name === amiya.nameJp)) {
    operators.push({
      id: AMIYA_ID, name: amiya.nameJp, elite: null, level: null, own: true,
      potential: null, rarity: amiya.rarity, source: "名前表",
    });
  }

  return buildOperBox(operators);
}

// 保存データからの復元にも使う（所持の集合は保存しないため）
export function buildOperBox(operators) {
  return {
    operators,
    ownedIds: new Set(operators.filter((o) => o.own).map((o) => o.id)),
    ownedNames: new Set(operators.filter((o) => o.own).map((o) => o.name)),
  };
}

// OperBox未読み込みのときは判定しない（null）
export function isOwned(nameJp, nameIndex, operbox) {
  if (!operbox) return null;
  if (nameIndex.idsByJp(nameJp).some((id) => operbox.ownedIds.has(id))) return true;
  return operbox.ownedNames.has(nameJp);
}
