# report

## 概要

翻訳ファイルのカバレッジを表示する。
翻訳済み・プレースホルダ・未翻訳（英語値のまま）の件数と割合をレポートする。

## 使い方

```bash
fvtt-tools report [オプション]
```

## オプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--ja <path>` | `lang/ja.json` | 翻訳ファイルのパス |
| `--base <path>` | `lang/en-base.json` | 上流 en.json のパス |
| `--extra-prefix <prefix>` | — | 集計から除外するプレフィックス（カンマ区切り複数指定可） |

## 出力例

```
=== 翻訳カバレッジ レポート ===
  翻訳ファイル  : lang/wfrp4e-ja.json
  ベース(en)    : lang/en-base.json

  総キー数（en）  :  1234
  翻訳済み        :  1190  (96.4%)
  プレースホルダ  :    18  ( 1.5%)  ← ===(XXX)===
  未翻訳（英語値）:    26  ( 2.1%)
```

## 使用例

```bash
# デフォルト設定で実行
fvtt-tools report

# ファイルパスを明示
fvtt-tools report --ja lang/wfrp4e-ja.json --base lang/en-base.json

# WFRP4e 独自キーを集計除外
fvtt-tools report \
  --ja lang/wfrp4e-ja.json \
  --base lang/en-base.json \
  --extra-prefix "WFRP4eJaJp."
```

## プレースホルダについて

`===(XXX)===` は `sync-lang` が新規キーの英語値末尾に自動付与するマーカー（デフォルト: `===(.001)===`）。
検出は「値に `===(` 〜 `)===` を含むか」で行うため、`--placeholder-sep` / `--placeholder-digits` のカスタマイズには依存しない（`--placeholder-mark` を変更した場合は検出対象外）。
`report` ではこれを「翻訳済み」とは別にカウントし、未翻訳の優先対象を把握できる。
