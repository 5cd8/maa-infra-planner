import { readFileSync } from "node:fs";
import { createNameIndex } from "../src/core/names.js";

export const names = JSON.parse(readFileSync(new URL("../data/names.json", import.meta.url), "utf8"));
export const nameIndex = createNameIndex(names);

export function fixture(file) {
  return readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8");
}

// project の比較用。id は呼び出しごとに変わるので除く
export function withoutIds(project) {
  return { ...project, plans: project.plans.map(({ id, ...rest }) => rest) };
}
