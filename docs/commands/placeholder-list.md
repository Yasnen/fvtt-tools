# placeholder-list

## 概要

翻訳ファイル内のプレースホルダ（`===(.XX)===`）を一覧表示する。
`sync-lang` が未翻訳の新規キーに付与したマーカーを確認するために使う。

## 使い方

```bash
fvtt-tools placeholder-list [オプション]
```

## オプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--ja <path>` | `lang/ja.json` | 翻訳ファイルのパス |
| `--base <path>` | — | 上流 en.json のパス（省略時: 英語値を非表示） |

## 出力例

```
=== プレースホルダ一覧 (18件) ===
  翻訳ファイル: lang/wfrp4e-ja.json

  ===(.01)===  WFRP4E.SomeKey.New
               英語: "Some new string"
  ===(.02)===  WFRP4E.Another.Key
               英語: "Another string"
```

## 使用例

```bash
# 翻訳ファイルのプレースホルダ一覧（英語値なし）
fvtt-tools placeholder-list --ja lang/wfrp4e-ja.json

# 英語値も表示（--base 指定時）
fvtt-tools placeholder-list \
  --ja lang/wfrp4e-ja.json \
  --base lang/en-base.json
```

## プレースホルダ形式

`===(.XX)===` の `XX` は 01 から始まる連番。
`sync-lang` で `[NEW]` として追加されたキーに付与される。
翻訳完了後は正式な翻訳文字列で置き換える。
