# 実装計画: MAA基地スケジュールJSON作成支援ツール(Issue #1)

- 対象Issue: https://github.com/5cd8/maa-infra-planner/issues/1 （アシスタントが対話で要件を確定して起票したIssue。要約・言い換えはせず、この計画はIssueを正とする）
- スコープ: Issue全体（PR分割なし）
- 依頼プロンプト: `user-prompt/202610311200_issue1.md`
- 用語: `CONTEXT.md`、判断理由: `docs/adr/0001-single-html-and-bundled-name-table.md`

## 0. ラウンド1レビューを受けた主要な変更（実機確認による）

- **名前の言語（最重要）**: 日本版MAAでも、基地スケジュールの人名は**簡体字中国語名**で書く。MAAはOCRで読んだ日本語名を中国語名に置き換えてから照合する（R20）。2026-10-31、一图流の中国語JSONを日本版にそのまま読ませて配置が反映されることを実機で確認済み。したがって本ツールは、**画面は日本語名、出力は中国語名**とする（D1・D10）。
- **`period` の日またぎ**: MAA GUIは区間を日またぎで扱えない（R21）。画面では日またぎの区間を入力でき、**出力時に2区間へ自動分割**する（D11）。
- **施設の有無はプランごと**: 一图流の出力は、プランによって `processing`・`training` のキー有無が違う（R22）。「編集する施設」はファイル全体ではなくプランごとに持つ（D5改）。

## 0.1 読み替え（00 項目30）

- 汎用テンプレートの「ブラウザ確認」は、このプロジェクトでは本番の確認方法そのもの（成果物がブラウザで開く単一HTML）。画面確認はブラウザで行う。
- 「実機確認」は、実際の MAA（日本版、v6.20.1）にJSONを読み込ませる操作を指す。

## 1. ゴール / 非ゴール

Issue #1 の「ゴール」「非ゴール」のとおり。計画の補足:

- **Issue #1 への変更（実機確認・調査で判明。Issue本文は更新済み。§12）**: ①人名は中国語名で出力する（§0）。②日またぎの `period` は出力時に2区間へ分割する。③施設のキー有無はプランごと。④`period` 関連: MAA GUIは `period` を解釈して時間帯でプランを自動で切り替える（`CustomInfrastTimeSchedule`）。**一部のプランにだけ `period` があると予期しない動作になる**（`CustomInfrastFileHasPlanNoPeriod`、`src/MaaWpfGui/Res/Localizations/ja-jp.xaml:234`）。検証ルールW6として追加する。Issueの非ゴール「`period` による自動切り替え」は「ツールでは実装しない（GUI側の機能）」と読み替える。

## 2. 調査で確認した事実（一次情報）

実装者は再調査せず、ここを前提にしてよい。出典はすべてローカルのクローン `C:\Users\owner\source\repos\MaaAssistantArknights`（v6.20.1、`d94dd00`）と、実データ。

| # | 事実 | 出典 |
|---|---|---|
| R1 | 基地スケジュールJSONのトップは `title`・`description`・`plans`。必須は `plans` のみ。`plans[]` の必須は `rooms` のみ | `docs/maa-infra.schema.json` |
| R2 | 部屋の枠数上限: control/meeting/hire/training/recycle=1、manufacture/trading/power=9、dormitory=4。`operators` は1部屋5人まで | 同上 |
| R3 | `Fiammetta` は `enable`・`target`・`order` が必須。`drones` の `index` は **1始まり**（コアが `-1` する） | 同上、`src/MaaCore/Task/Interface/InfrastTask.cpp:538` |
| R4 | `drones.room` は `trading`/`manufacture` のみ。`room` が空・無いときは警告のみでドローンを使わず、それ以外の値はインフラタスク全体が失敗する | `InfrastTask.cpp` のドローン処理（`error drones config, unknown room`） |
| R5 | `product` は `Battle Record`・`Pure Gold`・`Dualchip`・`Originium Shard`・`LMD`・`Orundum` の6種。未知の値は警告のみで無視される | `InfrastTask.cpp:341-358` |
| R6 | `sort`・`skip`・`autofill`・`use_operator_groups` の既定値はすべて `false`（コアの既定）。一图流の出力で `sort: true` なのは制御中枢・貿易所・製造所と、訓練室（無効。R23）のみ（ほかは `false`） | `InfrastTask.cpp:337-340`、参考ファイル |
| R7 | `operatorsA`/`operatorsB` は訓練室でのみ解釈される | `InfrastTask.cpp:409-433` |
| R8 | 施設ごとの最大配置人数: 制御中枢5、製造所3、貿易所3、発電所1、応接室2、事務室1、宿舎5、加工所1。（回収ステーション2は対象外） | `src/MaaCore/Task/Infrast/*Task.h` の `max_num_of_opers`、`resource/infrast.json` |
| R9 | プリセット部屋数（`rooms` の配列長）: 243=貿易2・製造4・発電3、153=貿易1・製造5・発電3、252=貿易2・製造5・発電2、333=貿易3・製造3・発電3。共通: 宿舎4、制御中枢・応接室・事務室・加工所=各1 | `resource/custom_infrast/*.json` を読んで集計 |
| R10 | 参考の一图流243: `layout` に加工所・訓練室・回収ステーション各1を含む。`plans` は B班(`08:00`-`10:00`)・A班(`20:00`-`22:00`)、`drones: {room: trading, index: 1, rule: all, order: pre}`、`Fiammetta` あり、宿舎は `autofill: true`。**`rooms` のキー有無はプランごとに違う**: 旧ファイルは両プランとも `processing`・`training` が無く、新ファイル（`(1)`）はA班だけにある（R22） | `C:\Users\owner\Downloads\一图流-243-一天两换-MAA.json`、`...MAA (1).json` |
| R11 | OperBox: UTF-8 **BOM付き**の配列。415件（所持408・未所持7）。キーは `id`・`name`(日本語)・`elite`・`level`・`own`・`potential`・`rarity`。**`char_002_amiya` は含まれないが、アーミヤ形態の `char_1037_amiya3`（`name:"アーミヤ"`、所持）は含まれる** | `C:\MAA\Arknights_OperBox_Export.json` |
| R12 | `resource/battle_data.json` の `chars` は1389件（`char_` 463、`trap_` 852、`token_` 74）。**`char_` のみ使う**。各件に `name`(中国語)・`name_jp`・`rarity`。`name_jp_unavailable: true` の17件は `name_jp` が中国語名のままの代用値（日本版に未実装） | 実データ集計 |
| R13 | OperBoxの `name` は `char_` の `name_jp` と**全件一致**（不一致0件、OperBoxにあるIDが `battle_data` に無い件も0件） | 実データ照合 |
| R14 | `char_` 内で中国語名が重複するのは `阿米娅`（`char_002_amiya`・`char_1001_amiya2`・`char_1037_amiya3`）・`暮落`・予備隊員系・`Sharp`/`Pith`/`Touch`/`Stormeye`/`郁金香` など。**重複するID同士の `name_jp` は同一**（日本語名で見れば曖昧さは生じない） | 実データ集計 |
| R15 | 新ファイル `(1)` のプランに出る名前は、回収ステーションを除いて63名（`Fiammetta.target` を含む）。**全員**がファイル内 `operators` 一覧にあり、名前表で日本語名に変換できる。回収ステーションの4名（摩根・森西・凛冬・流明）は取り込み時に除外する。importer の変換にOperBoxは使わない（ファイル内 `operators` と名前表で変換する）。OperBoxは所持判定（W1）にだけ使う | 実データ検算 |
| R16 | `candidates` は `autofill: true` と互換性がない（`autofill` が真のとき `candidates` は空にする） | `docs/ja-jp/protocol/base-scheduling-schema.md` |
| R17 | MAA GUIでの読み込み場所: 「インフラモード」→「カスタムされた基地構成」→「基地構成ファイルの指定」 | `ja-jp.xaml:216-231` |
| R18 | 実機のMAAは v6.20.1（`C:\MAA\MAA.exe`）で、クローンと同じ | ファイルバージョン |
| R19 | 製品名の日本語ラベル（UI表示用）: `Battle Record`=作戦記録、`Pure Gold`=純金、`Dualchip`=**中級SoC**、`Originium Shard`=源石の欠片、`LMD`=龍門幣、`Orundum`=合成玉。MAA GUIの表記に合わせる（表示専用で出力には影響しない） | `ja-jp.xaml:174-179` |
| R20 | **MAAは基地スケジュールの人名を簡体字中国語名で照合する**。OCRで読んだ日本語名を `CharsNameOcrReplaceHotfix`（`replaceFull: true`、1078件）で中国語名に置換し、その結果を設定の `names` と比べる。設定側は変換しない。`name_jp_unavailable` でない446件の `name_jp` に補正規則を先頭から順に適用すると（最初の一致で止まらず、置換後の文字列に残りの規則も続けて適用される）、444件が `battle_data` の `name`（中国語名）に一致する（うち23件は日本語名＝中国語名で、`W`・`Mon3tr` など）。残り2件（`ディピカ`・`ヘドリー`）は、規則側がOCR誤読の別字（`ディピ力`＝漢字の「力」、`へドリー`＝ひらがなの「へ」。`ocr_replace.json:67,523`）で書かれているため、OCRが正しいカタカナで読むと置換されず照合に失敗する**可能性がある（未検証の仮説）**。参考ファイル `(1)` の B班 貿易所に `赫德雷` がいるので、§10 で実機確認する。なお日本語の公式ドキュメントは今も「クライアント言語（日本語）の名前」と書いているが、実装と実機に合わないので従わない。名前表の範囲で、日本語名↔中国語名は1対1（片側だけ複数になる組・衝突は0件）。**実機確認済み**（2026-10-31）: 中国語名のJSONをそのまま日本版（v6.20.1）に読ませて配置が反映された | `resource/global/YoStarJP/resource/tasks/hotfix/ocr_replace.json`、`InfrastAbstractTask.cpp:570-639`、`src/MaaCore/Vision/OCRer.cpp:125-140`、`InfrastTask.cpp:495,509`（フィアメッタが `"菲亚梅塔"` を固定で使う）、`base-scheduling-schema.md` の「簡体字中国語名を指定」の注記、実機 |
| R21 | MAA GUIは、インフラタスクを積む（実行を開始する）時点のローカル時刻で、`period` に含まれる最初のプランを選ぶ。判定は `開始 <= 現在 <= 終了`（両端を含む）で、**24時をまたぐ区間は扱えない**（公式ドキュメントも `22:00`-`23:59` と `00:00`-`06:00` に分けて書く例を示す）。どの区間にも当たらないときはプラン0を使いエラーログを出す。実行中に時刻をまたいでも切り替わらない。実機確認済み（21:20での切り替え） | `src/MaaWpfGui/ViewModels/UserControl/TaskQueue/InfrastTaskUserControlModel.cs:585,621,760-775`、`base-scheduling-schema.md:36-43`、実機 |
| R22 | 施設のキー有無: キーが無い施設はデフォルトのアルゴリズム、`[]` は施設全体が現状維持、部屋オブジェクトに配置の意思が無ければその部屋は現状維持。**一图流の出力は、プランごとに `processing`・`training` のキー有無が違う**（R10）。取り込み→書き出しでキーを増やすと、MAAの動作が黙って変わる | `docs/maa-infra.schema.json:158`、`base-scheduling-schema.md:78-82`、参考ファイル |
| R23 | 訓練室で有効なのは `skip` と `operatorsA`/`operatorsB` だけ。`operators`・`sort`・`autofill`・`candidates`・`product` は無効 | `base-scheduling-schema.md:173`、`docs/maa-infra.schema.json:181-186` |

