import test from "node:test";
import assert from "node:assert/strict";
import { assemble } from "../tools/build.mjs";

const template = "<html><!-- STYLE --><body><!-- NAMES --><!-- SCRIPT --></body></html>";

test("B1: </script> と $& を含む埋め込みで出力が壊れない", () => {
  const html = assemble({
    template,
    style: "a { content: '$&'; }",
    names: JSON.stringify({ x: "</script><b>$'</b>" }),
    script: "const s = '</script>$&';",
  });
  assert.equal(html.match(/<\/script>/g).length, 2);
  assert.ok(html.includes("content: '$&';"));
  assert.ok(html.includes("const s = '<\\/script>$&';"));
  const names = /<script type="application\/json" id="names">(.*?)<\/script>/s.exec(html)[1];
  assert.equal(JSON.parse(names.replace(/<\\\//g, "</")).x, "</script><b>$'</b>");
});

test("B1: 外部参照があると失敗する。文字列中のURLは失敗しない", () => {
  const bad = '<script src="https://example.com/a.js"></script><!-- STYLE --><!-- NAMES --><!-- SCRIPT -->';
  assert.throws(() => assemble({ template: bad, style: "", names: "{}", script: "" }), /外部参照/);
  const bad2 = '<link href="http://example.com/a.css"><!-- STYLE --><!-- NAMES --><!-- SCRIPT -->';
  assert.throws(() => assemble({ template: bad2, style: "", names: "{}", script: "" }), /外部参照/);
  assert.doesNotThrow(() => assemble({ template, style: "", names: "{}", script: 'const u = "https://example.com";' }));
});
