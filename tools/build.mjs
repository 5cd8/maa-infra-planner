import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// HTML内の <script> に埋め込む文字列で、</script> がタグの終端と解釈されないようにする
const escapeScriptEnd = (text) => text.replace(/<\/script/gi, "<\\/script");

const EXTERNAL_REFERENCE = /<(?:script|link)\b[^>]*\s(?:src|href)\s*=\s*["']?https?:/i;

export function assemble({ template, style, names, script }) {
  if (EXTERNAL_REFERENCE.test(template)) throw new Error("テンプレートに外部参照(http/https)があります");
  // 置換文字列に関数を渡す。文字列だと $& や $' が展開されて埋め込み内容が壊れる
  const html = template
    .replace("<!-- STYLE -->", () => `<style>\n${style}\n</style>`)
    .replace("<!-- NAMES -->", () => `<script type="application/json" id="names">${escapeScriptEnd(names)}</script>`)
    .replace("<!-- SCRIPT -->", () => `<script>\n${escapeScriptEnd(script)}\n</script>`);
  if (EXTERNAL_REFERENCE.test(html)) throw new Error("出力に外部参照(http/https)があります");
  return html;
}

async function main() {
  const result = await build({
    entryPoints: [`${root}src/ui/main.js`],
    bundle: true,
    format: "iife",
    minify: false,
    write: false,
    logLevel: "warning",
    charset: "utf8",
  });
  const html = assemble({
    template: readFileSync(`${root}src/index.template.html`, "utf8"),
    style: readFileSync(`${root}src/style.css`, "utf8"),
    names: readFileSync(`${root}data/names.json`, "utf8"),
    script: result.outputFiles[0].text,
  });
  mkdirSync(`${root}dist`, { recursive: true });
  writeFileSync(`${root}dist/maa-infra-planner.html`, html);
  console.log(`dist/maa-infra-planner.html (${html.length} 文字)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
