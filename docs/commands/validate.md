# validate

## 概要

Babele 辞書 JSON の構造チェックを行う。
ディレクトリを指定すると配下の `*.json` を一括対象とする。

## 使い方

```bash
fvtt-tools validate <path> [<path> ...]
```

## チェック項目

- JSON 構文エラー
- `label` フィールドの存在
- `entries` または `mapping` のいずれかが存在するか
- `mapping` の各エントリが `path` を持つか（オブジェクト形式の場合）
- `entries` の各ドキュメントに `name` フィールドがあるか

## 使用例

```bash
# ディレクトリ配下を一括チェック
fvtt-tools validate compendium/

# 特定ファイルを指定
fvtt-tools validate compendium/wfrp4e-core.items.json

# 複数パスをまとめて指定
fvtt-tools validate compendium/ translations/extra.json
```

## 終了コード

| コード | 意味 |
|-------|------|
| `0` | エラーなし |
| `1` | 1 件以上のエラーあり |

CI/CD でのゲートチェックに利用できる。