実行環境: Node.js v24.20.0、npm 11.19.0、Python 3（`python` コマンド、`-I` 付きで実行）。

## 3. 全体設計

### 3.1 ディレクトリ構成

```
maa-infra-planner/
  CONTEXT.md / README.md / package.json / package-lock.json / .gitignore
  docs/adr/0001-...md
  design-docs-for-ai/ / user-prompt/
  data/names.json               名前表（生成物、gitで管理）
  schema/maa-infra.schema.json  公式Schemaの複製（出典コミットをREADMEに記載）
  tools/build_name_table.py     battle_data.json → data/names.json
  tools/build.mjs               src と data を1つのHTMLにまとめる
  src/
    core/                       DOMに依存しない純ロジック（テスト対象）
      names.js / operbox.js / model.js / importer.js / exporter.js / validator.js / storage.js
    ui/                         DOMを触る部分
      main.js / render.js / picker.js / dialogs.js
    index.template.html / style.css
  dist/maa-infra-planner.html   ビルド成果物（gitで管理、ユーザーが開く）
  tests/                        node --test
    fixtures/
```

### 3.2 技術選択

| 項目 | 採用 | 理由・却下した案 |
|---|---|---|
| 言語 | 素のJavaScript（ESM）。フレームワークなし | 画面は小さく、単一HTMLに収めたい。React等は却下 |
| バンドル | `esbuild`（devDependency、バージョン固定） | ESMを1つのスクリプトにする。自前の連結は、`import` の書き換えで壊れやすいので却下 |
| テスト | `node --test`（組み込み） + `ajv`（devDependency、テストのみ） | 公式Schemaへの適合を機械的に確かめる。アプリ本体は実行時依存ゼロ。ajvは `strict: false` で使う（Schemaの `$schema` の書式などで厳密モードが警告・失敗する場合に備える。実装時に確かめる） |
| Schema検証（アプリ内） | 自前の検証（§5.6） | Schemaの構造は小さい。ajvを同梱するとHTMLが大きくなる。適合性はテストでajvにより担保 |
| 状態管理 | 1つの `state` オブジェクトと `render()` の全再描画 | データ量が小さい（選択ダイアログは約450件で、仮想化は不要）。差分更新は不要 |

バージョンは実装時に `npm view <pkg> time` で、公開から2週間以上経ったものを選んで固定する。

### 3.3 データフロー

```
OperBox JSON ─┐                        ┌─ 検証 ──→ 画面
名前表(names.json, 埋め込み) ─┼→ state ─┤
中国語/日本語 JSON ─(importer)┘        └─ exporter(日本語名→中国語名) ─→ ダウンロード/コピー
```

オペレーターは**日本語名の文字列**で保持する（画面表示と選択のため）。**出力時にだけ中国語名へ変換する**（`jpToCn`、R20）。IDは変換と所持判定のためにだけ使い、`state` には持たない。名前表の範囲で日本語名↔中国語名は1対1（R20）なので、取り込み→書き出しで名前が変わらない。名前表に無い名前（未解決名）は、変換せず原文のまま保持して出力する。

