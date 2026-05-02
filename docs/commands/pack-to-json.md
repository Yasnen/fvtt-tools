# pack-to-json

## 概要

Foundry VTT の LevelDB パックを個別の JSON ファイルに変換する。
`@foundryvtt/foundryvtt-cli` の `extractPack` Node.js API を内部で使用する。

## 使い方

```bash
fvtt-tools pack-to-json <pack-dir> [オプション]
```

`<pack-dir>` は LevelDB パックのディレクトリパス（`packs/macros` など）。

## 前提条件

プロジェクトに `@foundryvtt/foundryvtt-cli` がインストールされていること:

```bash
npm install --save-dev @foundryvtt/foundryvtt-cli
```

## オプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--out <dir>` | `./<pack名>/` | 出力ディレクトリ |
| `--clean` | — | 出力先を先にクリアしてから展開 |
| `--folders` | — | フォルダ構造を再現する |
| `--omit-volatile` | — | volatile フィールド（`_stats` 等）を除外 |
| `--yaml` | — | JSON の代わりに YAML で出力 |

## 使用例

```bash
# 基本
fvtt-tools pack-to-json packs/macros

# 出力先指定・クリーンアップ付き
fvtt-tools pack-to-json packs/items --out src/packs/items --clean

# フォルダ構造を再現しつつ volatile フィールドを除外
fvtt-tools pack-to-json packs/actors --out src/packs/actors --folders --omit-volatile
```

## npm scripts との組み合わせ

```json
{
  "scripts": {
    "unpack:macros": "fvtt-tools pack-to-json packs/macros --out src/packs/macros --clean"
  }
}
```

## `fvtt package unpack` との違い

| 比較点 | `fvtt package unpack` (CLI) | `pack-to-json` (Node.js API) |
|--------|----------------------------|------------------------------|
| 実行方法 | CLI サブコマンド経由 | `extractPack` API を直接呼び出し |
| CLI バグの影響 | 受ける | 受けない |
| セットアップ | `fvtt configure` が必要な場合あり | 不要 |
| オプション | CLI フラグ経由 | API オプションを直接指定 |

## volatile フィールドについて

`--omit-volatile` を指定すると `_stats`（作成・更新時刻など）が出力から除外される。
ソース管理での不要な差分を防ぎたい場合に有効。
