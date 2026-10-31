# maa-infra-planner

MAA（MaaAssistantArknights）の「基地スケジュールJSON」を、日本語の画面で作る個人用ツールです。
単一のHTMLファイルで動き、データはブラウザの中だけで処理します（外部への通信はありません）。

- 画面の人名は日本語名、**出力するJSONの人名は簡体字中国語名**です。MAAは日本版でも中国語名で照合します（実機で確認済み）。
- 一图流が出す中国語版JSONも、日本語名で書いたJSONも取り込めます。
- 要件は [Issue #1](https://github.com/5cd8/maa-infra-planner/issues/1)、用語は [CONTEXT.md](CONTEXT.md)、判断理由は [docs/adr/](docs/adr/) を参照してください。

## 使い方

1. `dist/maa-infra-planner.html` をブラウザで開く（ダブルクリック）。
2. 「OperBoxを読み込む」で、MAAの「オペレーター認識」が出力したOperBox JSONを選ぶ（任意。所持の確認と選択ダイアログの絞り込みに使う）。
3. 「JSONを取り込む」で既存のJSONを取り込むか、そのままプランを作る。
4. 「ダウンロード」または「コピー」でJSONを出力する。
5. MAAの「インフラモード」→「カスタムされた基地構成」→「基地構成ファイルの指定」で読み込む。

JSONファイルは、ウィンドウへドラッグ&ドロップしても読み込めます。

## 開発

Node.js 24 以降が必要です。

```bash
npm install
npm test          # 全テスト（node --test）
npm run build     # dist/maa-infra-planner.html を生成
```

実データでの結合テスト（`tests/real-data.test.js`）は、環境変数にパスを指定したときだけ実行されます。

```bash
MAA_OPERBOX='C:\MAA\Arknights_OperBox_Export.json' MAA_REF_JSON='<一图流のJSON>' npm test
```

### 名前表の更新

`data/names.json` は MAA の `resource/battle_data.json` から生成します。MAAの更新で新しいオペレーターが増えたら再生成し、`npm run build` で `dist` を更新します。

```bash
python -I tools/build_name_table.py <MAAのクローン>/resource/battle_data.json --source "MAA v6.20.1 d94dd00"
npm test
npm run build
```

`--source` には、MAAのバージョンとコミットを書きます。N5（日本語名と中国語名の衝突）のテストが失敗したら、一覧を確認して計画に戻って判断します。

## 出典

- 名前表: [MaaAssistantArknights](https://github.com/MaaAssistantArknights/MaaAssistantArknights) v6.20.1（コミット `d94dd00`）の `resource/battle_data.json`。MAAは AGPL-3.0 で公開されています。名前表はそこから抜き出したデータで、ライセンスの扱いはMAA本体に従います。
- Schema: `schema/maa-infra.schema.json` は、同じコミットの `docs/maa-infra.schema.json` の複製です。テストでの出力検証にだけ使います。