## 4. データモデル

```js
// project
{
  title: string, description: string,
  layout: {
    manufacture: 1..9, trading: 1..9, power: 1..9,   // 部屋数（全プラン共通）
    dormitory: 4                                     // 固定
  },
  plans: Plan[]
}
// Plan
{
  id: string,                  // 画面内の識別用（出力しない）
  name: string, description: string,
  periods: [string, string][], // ["HH:MM","HH:MM"]。開始>終了（日またぎ）も保持できる。出力時に分割（D11）
  fiammetta: { enable: boolean, target: string, order: "pre"|"post" },
  drones:    { enable: boolean, room: "trading"|"manufacture", index: number, order: "pre"|"post" },
  rooms: { [facility]: Room[] }   // キーがある施設＝このプランで編集する施設（D5）
}
// Room
{
  operators: string[], candidates: string[],
  sort: boolean, skip: boolean, autofill: boolean,
  product: string | "",              // 製造所・貿易所のみ
  operatorsA?: string[], operatorsB?: string[]  // 訓練室のみ（訓練室の Room は常に空配列で持つ。ほかの施設の Room は持たない）
}
```

- 新規プランの既定: `fiammetta = {enable:false, target:"", order:"pre"}`、`drones = {enable:false, room:"trading", index:1, order:"pre"}`、`periods = []`。取り込み時に `Fiammetta`/`drones` が無いプランも、この既定にする。取り込み時、`Fiammetta`/`drones` に `enable` が無ければ `true` と解釈する（公式ドキュメントの既定値）。
- 新規の部屋の既定: 空の配置、`sort`=D6、`autofill`=D7（宿舎のみ真）、`product` は空。
- 施設のキーと出力順: `control`, `manufacture`, `trading`, `power`, `meeting`, `hire`, `dormitory`, `processing`, `training`。
- **「編集する施設」はプランごと**: `plan.rooms` にキーがある施設だけがそのプランで編集対象。キーが無い施設は出力にもキーを出さない（キー無し＝MAAのデフォルトアルゴリズム。R22）。新規プランは、全9施設のキーを持つ状態で作る。画面では、プランごとに施設の「編集する」をオン/オフできる。オフにするとそのプランの当該施設の部屋データを削除し（配置などが空でない部屋があれば確認を出す）、オンに戻すと `createRoom` の既定で作り直す。
- 訓練室の `Room` は `operatorsA`/`operatorsB`/`skip` だけを持つ（R23）。製造所・貿易所以外の部屋は `product` を持たない。
- 部屋数の変更時（画面操作）、各プランの該当配列を伸縮する。増やす部屋は「新規の部屋の既定」（D6・D7）で作る。縮めるときに空でない部屋を消すなら確認を出す（判定は `model.js` の `wouldDiscard`、確認の表示はUI。§5.10）。

### 4.1 プリセット（R9）

| 名前 | manufacture | trading | power |
|---|---|---|---|
| 243 | 4 | 2 | 3 |
| 153 | 5 | 1 | 3 |
| 252 | 5 | 2 | 2 |
| 333 | 3 | 3 | 3 |

宿舎=4。新規プランは全施設のキーを持つ（訓練室を含む）。

## 5. 各モジュールの仕様

### 5.1 `tools/build_name_table.py` と `data/names.json`

- 入力: `battle_data.json` のパス（引数）。出力: `data/names.json`（UTF-8、改行LF=`open(..., "w", encoding="utf-8", newline="\n")`、`ensure_ascii=False`。1件1行にするため、`chars` の各要素を `json.dumps` して自前で1行ずつ書く）。
- `chars` のうち `char_` で始まるIDだけを対象にする（R12）。
- 形式: `{ "source": "<MAA version/commit>", "chars": [[id, name_cn, name_jp, rarity, jpAvailable], ...] }`。`jpAvailable = not name_jp_unavailable`（R12）。IDの昇順。
- `--source` 引数で出典（例: `MAA v6.20.1 d94dd00`）を記録する。
- Pythonの出力は `sys.stdout.reconfigure(encoding="utf-8")`、`python -I` で実行（Windowsのcp932対策、02 項目2）。

### 5.2 `core/names.js`

`createNameIndex(table)` が次を返す（`table` は `names.json` の内容）:

| 関数 | 動作 |
|---|---|
| `jpNameSet` | `jpAvailable` が真の `name_jp` の集合（選択肢として有効な日本語名） |
| `jpToCn(nameJp)` | 日本語名 → 中国語名（出力用）。`jpAvailable` が真のものだけ。無ければ `null`（呼び出し側が原文のまま出す） |
| `cnToJp(nameCn)` | 中国語名 → 日本語名。無ければ `null`。`jpAvailable` が偽のものは `null`（R12）。ID重複でも日本語名は同一（R14）なので最初の一致を返す |
| `idToEntry(id)` | ID → `{nameCn, nameJp, rarity, jpAvailable}` |
| `idsByJp(nameJp)` | 日本語名 → IDの配列（所持判定に使う） |

### 5.3 `core/operbox.js`

- `parseOperBox(text, nameIndex)`: 先頭のBOM（`\uFEFF`）を除去して `JSON.parse`。配列でない、または必須キー（`id`・`name`・`own`）が欠けた要素があれば、何番目の要素かを示すエラーを投げる。`elite`・`level`・`rarity` は無ければ `null` として扱う。
- 戻り値 `{ operators: [{id,name,elite,level,own,potential,rarity}], ownedNames: Set }`。
- **アーミヤの補完（R11）**: OperBoxに `name` が `アーミヤ` の要素が**1件も無いときだけ**、名前表から `{id:"char_002_amiya", name:"アーミヤ", own:true, source:"名前表"}` を追加する（`char_1037_amiya3` が既にあれば、選択ダイアログに2行出さない）。画面では補完分の昇進・レベルを「—」と表示する。
- 所持判定 `isOwned(nameJp, nameIndex, operbox)`: `idsByJp(nameJp)` のいずれかが OperBox で `own: true` なら真。OperBoxが未読み込みのときは判定しない（`null` を返し、警告を出さない）。

### 5.4 `core/importer.js`

`importPlan(text, ctx)` → `{ project, report }`。`ctx` は名前表の索引。

1. BOMを除去してパース。`plans` が配列でなければエラー。
2. **名前変換（中国語→日本語、画面用）** `convertName(name)`:
   1. ファイルに拡張フィールド `operators` があり、その `name` と一致 → `id` → 名前表の `nameJp`（`jpAvailable` が真ならそれ。偽、またはIDが名前表に無いときは次の2-2へ進み、それでも決まらなければ未解決）。`operators` の形は2通りを受ける: 配列 `[{id, name, ...}]`（`extensionVersion` 2.0、参考ファイル `(1)`）と、IDをキーにしたオブジェクト `{ "char_002_amiya": {name, ...} }`（公式ドキュメントの1.0。`docs/ja-jp/protocol/base-scheduling-schema.md:243`）。どちらでもなければ2-1を飛ばす。
   2. 名前表の `cnToJp(name)` が非 `null` → それ。
   3. `jpNameSet` に含まれる → そのまま（日本語名のJSON）。
   4. いずれでもない → 原文のまま残し、`report.unresolved` に記録（検証で警告になる）。
   - 順序の理由: 名前表の範囲で「Aの中国語名 = Bの日本語名」の衝突（名前の組が異なるもの）は0件（R20、テストN5で毎回確かめる）。中国語名と日本語名が同じ表記のもの（`W`・`Mon3tr` など）はどちらでも同じ結果。
   - 出力時は逆に `jpToCn` で中国語名へ戻すので、取り込み→書き出しで名前は元の中国語名になる（`jpAvailable` が偽で未解決のものは、原文のまま出力される）。
