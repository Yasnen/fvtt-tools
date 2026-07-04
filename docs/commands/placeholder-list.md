# placeholder-list

## 概要

翻訳ファイル内のプレースホルダ（`===(XXX)===` を含む値）を一覧表示する。
`sync-lang` が未翻訳の新規キーに付与したマーカーを確認するために使う。
`--placeholder-sep` / `--placeholder-digits` を変更していても検出できる
（`--placeholder-mark` をデフォルトの `===` から変更した場合は検出対象外）。

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
               現在値: "Some new string===(.01)==="
               英語  : "Some new string"
  ===(.02)===  WFRP4E.Another.Key
               現在値: "Another string===(.02)==="
               英語  : "Another string"
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

`sync-lang` で `[NEW]` として追加されたキーに、英語値の末尾へ `===(<sep><連番>)===` 形式で付与される（デフォルト: `===(.001)===`）。
検出は「値に `===(` 〜 `)===` を含むか」で行うため、区切り文字・桁数のカスタマイズには依存しない。
翻訳完了後は正式な翻訳文字列で置き換える。
