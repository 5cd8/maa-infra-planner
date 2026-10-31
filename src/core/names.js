// table は data/names.json の内容。chars の各要素は [id, nameCn, nameJp, rarity, jpAvailable]
export function createNameIndex(table) {
  const jpToCnMap = new Map();
  const cnToJpMap = new Map();
  const idMap = new Map();
  const idsByJpMap = new Map();

  for (const [id, nameCn, nameJp, rarity, jpAvailable] of table.chars) {
    idMap.set(id, { nameCn, nameJp, rarity, jpAvailable });
    if (!idsByJpMap.has(nameJp)) idsByJpMap.set(nameJp, []);
    idsByJpMap.get(nameJp).push(id);
    // jpAvailable が偽のものは name_jp が中国語名の代用値なので、日本語名として扱わない
    if (jpAvailable) {
      // 中国語名が重複するIDでも日本語名は同一なので、最初の一致を使う
      if (!jpToCnMap.has(nameJp)) jpToCnMap.set(nameJp, nameCn);
      if (!cnToJpMap.has(nameCn)) cnToJpMap.set(nameCn, nameJp);
    }
  }

  return {
    source: table.source,
    jpNameSet: new Set(jpToCnMap.keys()),
    jpToCn: (nameJp) => jpToCnMap.get(nameJp) ?? null,
    cnToJp: (nameCn) => cnToJpMap.get(nameCn) ?? null,
    idToEntry: (id) => idMap.get(id) ?? null,
    idsByJp: (nameJp) => idsByJpMap.get(nameJp) ?? [],
    entries: () => [...idMap.entries()].map(([id, e]) => ({ id, ...e })),
  };
}