3. **部屋数**（`layout.manufacture/trading/power`）: `layout`（配列）があれば `type` ごとに数える。無ければ、全プランの `rooms` から各施設の最大配列長を採る。どのプランにもキーが無い施設は、プリセット243の部屋数（製造4・貿易2・発電3）にする。`layout` にその施設が0件のときは、`layout` に無いものとして同じ規則（配列長→243）に従う。範囲は1〜9。超えたら9に切り詰めて `report.dropped` に記録する。宿舎は常に4（超過は切り詰めて `report.dropped` に記録）。制御中枢・応接室・事務室・加工所・訓練室は1部屋に固定し、超過は切り詰めて `report.dropped` に記録する。`recycle` は除外し `report.dropped` に記録。
   **施設の有無（編集する施設）は `layout` からは決めない。プランごとに、そのプランの `rooms` にキーがあるかで決める**（R22）。`layout` は部屋数にだけ使う。
4. トップの `title`・`description` を読む。各プラン: `name`（無ければ `プラン N`）、`description`、`period`、`Fiammetta`、`drones`、`rooms` を読む。
   - `rooms` の各施設について、配列を手順3の部屋数に合わせる。不足は**全項目が偽・空の部屋**（`sort`・`autofill` を含めて偽。元の「配列が短い＝その部屋は変更しない」を保つため。D6・D7は使わない）で補う。キーが無い施設は、そのプランの `rooms` にキーを作らない。
   - 製造所・貿易所以外の部屋の `product`、訓練室の `operators`・`sort`・`autofill`・`candidates` は、MAAで無効（R23）なので無視する（報告不要）。
   - `recycle` キー → 除外して `report.dropped` に記録。
   - `groups`・`use_operator_groups`（本ツール未対応・Issueの非ゴール）→ **黙って落とさず**、`report.dropped` に「オペレーターグループは未対応のため除外」と記録する。`use_operator_groups: true` の部屋は、`operators`（グループ名）を空にして取り込む。
   - 手順3の部屋数より長い施設配列は、切り詰めて `report.dropped` に記録する。未知の施設キーは無視して `report.warnings` に記録する。
   - `drones.room` が無い、または `trading`・`manufacture` 以外の場合（公式の日本語ドキュメントは `"manufacturing"` と誤記している。コアは不正な値でインフラタスク全体を失敗させる。R4）は、`enable` を偽にし、`room` は `trading` にして `report.warnings` に記録する（`enable` が偽なので、補っても元は使っていなかったドローンを使うことにはならない。不正な値を残すと書き出しがSchema違反になる）。`index` が無ければ1、`order` が無ければ `pre`。`Fiammetta.order` が無いときも `pre`。
   - 未知の `product` は保持する（検証のE7で出る）。
   - ファイル内 `operators` の `id` が名前表に無い場合は2-1を飛ばして2-2へ進む（それでも決まらなければ未解決名）。
   - `author`・`planTimes`・`duration`・`drones.rule`・`description_post` など出力しない項目は無視する（報告不要）。
   - `period` の時刻は `HH:MM` にゼロ埋めして正規化して読む（Schemaは `8:00` を許し、MAA GUIは数値として比べる。文字列で比べると `"8:00" > "10:00"` が真になり誤って分割されるため、分に換算して比べる）。開始>終了の区間はそのまま保持する。
5. `report`: `{ converted: number, unresolved: string[], dropped: string[], warnings: string[] }`。`converted` は名前の延べ件数（同じ名前が複数回出れば複数回数える）。`unresolved` は重複を除いた名前。`dropped` は「プラン名・キー（例: `recycle`）・日本語の説明」を1要素にした文字列で、キー単位で1件（人名は数えない）。プランの外にある `layout` の `recycle` は「全体・recycle・…」の1件、各プランの `recycle` キーはプランごとに1件。例: `B班: recycle: 回収ステーションは未対応のため除外`。取り込み後にダイアログで表示する。

### 5.5 `core/exporter.js`

`exportPlan(project)` → JSON文字列（`JSON.stringify(obj, null, 2)` + 末尾改行、BOMなし）。

- トップ: `title`・`description`（空なら省略）・`plans`。
- プラン: `name`・`description`（空なら省略）・`period`（1件以上あれば。**開始>終了の区間（分に換算して比べる）は `[開始, "23:59"]` と `["00:00", 終了]` の2区間に分割して出す**。D11）・`Fiammetta`（`enable` が真、または既定値（`target` 空・`order` が `pre`）と異なるとき。`{enable,target,order}`。無効のまま設定を持つ状態を往復で失わないため）・`drones`（`enable` が真、または既定値と異なるとき。`{enable,room,index,order}`）・`rooms`。`duration`・`rule` は出さない。
- **人名（`operators`・`candidates`・`operatorsA`・`operatorsB`・`Fiammetta.target`）は `jpToCn` で中国語名に変換して出す。変換できない名前は原文のまま出す**（R20）。
- `rooms`: そのプランの `rooms` にキーがある施設だけ、`layout` の部屋数ぶんの配列を、施設の標準順で出力する。
  - 部屋オブジェクトには、既定値と異なる項目だけを出す: `operators`（非空のとき）、`sort`/`skip`/`autofill`（真のとき）、`candidates`（非空のとき）、`product`（設定時）、`operatorsA`/`operatorsB`（訓練室で非空のとき）。
  - 配置（`operators`/`candidates`/`operatorsA`/`operatorsB`）が空で、ほかの項目も既定値と同じ部屋は `{}`（配置の意思なし＝その部屋は現状維持。R22）。D6により、新規の制御中枢・製造所・貿易所は `sort` が真なので `{"sort":true}` で出る（これも配置の意思なしとして現状維持）。
  - 訓練室は `operatorsA`/`operatorsB`（非空のとき）と `skip`（真のとき）だけを出す（R23）。
- **エラーがあっても書き出しは止めない**（Issueの「出力は妨げない」の趣旨）。ダウンロード／コピー時にエラーがあれば、件数を示す確認を1回出す。E4（形式不正）の `period` は、分割せず原文のまま出す。確認文には「`period` が不正だとMAAがファイル全体を読み込めない」と添える（`CustomInfrastConfig.cs:98-115` は区間ごとに `TimeOnly.Parse` し、要素数が2でなければ例外にする）。取り込み時に区間の要素数が2以外でも、そのまま保持してE4にする。
- 日本語を `\u` エスケープせずそのまま出す。
- **取り込み→書き出しで失う情報は、`layout`・`operators`・`metadata`・`recycle`・グループ、`author`・`planTimes`・`duration`・`drones.rule`・`description_post`、および無効な項目（R23）のみ**。人名は中国語名のまま往復する。ただし別形態の名前（例: `阿米娅（近卫）`）は正規の中国語名（`阿米娅`）で出る（MAAのOCR置換結果と一致するので正しい）。`enable` が偽でも、`target` や `drones` の設定が既定値と異なれば出力するので、往復で失われない。**部屋数は出力しない**（`layout` を書き出さないため）。取り込み時に不足分を `{}` 相当の空の部屋で補うと、MAAの通知が「施設全体の未設定通知」から「部屋ごとの現状維持」に変わるが、交代しない点は同じ。ある施設を全プランで「編集しない」にすると、取り込み直したときその施設の部屋数は243の値に戻る（既知の制限。Issue #1 の受け入れ条件「再び取り込むと同じ内容が復元される」は「サポート対象のフィールド」の範囲と読み、部屋数はこの制限を明記する）。

