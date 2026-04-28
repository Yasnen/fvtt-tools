# sync-lang

## 概要

上流の `en.json` 更新を三方向マージで翻訳ファイルへ反映する。
英語値が変わったキー・新規キー・削除されたキーをカテゴリ別に出力する。

## 使い方

```bash
fvtt-tools sync-lang <新en.json> [オプション]
```

## オプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--base <path>` | `lang/en-base.json` | 旧 en.json のパス（前回同期時点のスナップショット） |
| `--ja <path>` | `lang/ja.json` | 翻訳ファイルのパス |
| `--out <path>` | `--ja` と同じ | 出力先パス |
| `--extra-marker <key>` | — | extra セクション開始マーカーキー |
| `--extra-prefix <prefix>` | — | ORPHAN 除外プレフィックス（カンマ区切り複数指定可） |
| `--dry-run` | — | ファイルを変更せず差分のみ表示 |
| `--update-base` | — | 同期後に `en-base.json` を新 en.json で上書き更新 |

## 出力カテゴリ

| カテゴリ | 説明 |
|---------|------|
| `[CHANGED]` | 英語値が変わったキー（再翻訳が必要な可能性） |
| `[NEW]` | 新規キー（プレースホルダ `===(.01)===` を付与） |
| `[ORPHAN]` | 翻訳ファイルにのみ存在するキー（上流から削除された） |

## 動作の仕組み

三方向マージ: `--base`（旧 en）・`--ja`（翻訳）・`<新en.json>` の 3 ファイルを比較する。

- `base → 新en` で英語値が変わったキー → `[CHANGED]`
- `新en` に存在し `base` に存在しないキー → `[NEW]`（翻訳ファイルに追記）
- `翻訳` に存在し `新en` に存在しないキー → `[ORPHAN]`（`--extra-prefix` に一致すれば除外）

## 使用例

### 基本

```bash
fvtt-tools sync-lang /path/to/upstream/lang/en.json
```

### WFRP4e 向け

```bash
fvtt-tools sync-lang /path/to/wfrp4e/lang/en.json \
  --ja lang/wfrp4e-ja.json \
  --extra-marker "WFRP4eJaJp.comment.core-en.json" \
  --extra-prefix "WFRP4eJaJp." \
  --update-base
```

### 変更内容を確認してから適用

```bash
# まず --dry-run で差分確認
fvtt-tools sync-lang /path/to/en.json --dry-run

# 問題なければ実際に適用
fvtt-tools sync-lang /path/to/en.json --update-base
```

## Tips

- **`--update-base` は通常セットで使う**: 同期後に `en-base.json` を更新しておかないと、次回実行時に前回分の差分が重複して検出される。
- **`--extra-marker`**: 翻訳ファイルに独自追加キー（extra セクション）がある場合、そのセクション開始キーを指定することで ORPHAN 誤判定を防ぐ。
- **`--extra-prefix`**: `--extra-marker` と組み合わせて、特定プレフィックスのキーを ORPHAN 集計から除外する。
