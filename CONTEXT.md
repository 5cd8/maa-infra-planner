# CONTEXT: maa-infra-planner の用語

アークナイツ支援ツール MAA(MaaAssistantArknights)の「基地スケジュールJSON」を、日本語で作る個人用ツール。
用語は MAA 公式の `base-scheduling-schema` に合わせ、日本語名を併記する。

| 用語 | 意味 |
|---|---|
| 基地スケジュールJSON | MAA に読み込ませる設定ファイル。`title`・`description`・`plans[]` を持つ。本ツールの最終成果物 |
| プラン(シフト) | `plans[]` の1要素。時間帯(`period`)ごとの配置一式。「早朝組」「夜組」など |
| 部屋(施設) | `rooms` のキー。`control`(制御中枢)・`manufacture`(製造所)・`trading`(貿易所)・`power`(発電所)・`meeting`(応接室)・`hire`(事務室)・`dormitory`(宿舎)・`processing`(加工所)・`training`(訓練室)。`recycle`(回収ステーション)は日本版未実装のため扱わない |
| 配置 | 部屋の `operators`(上から優先)。`candidates`(候補)・`autofill`(自動配置)・`sort`・`skip` で補う |
| レイアウト | 基地の部屋構成(製造所・貿易所・発電所の数)。243・153・252・333 などのプリセットがある |
| OperBox | MAA の「オペレーター認識」が出力する所持オペレーター一覧JSON(`id`・`name`・`elite`・`level`・`own`・`potential`・`rarity`)。UTF-8 BOM付き。`char_002_amiya` は含まれないが、アーミヤの別形態 `char_1037_amiya3`(名前 アーミヤ)は含まれる(2026-10-31 時点の実データ) |
| 名前表 | 本ツールが同梱する `id`・中国語名・日本語名・レア度の対応表。MAA の `resource/battle_data.json` から生成する。日本語名↔中国語名は1対1 |
| 取り込み | 既存のJSON(特に一图流が出す中国語版)を読み込み、日本語名に変換して編集画面に展開すること。書き出しでは中国語名に戻す |
| 未解決名 | 取り込みで日本語名に変換できなかった名前。警告として表示する |
| 一图流 | 中国語の基地スケジュール生成ツール(https://ark.yituliu.cn/tools/scheduleV3)。出力JSONに `layout`・`operators`・`metadata` の拡張フィールドを含む |

オペレーター名は、**日本版でも簡体字中国語名で書く**。MAA が OCR で読んだ日本語名を中国語名に置き換えてから照合するため(実機で確認済み、2026-10-31)。本ツールは画面を日本語名、出力を中国語名にする。
