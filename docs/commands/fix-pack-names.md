# fix-pack-names

## 概要

`fvtt package unpack` 後の非 ASCII ファイル名を修正する。

`fvtt package unpack` は非 ASCII 文字をファイル名で `_` に置換するため、
日本語名のドキュメントが `________{id}.json` のような名前で出力される。
このコマンドは JSON 内の `name` フィールドを使って正規ファイル名に修正する。

## 使い方

```bash
fvtt-tools fix-pack-names <directory>
```

## 使用例

```bash
fvtt-tools fix-pack-names src/packs/macros
```

## 動作

対象ディレクトリ内の `*.json` ファイルを走査し、
ファイル名が `_` 連続またはハッシュ付きのパターンに一致するものを
JSON 内の `name` フィールドの値をもとにリネームする。

## npm scripts との組み合わせ

`fvtt package unpack` と連続して実行するのが一般的な使い方:

```json
{
  "scripts": {
    "unpack:packs": "fvtt package unpack -n macros --in packs --out src/packs/macros && fvtt-tools fix-pack-names src/packs/macros"
  }
}
```
