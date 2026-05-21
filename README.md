# @yasnen/fvtt-tools

Foundry VTT モジュール開発・ローカライズ向け CLI ツール集。

外部依存ゼロ、Node.js 20+ の標準モジュールのみで動作。

## インストール

GitHub リポジトリから直接インストール:

```bash
npm install --save-dev github:Yasnen/fvtt-tools
```

または `package.json` に手動で追加:

```json
{
  "devDependencies": {
    "@yasnen/fvtt-tools": "github:Yasnen/fvtt-tools"
  }
}
```

## コマンド一覧

| コマンド | 説明 | 詳細 |
|---------|------|------|
| `sync-lang` | 上流 en.json と翻訳ファイルを三方向マージで同期 | [→](docs/commands/sync-lang.md) |
| `i18n-diff` | 言語ファイルの差分比較・cherry-pick 可否判定 | [→](docs/commands/i18n-diff.md) |
| `report` | 翻訳カバレッジをレポート表示 | [→](docs/commands/report.md) |
| `validate` | Babele 辞書 JSON の構造チェック | [→](docs/commands/validate.md) |
| `placeholder-list` | 翻訳ファイル内のプレースホルダを一覧表示 | [→](docs/commands/placeholder-list.md) |
| `fix-pack-names` | fvtt unpack 後の非 ASCII ファイル名を修正 | [→](docs/commands/fix-pack-names.md) |
| `pack-to-json` | モジュール/システムの全 pack を JSON ファイルに変換 | [→](docs/commands/pack-to-json.md) |

---

### `sync-lang`

```
fvtt-tools sync-lang <新en.json> [オプション]

  --base <path>          旧 en.json             (デフォルト: lang/en-base.json)
  --ja   <path>          翻訳ファイル           (デフォルト: lang/ja.json)
  --out  <path>          出力先                 (デフォルト: --ja と同じ)
  --extra-marker <key>      extra セクション開始マーカーキー
  --extra-prefix <pfx>      ORPHAN 除外プレフィックス（カンマ区切り）
  --placeholder-sep <str>   プレースホルダの数字前文字列 (デフォルト: ".")
  --placeholder-mark <str>  プレースホルダの囲み文字列   (デフォルト: "===")
  --placeholder-digits <n>  連番の桁数                  (デフォルト: 3)
  --dry-run                 差分のみ表示
  --update-base             同期後に en-base.json を更新
```

```bash
fvtt-tools sync-lang /path/to/en.json --dry-run
```

[詳細 →](docs/commands/sync-lang.md)

---

### `i18n-diff`

```
fvtt-tools i18n-diff --from <path> --to <path> [オプション]

  --from  <path>   比較元リポジトリルートパス  [必須]
  --to    <path>   比較先リポジトリルートパス  [必須]
  --lang  <file>   言語ファイルの相対パス      (デフォルト: lang/ja.json)
  --limit <n>      対象コミット数              (デフォルト: 20)
  --diff-only      差分レポートのみ表示
```

```bash
fvtt-tools i18n-diff --from ../branch-a --to ../branch-b
```

[詳細・worktree ワークフロー →](docs/commands/i18n-diff.md)

---

### `report`

```
fvtt-tools report [オプション]

  --ja           <path>    翻訳ファイル    (デフォルト: lang/ja.json)
  --base         <path>    上流 en.json   (デフォルト: lang/en-base.json)
  --extra-prefix <prefix>  集計除外プレフィックス
```

```bash
fvtt-tools report --ja lang/wfrp4e-ja.json --base lang/en-base.json
```

[詳細 →](docs/commands/report.md)

---

### `validate`

```
fvtt-tools validate <path> [<path> ...]
```

JSON 構文・`label`・`entries`/`mapping` の有無などを検証。エラー時は exit code 1。

```bash
fvtt-tools validate compendium/
```

[詳細 →](docs/commands/validate.md)

---

### `placeholder-list`

```
fvtt-tools placeholder-list [オプション]

  --ja    <path>  翻訳ファイル    (デフォルト: lang/ja.json)
  --base  <path>  上流 en.json   (省略時: 英語値を非表示)
```

```bash
fvtt-tools placeholder-list --ja lang/wfrp4e-ja.json --base lang/en-base.json
```

[詳細 →](docs/commands/placeholder-list.md)

---

### `fix-pack-names`

```
fvtt-tools fix-pack-names <directory>
```

```bash
fvtt-tools fix-pack-names src/packs/macros
```

[詳細 →](docs/commands/fix-pack-names.md)

---

### `pack-to-json`

```
fvtt-tools pack-to-json <module-dir> [オプション]

  --out <dir>      出力ベースディレクトリ (デフォルト: カレント)
  --merge          各 pack を <moduleId>_<packName>.json にまとめる
  --clean          出力先を先にクリア
  --folders        フォルダ構造を再現 (--merge と併用不可)
  --omit-volatile  volatile フィールドを除外
  --yaml           YAML で出力 (--merge と併用不可)
```

`module.json`/`system.json` を読み取り全 packs を一括処理。`@foundryvtt/foundryvtt-cli` の `extractPack` API を使用（要インストール）。

出力名: `<moduleId>_<packName>/`（通常）または `<moduleId>_<packName>.json`（`--merge`）

```bash
fvtt-tools pack-to-json ~/foundry/data/modules/wfrp4e-core --out ~/tmp
fvtt-tools pack-to-json ~/foundry/data/modules/wfrp4e-core --out ~/tmp --merge
```

[詳細 →](docs/commands/pack-to-json.md)

---

## ライセンス

MIT