### 5.6 `core/validator.js`

`validate(project, ctx, operbox)` → `Issue[]`。`Issue = { level: "error"|"warn", code, message, plan: index|null, facility?: string, room?: index }`。メッセージは日本語。

| code | レベル | 条件 |
|---|---|---|
| E1 `dup-operator` | error | 同一プランで、同じ名前が `operators` に2回以上出現（部屋をまたぐ・同一部屋内を含む）。`candidates`・`operatorsA/B` は対象外 |
| E2 `autofill-candidates` | error | `autofill` が真で `candidates` が非空（R16） |
| E3 `too-many` | error | 1部屋の `operators` が6人以上（R2のSchema上限は5） |
| E4 `period-format` | error | `period` の要素が `^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$` に合わない（Schemaのpatternと同じ）。開始>終了は日またぎとして有効（出力時に分割する） |
| E5 `drones-index` | error | `drones.enable` で、`index` が 1〜（`drones.room` の部屋数）の範囲外（R3、R4） |
| E6 `fiammetta-target` | error | `Fiammetta.enable` で `target` が空 |
| E7 `product` | error | `product` が6種（R5）以外 |
| W1 `not-owned` | warn | OperBox読み込み済みで、名前が未所持（`isOwned` が偽）。対象は `operators`・`candidates`・`operatorsA/B`・`Fiammetta.target` |
| W2 `unresolved` | warn | 名前が `jpNameSet` に無い（未解決名）。W2を出す名前には W1 を出さない |
| W3 `period-overlap` | warn | 複数のプランの `period` が重なる。日またぎは出力と同じ2区間に分けて判定する。**端点が接するだけの場合は重なりとみなさない**（連続するシフトは端点を接して書くのが正しい書き方で、警告に従って終了を `09:59` にすると、`09:59:00` 以降の隙間にプラン0が使われるため。GUIは `開始 <= 現在 <= 終了` の判定で、`plans` の並び順で最初に一致したプランが選ばれる（`FirstOrDefault`）。R21）。例: `08:00-10:00` と `10:00-12:00` は重ならない。`08:00-10:01` と `10:00-12:00` は重なる |
| W4 `capacity` | warn | `operators` の人数が施設の標準人数（R8）を超える（上限5以下の範囲で） |
| W5 `product-room` | warn | 製造所に `LMD`/`Orundum`、貿易所に製造品（`Battle Record`/`Pure Gold`/`Dualchip`/`Originium Shard`）を指定 |
| W6 `period-partial` | warn | **一部のプランにだけ `period` がある**（`ja-jp.xaml:234` の警告と同趣旨）。全プランに無い／全プランにあるときは出さない |

- 部屋数・Schemaの枠数上限（R2）は、UIが範囲を制限するため検証対象外（Issue F5 の「Schema違反」のうち、枠数以外は E3・E4・E7 とX4のajv検査が受け持つ。枠数の違反を作れるのは取り込みだけで、取り込み側が切り詰める）。取り込み時の超過は、切り詰めて `report.dropped` に記録する（§5.4）。
- 時間帯の隙間（どの区間にも当たらない時刻。GUIはプラン0を使いエラーログを出す、R21）は警告にしない。一图流の出力自体が隙間だらけ（08-10時・20-22時のみ）で、毎回出る警告は役に立たないため。
- `validate` は純関数にし、UIは結果を一覧表示して、各項目から該当のプラン・部屋へ移動できるようにする。

### 5.7a `core/model.js`

| 関数 | 動作 |
|---|---|
| `PRESETS` | §4.1 の表（243・153・252・333） |
| `createProject()` | 空のプロジェクト（`title`・`description` は空、`layout` は243、プラン1件） |
| `createPlan(layout)` | 新規プラン（§4 の既定。全9施設のキーを持ち、各施設は `layout` の部屋数ぶんの空の部屋。訓練室は1部屋） |
| `createRoom(facility)` | 新規の部屋（D6・D7の既定） |
| `applyPreset(project, name)` / `setRoomCount(project, facility, n)` | 部屋数を変え、各プランの該当配列を伸縮する（増える部屋は `createRoom`） |
| `wouldDiscard(project, facility, n)` | 縮めたときに消える部屋のうち、配置などが空でない部屋があるか（UIが確認を出す判断に使う） |
| `setFacilityEnabled(plan, facility, on)` | 施設の「編集する」の切り替え。オフで `plan.rooms` のキーを削除、オンで部屋数ぶんの `createRoom` を作る |
| `duplicatePlan` / `movePlan` / `removePlan` | プランの複製（`id` を新しくする）・並べ替え・削除。範囲外の添字はエラーにせず何もしない |

### 5.7 `core/storage.js`

- キー: `maa-infra-planner:v1`。保存内容: `{ version: 1, project, operbox }`（OperBoxは `id`・`name`・`elite`・`level`・`own`・`potential`・`rarity` のみ）。
- `createStorage(backend)` のように保存先を注入できる形にする（Node 24 には既定の `localStorage` が無く、テストで差し替えるため）。
- 読み書きは `try/catch`。失敗しても画面は動作する（localStorageが使えない環境）。
- 保存はデバウンス（300ms）。読み込み時は `version` を確かめ、不一致なら破棄して新規作成。

### 5.8 UI（`src/ui/*`、`index.template.html`、`style.css`）

画面は単一ページで、4領域: ①上部バー、②左のプラン一覧、③中央の部屋編集、④右の検証パネル。幅が狭い場合は縦に積む。ライト/ダークは `prefers-color-scheme` に従う。

| 領域 | 内容 |
|---|---|
| ① 上部バー | 「OperBoxを読み込む」「JSONを取り込む」（どちらも、ファイル選択、またはファイルをウィンドウへドラッグ&ドロップ。ドロップしたJSONが OperBox か基地スケジュールかは、配列か `plans` を持つオブジェクトかで判別する）、「基地の構成」「ダウンロード」「コピー」「新規」。タイトル・説明の入力。OperBoxの状態（件数・所持数・未読み込み）を表示 |
| ② プラン一覧 | プランの選択・追加・複製・削除・↑↓。選択中のプランの名前・説明・`period`（追加/削除、`HH:MM` 入力。開始>終了の日またぎも入力でき、「出力時に2区間へ分割される」と表示する）・フィアメッタ・ドローンのフォーム。プランごとに、各施設の「編集する」のオン/オフ（オフ＝このプランではキーを出さない）。ドローンの施設番号は、選んだ施設の部屋数ぶんの選択肢 |
| ③ 部屋編集 | 施設ごとのカード。部屋ごとに配置のチップ列（↑↓で並べ替え、✕で削除）、「＋追加」で共有の選択ダイアログ（`<dialog>`）を開く。`sort`/`skip`/`autofill` のチェック、製造所・貿易所は `product`、`candidates`（チップ列）。訓練室は `skip` と `operatorsA`/`operatorsB` だけを出す（R23）。`autofill` が真のとき `candidates` は無効化して表示 |
| ④ 検証パネル | `validate` の結果。エラー→警告の順。クリックで該当のプラン・部屋にスクロール。件数のバッジ |

