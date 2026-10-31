import test from "node:test";
import assert from "node:assert/strict";
import { names, nameIndex } from "./helpers.js";

test("N1: char_ だけが入っている", () => {
  assert.ok(names.source.startsWith("MAA "));
  assert.ok(names.chars.length > 0);
  for (const [id] of names.chars) assert.match(id, /^char_/);
});

test("N1: jpAvailable が偽の中国語名は cnToJp が null", () => {
  const unavailable = names.chars.filter((c) => !c[4]);
  assert.ok(unavailable.length > 0);
  // 代用値は日本語名として選べない
  const [, cn] = unavailable.find(([, cn]) => !names.chars.some((c) => c[4] && c[1] === cn));
  assert.equal(nameIndex.cnToJp(cn), null);
});

test("N2: 中国語名が重複するIDの組で name_jp が同一", () => {
  const byCn = new Map();
  for (const [, cn, jp, , available] of names.chars) {
    if (!available) continue;
    if (!byCn.has(cn)) byCn.set(cn, new Set());
    byCn.get(cn).add(jp);
  }
  const bad = [...byCn].filter(([, s]) => s.size > 1);
  assert.deepEqual(bad, []);
});

test("N3: 阿米娅 / 凯尔希", () => {
  assert.equal(nameIndex.cnToJp("阿米娅"), "アーミヤ");
  assert.equal(nameIndex.cnToJp("凯尔希"), "ケルシー");
});

test("N5: 中国語名と日本語名の衝突が無く、1対1", () => {
  const pairs = new Map();
  for (const [, cn, jp, , available] of names.chars) if (available) pairs.set(`${cn}\0${jp}`, [cn, jp]);
  const list = [...pairs.values()];
  const collisions = [];
  for (const [cn, jp] of list) {
    for (const [cn2, jp2] of list) {
      if (cn === jp2 && (cn !== cn2 || jp !== jp2)) collisions.push([cn, jp, cn2, jp2]);
    }
  }
  assert.deepEqual(collisions, [], JSON.stringify(collisions));
  const cnCount = new Map();
  const jpCount = new Map();
  for (const [cn, jp] of list) {
    cnCount.set(cn, (cnCount.get(cn) ?? 0) + 1);
    jpCount.set(jp, (jpCount.get(jp) ?? 0) + 1);
  }
  assert.deepEqual([...cnCount].filter(([, n]) => n > 1), []);
  assert.deepEqual([...jpCount].filter(([, n]) => n > 1), []);
});

test("N6: jpToCn", () => {
  assert.equal(nameIndex.jpToCn("アーミヤ"), "阿米娅");
  assert.equal(nameIndex.jpToCn("ケルシー"), "凯尔希");
  assert.equal(nameIndex.jpToCn("存在しない名前"), null);
  const [, cn] = names.chars.find((c) => !c[4]);
  assert.equal(nameIndex.jpToCn(cn), nameIndex.jpNameSet.has(cn) ? cn : null);
});
