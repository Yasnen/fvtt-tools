# pack-to-json

## 概要

NeDB 形式（`.db`）の Foundry VTT パックファイルを個別の JSON ファイルに変換する。
各ドキュメントを `<name>_<_id>.json` 形式で出力する。

## 使い方

```bash
fvtt-tools pack-to-json <pack.db> [オプション]
```

## オプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--out <dir>` | `./<pack名>/` | 出力ディレクトリ |
| `--indent <n>` | `2` | JSON インデント幅 |

## 対象フォーマット

NeDB 形式（`.db` ファイル）のみ対応。1行1ドキュメントの NDJSON 形式。

LevelDB 形式（Foundry VTT v11 以降のデフォルト）には未対応。
LevelDB パックは `@foundryvtt/foundryvtt-cli` の `fvtt package unpack` を使うこと。

## 使用例

```bash
# デフォルト出力先（./macros/）へ展開
fvtt-tools pack-to-json packs/macros.db

# 出力先を指定
fvtt-tools pack-to-json packs/items.db --out src/packs/items
```

## 出力ファイル名

`<name>_<_id>.json` 形式。`name` に `/` `\` `*` `:` `|` `"` `<` `>` `?` が含まれる場合は `_` に置換する。

## NeDB 形式について

Foundry VTT v10 以前の標準パック形式。各行が独立した JSON ドキュメントであり、
NeDB が内部で管理する削除マーカー（`$$deleted: true`）行はスキップされる。

v11 以降で LevelDB に移行したモジュールには使用できない。