- **選択ダイアログ**: 検索ボックス（部分一致）、「所持のみ」（OperBox読み込み済みのとき既定オン）、レアリティの絞り込み。各行に名前・★・昇進・レベル。選択済みのオペレーター（同一プランの他の部屋）は薄く表示する。選択肢は、名前表の日本語名（`jpAvailable`）とOperBoxの和集合にする。OperBoxの情報（昇進・レベル・所持）は結合して表示し、OperBoxに無い名前（名前表だけにある予備隊員系など）は「未所持」バッジ付きで選べる（W1）。OperBox未読み込みのときは、所持の表示をしない。
- **基地の構成ダイアログ**: プリセット選択、製造所・貿易所・発電所の数（全プラン共通）。
- **取り込みダイアログ**: 取り込み結果（変換N件・未解決名の一覧・除外した項目）を表示して確定。取り込みは現在のプロジェクトを置き換えるため、確認を出す。
- **アクセシビリティ**: アイコンだけのボタン（✕、↑、↓）に `aria-label` を付ける（00 項目9）。
- **日本語**: 画面文言はすべて日本語。識別子は英語。施設の表示名は MAA GUI の日本語表記に合わせる（`ja-jp.xaml:168-172` ほか。`meeting`=応接室、`hire`=事務室。ほかは実装時に同ファイルで確かめる）。
- 外部のフォント・スクリプトは使わない。

### 5.9 `tools/build.mjs`

1. `esbuild` で `src/ui/main.js` を1つのスクリプトにバンドル（minifyなし、IIFE）。
2. `src/index.template.html` の `<!-- STYLE -->`・`<!-- NAMES -->`・`<!-- SCRIPT -->` を、`style.css`・`data/names.json`（`<script type="application/json" id="names">`）・バンドルで置き換え、`dist/maa-infra-planner.html` に書く。**置換は `String.prototype.replace` に文字列ではなく関数を渡す**（置換文字列中の `$&`・`$'` が展開されるため）。埋め込むJSONとバンドルに含まれる `</script>` は `<\/script>` にエスケープする。
3. `<script src=`・`<link href=` に `http://`・`https://` が含まれたら失敗させる（文字列中のURLでは失敗させない）。

`package.json` は `"type": "module"`（ESMの `.js` を使うため）。scripts: `build`、`test`（`node --test`。Node 24 では `node --test tests/` が `Cannot find module` で失敗するため、ディレクトリを渡さない）、`names`（`python -I tools/build_name_table.py ...`）。

## 6. 設計判断（採用・理由・不採用）

| # | 判断 | 理由 | 不採用 |
|---|---|---|---|
| D1 | 状態には日本語名の文字列だけを持つ。出力時に中国語名へ変換する（D10） | 画面は日本語。名前表の範囲で日本語名↔中国語名は1対1（R20）なので、往復で名前が変わらない。IDは変換時のみで足りる | IDで保持し出力時に引く: 未解決名（原文のまま保持）が表せない |
| D2 | 未解決名は原文のまま保持し、検証でW2警告にする | Issueの「出力は妨げない」 | 変換不能な名前を捨てる: 黙って内容が消える |
| D3 | 出力は既定値と同じ項目を省略する | MAAのコアの既定と一致（R6）。JSONが読みやすい | 全項目を常に出す: 冗長。一图流は出すが、動作は同じ |
| D4 | 空の部屋は `{}` で出す | 配列が実際の部屋数より短いと、未設定の最初の部屋以降が交代されず、施設全体の未設定通知が出る（R22）。`{}` なら、その部屋だけが「配置の意思なし」として現状維持になる（部屋ごとの現状維持ログは出る） | 空の部屋を省く: 施設全体の未設定通知が出る |
| D5 | 「編集する施設」はプランごとに持つ。編集しない施設はキー自体を出さない | キー無し＝MAAのデフォルトアルゴリズム（R22）。一图流の出力はプランごとにキー有無が違い、ファイル全体で持つと取り込み→書き出しでキーが増えて動作が変わる | ファイル全体で持つ（`layout` から決める）: 黙って動作が変わる。`[]`（現状維持）: 要件外（v1では出さない） |
| D6 | 新規の部屋の `sort` 既定は、制御中枢・製造所・貿易所=真、それ以外=偽 | Issue #1の既定値。一图流の出力に合わせる（R10） | 全て偽（コアの既定、R6）: 並び順の指定が効かず、意図とずれやすい |
| D7 | 宿舎は `autofill: true` を既定とする | Issue #1の既定値。一图流の出力に合わせる（R10） | 空: 宿舎が変更されない |
| D8 | 取り込み時の名前の変換は「ファイル内 `operators` のID → 名前表の中国語名 → 日本語名として既知」の順 | IDが最も確実。次に名前表。最後は日本語名を直接書いたJSON | 名前表を先に引く順: 結果は同じ（別形態の名前は名前表に無く、次の段のファイル内 `operators` で解決する）なので、IDを最優先にする理由は「同名で別IDのとき最も確実」という点だけ |
| D9 | `dist/maa-infra-planner.html` をgitで管理する | ユーザーはビルド環境なしで開ける。名前表の再生成後に `npm run build` で更新 | 管理しない: ユーザーがNodeを要する |
| D10 | 人名は**中国語名で出力**する。出力を日本語名にするオプションは設けない | MAAは日本版でも中国語名で照合する（R20、実機確認済み）。日本語名で出すと照合に失敗する見込み | 日本語名／中国語名の切り替え: 日本語名で動く根拠がなく、不要なUIが増える |
| D11 | 日またぎの `period`（開始>終了）は、画面では1区間として入力でき、**出力時に2区間へ自動分割**する | MAA GUIは日またぎを扱えない（R21）。ユーザーが分割を意識せずに済む。分割後の終端は `23:59`（公式ドキュメントの例どおり。GUIの `now <= 23:59` は秒込みなので、`23:59:00` を過ぎた時点から翌日の `00:00` まではどの区間にも当たらないが、許容する） | 日またぎを警告・エラーにする: 入力が不便。取り込み時に区間を再結合する: 往復で変わらないので不要（分割済みの区間はそのまま保持） |

## 7. テスト方針

配置: `tests/*.test.js`、フィクスチャは `tests/fixtures/`。`node --test` で実行。ロジックは `src/core/` に集約し、DOMなしで全て検証できる構造にする。

### 7.1 単体テスト（観点）

