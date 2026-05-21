# pack-to-json

## 概要

Foundry VTT モジュール/システムの全 LevelDB パックを JSON ファイルに変換する。
`module.json` または `system.json` を読み取り、定義された全 `packs` を一括処理する。
`@foundryvtt/foundryvtt-cli` の `extractPack` Node.js API を内部で使用する。

## 使い方

```bash
fvtt-tools pack-to-json <module-dir> [オプション]
```

`<module-dir>` は `module.json` または `system.json` が置かれたモジュール/システムのルートディレクトリ。

## 前提条件

プロジェクトに `@foundryvtt/foundryvtt-cli` がインストールされていること:

```bash
npm install --save-dev @foundryvtt/foundryvtt-cli
```

## オプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--out <dir>` | カレントディレクトリ | 出力ベースディレクトリ |
| `--merge` | — | 各 pack を `<moduleId>_<packName>.json` 一ファイルにまとめる |
| `--clean` | — | 出力先を先にクリアしてから展開（`--merge` 時は常に上書きのため効果なし） |
| `--folders` | — | フォルダ構造を再現する（`--merge` と併用不可） |
| `--omit-volatile` | — | volatile フィールド（`_stats` 等）を除外 |
| `--yaml` | — | JSON の代わりに YAML で出力（`--merge` と併用不可） |

## 出力命名規則

| モード | 出力先 |
|--------|--------|
| 通常 | `<out>/<moduleId>_<packName>/` |
| `--merge` | `<out>/<moduleId>_<packName>.json` |

## 使用例

```bash
# 全 pack を個別 JSON ファイルに展開
fvtt-tools pack-to-json ~/foundry/data/modules/wfrp4e-core --out ~/tmp

# 全 pack を各 JSON ファイル（pack 情報付き）にまとめる
fvtt-tools pack-to-json ~/foundry/data/modules/wfrp4e-core --out ~/tmp --merge

# システムも同様に処理可能
fvtt-tools pack-to-json ~/foundry/data/systems/wfrp4e --omit-volatile --clean

# volatile フィールドを除外してクリーン出力
fvtt-tools pack-to-json ~/foundry/data/modules/wfrp4e-core --out src/packs --omit-volatile --clean
```

## npm scripts との組み合わせ

```json
{
  "scripts": {
    "unpack": "fvtt-tools pack-to-json ~/foundry/data/modules/wfrp4e-core --out src/packs --clean"
  }
}
```

## `--merge` 時の出力形式

```json
{
  "moduleId": "wfrp4e-core",
  "name":     "items",
  "label":    "Items",
  "type":     "Item",
  "path":     "packs/items",
  "count":    123,
  "entries":  [ ... ]
}
```

## volatile フィールドについて

`--omit-volatile` を指定すると `_stats`（作成・更新時刻など）が出力から除外される。
ソース管理での不要な差分を防ぎたい場合に有効。