| ID | 対象 | 観点 |
|---|---|---|
| N1 | `build_name_table.py` / `names.js`（Pythonは `node --test` から実行せず、生成済みの `data/names.json` だけを検証する） | `char_` のみ（`trap_`/`token_` が混ざらない）。`jpAvailable` が偽のものは `cnToJp` が `null`。件数は固定値で比べず、`source` と組で記録する（件数の目安: `char_` 463、`jpAvailable` 偽17。再生成で変わりうる） |
| N2 | `names.js` | **R14の検証**: 中国語名が重複するIDの組で、`name_jp` がすべて同一 |
| N3 | `names.js` | `阿米娅` → `アーミヤ`、`凯尔希` → `ケルシー` |
| N5 | `names.js` | 「Aの中国語名 = Bの日本語名」となる衝突が0件（AとBで「（中国語名, 日本語名）の組」が異なるものに限る。`Sharp` のようにIDが違っても名前の組が同じものは衝突ではない）。日本語名↔中国語名が1対1（`jpAvailable` が真の範囲）。0件でなければ、一覧を結果に出力し、計画に戻して判断する（R20で現時点0件を確認済み） |
| N6 | `names.js` | `jpToCn`: `アーミヤ`→`阿米娅`、`ケルシー`→`凯尔希`。`jpAvailable` が偽・未知の名前は `null` |
| O1 | `operbox.js` | BOM付き入力を読める。配列でない・必須キー欠落でエラー |
| O2 | `operbox.js` | `name` がアーミヤの要素が無いときだけ補完される（`char_1037_amiya3` があれば補完しない）。`isOwned` はIDの重複を考慮（`idsByJp` のどれかが所持なら真）。未読み込みは `null` |
| I1 | `importer.js` | 中国語JSON（フィクスチャ）の人名が日本語に変換される。`Fiammetta.target` も変換。`report.converted` は名前の延べ件数 |
| I1b | `importer.js` | 拡張 `operators` が配列形（2.0）でもIDキーのオブジェクト形（1.0）でも同じ結果になる。`operators` の `id` が名前表に無い要素は2-2へ進む |
| I2 | `importer.js` | `layout` から部屋数が設定される。`recycle` は除外され `dropped` に載る。9部屋超・宿舎5部屋は切り詰めて `dropped` に載る |
| I2b | `importer.js` | **施設の有無はプランごと**: `processing`・`training` が片方のプランにだけあるJSON（参考ファイル `(1)` の最小版）で、B班に両キーが現れず、A班にだけある。書き出しでも同じ |
| I3 | `importer.js` | `layout` が無いJSONは、`rooms` の配列長から部屋数が決まる。どのプランにもキーが無い施設は243の部屋数になる |
| I4 | `importer.js` | `groups` と `use_operator_groups: true` が `dropped` に載り、部屋の `operators` が空になる |
| I5 | `importer.js` | 未解決名が原文のまま残り `unresolved` に載る |
| I6 | `importer.js` | 日本語JSON／本ツールの出力の再取り込みで、`import(x)` と `import(export(import(x)))` の `project`（`id` を除く）が深い比較で等しい |
| I7 | `importer.js` | `drones.room` が無い／不正（`manufacturing`）で `enable` が偽・`room` が `trading` になり `warnings` に載る（書き出しがSchemaに適合する）。`enable` が無いと真。未知の施設キーが `warnings` に載る。部屋数より短い配列は全項目が偽の部屋で補われる（宿舎で `autofill` が偽のまま）。訓練室の無効な項目が無視される。`Fiammetta.order`・`drones.order` が無いと `pre` |
| B1 | `tools/build.mjs` | 埋め込み内容に `</script>` と `$&` を含むデータで、出力が壊れない。`<script src="https://...">` があると失敗する |
| X1 | `exporter.js` | 既定値は省略。配置が空で既定値だけの部屋は `{}`、新規の製造所は `{"sort":true}`（D6）。キーを持たない施設はキー無し。キー順が標準順。訓練室は `skip` と `operatorsA/B` だけ |
| X2b | `exporter.js` | `Fiammetta`/`drones` が `enable:false` でも既定値と異なれば出る。異なる値がなければ出ない |
| X2 | `exporter.js` | 中国語名が `\u` エスケープされない。BOMなし。インデント2。`Fiammetta`/`drones` は §5.5 の出力条件どおり（無効で既定値のままなら出ない） |
| X5 | `exporter.js` | **人名が中国語名で出る**: `ケルシー`→`凯尔希`（`operators`・`candidates`・`operatorsA/B`・`Fiammetta.target`）。未解決名は原文のまま |
| X6 | `exporter.js` | **日またぎの分割**: `["22:00","02:00"]` → `["22:00","23:59"]`・`["00:00","02:00"]`。`["08:00","10:00"]` と `["8:00","10:00"]`（取り込み時に `08:00` へ正規化）は分割されない。形式不正（E4）の `period` は分割せず原文のまま出る |
| X7 | `exporter.js` + `importer.js` | **状態の往復**: 状態 `s` について `import(export(s))` が `s` と等しい（`id` を除く）。`s` には、`enable:false` でも `target` や `drones.room/index/order` を持つ状態、日本語名、全施設のキーを持つプランを使う。部屋数が243と異なる施設は、その施設のキーを持つプランが1つ以上あるときだけ対象にする。日またぎの `period` を含む状態は2区間に分かれるので対象外（X6で別に確かめる） |
| X3 | `exporter.js` | **ラウンドトリップ（不動点）**: `export(import(x))` を `y` とすると、`export(import(y))` が `y` と文字列で一致する。`x` には、日またぎの `period`・`Fiammetta.enable:false`・部屋数より短い配列・別形態名（`阿米娅（近卫）`）を含むものも使う |
| X4 | `exporter.js` + ajv | 出力が `schema/maa-infra.schema.json` に適合する（検証エラー0件のフィクスチャ全件。E4・E7を含むフィクスチャは対象外） |
| V1〜V7 | `validator.js` | E1〜E7 を、それぞれ「出る」「出ない」の2ケース以上 |
| V8〜V13 | `validator.js` | W1〜W6 を同様に。W3は日またぎ（`22:00-02:00` と `01:00-05:00` が重なる、`22:00-02:00` と `03:00-05:00` は重ならない）と端点の接触（`08:00-10:00` と `10:00-12:00` は重ならない、`08:00-10:01` と `10:00-12:00` は重なる）、W6は「全プランに無し」「全プランにあり」で出ない。W2を出す名前にW1が出ない |
| M1 | `model.js` | プリセット適用で部屋数が変わる。増えた部屋は D6・D7 の既定。縮めて空でない部屋が消えるとき `wouldDiscard` が真。`createPlan` が全9施設のキーを持つ。プランの複製で `id` が変わる。範囲外の添字は何もしない。施設をオフにするとキーが消え、オンに戻すと既定の部屋ができる |
| S1 | `storage.js` | `localStorage` が例外を投げても落ちない。`version` 不一致は破棄。保存→復元で `project`・`operbox` が等しい |

### 7.2 手計算で検算する期待値（00 項目18①）

フィクスチャ `tests/fixtures/cn-243-min.json` は、新しい参考ファイル `(1)` から次の部分だけを抜いた最小版とする（I2b で、A班にだけ加工所・訓練室がある形を使う）。

フィクスチャには、参考ファイルと同じ形で `operators`（`{id, name}` の一覧）も含める（含めないと §5.4 手順2-1の経路をテストできない）。

| プラン | 部屋 | 中国語名 | 期待する日本語名 | 導出元ID |
|---|---|---|---|---|
| B班 | 制御中枢 | 凯尔希 | ケルシー | `char_003_kalts` |
| B班 | 応接室 | 陈, 红 | チェン, レッド | `char_010_chen`, `char_144_red`（OperBoxの `name` も `name_jp` も「レッド」） |
| A班 | 制御中枢 | 阿米娅 | アーミヤ | `char_002_amiya`（OperBoxに無い。名前表から。OperBoxには `char_1037_amiya3` があるので補完行は作らない） |

書き出すと、人名はそれぞれ元の中国語名に戻る（X5）。

### 7.3 実データでの結合テスト

`tests/real-data.test.js`。環境変数 `MAA_OPERBOX`・`MAA_REF_JSON` にパスがあるときだけ実行する（無ければスキップ）。確認すること:

1. OperBoxが415件、所持408。OperBoxの全 `name` が名前表の `name_jp` と一致する。
2. 参考ファイル `(1)` を取り込むと、**回収ステーションを除いたプラン内の63名（`Fiammetta.target` を含む）がすべて名前表で日本語名に変換され、未解決名0件**。回収ステーション（4名）は、プランごとの `recycle` として `dropped` に載る。
3. 取り込んだまま書き出したJSONがSchemaに適合し、**人名が元の中国語名に戻り**、A班にだけ `processing`・`training` がある（I2b）。W1（未所持）が0件（アーミヤは `char_1037_amiya3` で所持）。

## 8. 品質管理

- `npm test` が全件成功。`npm run build` が警告なしで完了し、外部参照を含まない。
- ブラウザで `dist\maa-infra-planner.html` を開き、コンソールにエラー・警告が出ない。
- `git diff --cached --stat` で、行数が意図した変更量と合うことを確かめる（改行コードの混入を防ぐ。02 項目10）。
- 診断用のログ・暫定コードを残さない（00 項目27）。PR作成前に棚卸しする。

## 9. コーディング上の注意

- `code-naming`・`code-comments` スキルに従う。コードにHow、テストにWhat、コミットログにWhy、コードコメントにWhy not。
- 「見つからない」を暗黙の最小値にしない（00 項目16）: `indexOf` の戻り値を直接使わない。プラン・部屋が無い場合の扱いをテストに含める。
- 完全一致が必要な値（出力する中国語名）は、名前表から引いた後に加工しない（`trim` や正規化をしない。00 項目34）。理由をコメントに書く: MAAがOCR結果を中国語名に置換した文字列と完全一致で照合するため（R20）。
- 新しい種類のファイルは既存の同種ファイルをコピーしてから編集する（00 項目10）。新規プロジェクトで該当が無ければ不要。

## 10. 動作確認の手順（ユーザーが行う）

1. `npm run build` で `dist\maa-infra-planner.html` を生成し、**そのフォルダ（`C:\Users\owner\source\repos\maa-infra-planner\dist\`）を開いてから依頼する**（00 項目32）。
2. `maa-infra-planner.html` をダブルクリックで開く。
3. 「OperBoxを読み込む」で `C:\MAA\Arknights_OperBox_Export.json` を選ぶ。415件・所持408件と表示される。
4. 「JSONを取り込む」で `C:\Users\owner\Downloads\一图流-243-一天两换-MAA (1).json` を選ぶ。取り込み結果が「未解決名0」になる。ケルシー・アーミヤなどが日本語で表示され、A班だけに加工所・訓練室がある。
5. 部屋のオペレーターを1人入れ替え、検証パネルに警告・エラーが出ないことを確かめる。
6. 「ダウンロード」でJSONを保存する。
7. 画面でプランの区間を編集する（現在時刻を `T` とする）。B班の区間を `T` の1時間前から1時間後にし、A班の区間は `T` を含まない時間帯にする（例: T=21:00 なら B班 `20:00`-`22:00`、A班 `08:00`-`10:00`）。さらに、日またぎの確認のため、A班の区間を `22:00`-`02:00` のような日またぎにする（`T` を含まず、B班と重ならない値にする）。参考ファイルの区間は `08:00-10:00`・`20:00-22:00` だけで、それ以外の時刻だとどのプランにも当たらず、一部のプランにだけ時間帯がある旨の警告と同じ文言のエラーがMAAのログに出る。既存の `...-2120切替.json` と同じ方法。編集後に手順6を行う。
8. MAAを起動し、「インフラモード」→「カスタムされた基地構成」→「基地構成ファイルの指定」で、保存したJSONを選ぶ。プランが読み込まれ、`period` の時間帯が表示される（手順7で入力した日またぎの区間は2区間に分かれている）。保存したJSONの人名は**中国語名**になっている（R20）。プラン選択に「時間ローテーション（プラン名）」が出て、現在時刻に対応するプラン名が表示される（R21、21:20の確認と同じ方法）。
9. 基地を開いた状態で実行し、現在時刻に対応するプランの配置になることを確認する。B班の貿易所の `ヘドリー`（`赫德雷`）が配置されることも確かめる（R20の仮説の確認。配置されない場合は、実装を変えず別Issueに切り出して扱いを決める。00 項目36）。

## 11. 実装手順（推奨順）

0. （ユーザーの確認の上）ローカルの `main` に文書（`CONTEXT.md`・`docs/`・`design-docs-for-ai/`・`user-prompt/`）を初期コミットし、remote を設定して GitHub の `5cd8/maa-infra-planner` へ push し、`main` を作る。その後 `feature/issue-1-base-schedule-planner` を切る（GitHub側は空でデフォルトブランチが無いため、この手順が要る）。
1. `package.json`・`.gitignore`（`node_modules/`）・`tools/build_name_table.py` → `data/names.json` を生成し、N1（データの性質）を通す。
2. `core/names.js`・`core/operbox.js` とテスト（N1の残り・N2・N3・N5・N6、O1・O2）。
3. `core/model.js`（§5.7a）・`core/exporter.js` とテスト（M1、X1・X2・X5・X6）。
4. `core/importer.js` とテスト（I1〜I7、I2b、X3、X4、X7）。
5. `core/validator.js` とテスト（V1〜V13）。
6. `core/storage.js` とテスト（S1）。
7. `tools/build.mjs` とテスト（B1）、UI（`src/ui/*`）。ブラウザで §10 の手順1〜6を自分でも確かめる。
8. `README.md`（使い方、名前表の更新手順、Schemaの出典コミット、出典（MAA v6.20.1 `d94dd00`）とそのライセンスへの言及）。
9. セルフレビュー3回（00 項目17・18の①〜③）。

## 12. Issue #1 への反映事項（計画作成中に判明）

以下は Issue 本文に反映済み（背景・入力データ・F3・F5・F6・受け入れ条件・施設の表示名。W3の端点・書き出し時の確認・部屋数の制限は2026-10-31にユーザーが承認）。

- **人名は中国語名で出力する**（R20、実機確認済み）。画面は日本語名。取り込みは中国語名・日本語名の両方を受け、画面では日本語名にする。
- F3: 日またぎの `period` は、画面では1区間で入力でき、出力時に2区間へ自動分割する（R21）。
- F5: W3は端点が接するだけなら重なりとしない（R21）。W6（`period` の一部のみ設定）を追加済み。
- 施設の「編集する」はプランごと（R22）。
- 取り込み時に未対応のグループを黙って落とさず、`dropped` として報告する（§5.4）。
- エラーがあっても書き出しは止めず、確認を1回出す（§5.5。F6に記載）。
- 部屋数は出力されないため、再取り込みで部屋数が復元されない場合がある（§5.5の既知の制限。Issueの受け入れ条件の読み方）。
- 受け入れ条件: 参考ファイル `(1)` を取り込み、回収ステーションを除く63名が日本語名に変換される。書き出すと人名が元の中国語名に戻る。
- 非ゴールの「`period` による自動切り替え」を、「ツールでは実装しない（MAA GUIが行う）」と明記する。
