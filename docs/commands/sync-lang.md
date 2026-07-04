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
| `--placeholder-sep <str>` | `.` | プレースホルダ内の数字前に付ける文字列 |
| `--placeholder-mark <str>` | `===` | プレースホルダの囲み文字列 |
| `--placeholder-digits <n>` | `3` | 連番の桁数 |
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

---

## extra セクションと ORPHAN 除外の詳細

### extra セクション（`--extra-marker`）

翻訳ファイルには、上流 en.json に存在しない**独自追加キー**を末尾にまとめて置くことがある。
これを「extra セクション」と呼ぶ。

`--extra-marker <key>` を指定すると、`--ja` ファイルのトップレベルキーの中で
指定キー以降をすべて extra セクションとして扱う。

**効果:**

| 動作 | 説明 |
|------|------|
| ORPHAN 除外 | extra セクション内のキーは ORPHAN として報告されない |
| 出力への保持 | extra セクションの内容を出力ファイルの末尾に自動で追記する |

**出力時の挙動（重要）:**
`sync-lang` の出力は `新en.json` の生テキストをベースに翻訳値を上書きする形式。
extra セクションは `新en.json` に存在しないため、`--extra-marker` が指定されていないと
**出力ファイルから消える**。`--extra-marker` を指定することで末尾に再付加される。

**例:**

```json
// ja.json（抜粋）
{
  "WFRP4E.Skill.Name": "技能名",
  "WFRP4eJaJp.comment.core-en.json": "=== extra section ===",  ← マーカーキー
  "WFRP4eJaJp.someCustomKey": "独自追加の翻訳"
}
```

```bash
# このマーカーキー以降が extra セクションとして扱われる
fvtt-tools sync-lang /path/to/en.json \
  --extra-marker "WFRP4eJaJp.comment.core-en.json"
```

---

### ORPHAN 除外プレフィックス（`--extra-prefix`）

`--extra-prefix <prefix>` を指定すると、ORPHAN 検出時に
指定プレフィックスで始まるキーをスキップする。

**`--extra-marker` との違い:**

| | `--extra-marker` | `--extra-prefix` |
|---|---|---|
| ORPHAN 除外 | ✅ マーカー以降の全キー | ✅ プレフィックス一致キー |
| 出力への保持 | ✅ 自動で末尾に追記 | ❌ 保持しない（キーが消える） |
| 対象の決まり方 | `ja.json` のキー順序（マーカー位置） | プレフィックス文字列 |

**使い分けの目安:**
- 独自追加キーを**出力ファイルにも残したい** → `--extra-marker`（+ `--extra-prefix` を併用して誤検知抑制）
- 上流から削除されたキーを**意図的に残している**が出力には不要 → `--extra-prefix` のみ

**カンマ区切りで複数指定可能:**

```bash
--extra-prefix "WFRP4eJaJp.,MyModule."
```

---

### 両オプションの組み合わせ（推奨パターン）

```bash
fvtt-tools sync-lang /path/to/en.json \
  --extra-marker "WFRP4eJaJp.comment.core-en.json" \
  --extra-prefix "WFRP4eJaJp."
```

- `--extra-marker` で extra セクションを出力に保持
- `--extra-prefix` でプレフィックス一致キーをさらに ORPHAN 除外（マーカーより前に同プレフィックスのキーが紛れ込んでいても安全）

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

---

## プレースホルダのフォーマット

`[NEW]` キーに付与されるプレースホルダは以下の形式:

```
<mark>(<sep><digits桁連番>)<mark>
```

デフォルトは `===(.001)===`。各部分は個別に変更できる。

| オプション | 変更箇所 | デフォルト | 例 |
|-----------|---------|-----------|---|
| `--placeholder-mark` | `===` の部分 | `===` | `##` → `##(.001)##` |
| `--placeholder-sep` | `.` の部分 | `.` | `_` → `===(_001)===` |
| `--placeholder-digits` | `001` の桁数 | `3` | `2` → `===(.01)===` |

**例:**

```bash
# デフォルト: ===(.001)===
fvtt-tools sync-lang /path/to/en.json

# 2桁連番: ===(.01)===
fvtt-tools sync-lang /path/to/en.json --placeholder-digits 2

# アンダースコア区切り: ===(_001)===
fvtt-tools sync-lang /path/to/en.json --placeholder-sep "_"

# 囲み文字を変更: ##(.001)##
fvtt-tools sync-lang /path/to/en.json --placeholder-mark "##"

# 組み合わせ: ##_01##
fvtt-tools sync-lang /path/to/en.json \
  --placeholder-mark "##" \
  --placeholder-sep "_" \
  --placeholder-digits 2
```

> **注意:** `report` や `placeholder-list` は「値に `===(` 〜 `)===` を含むか」でプレースホルダを検出する。
> `--placeholder-sep` / `--placeholder-digits` の変更は検出に影響しないが、
> `--placeholder-mark` をデフォルトの `===` から変更した場合は検出されなくなる。

---

## Tips

- **`--update-base` は通常セットで使う**: 同期後に `en-base.json` を更新しておかないと、次回実行時に前回分の差分が重複して検出される。
- **`--extra-marker`**: 翻訳ファイルに独自追加キー（extra セクション）がある場合、そのセクション開始キーを指定することで ORPHAN 誤判定を防ぐ。
- **`--extra-prefix`**: `--extra-marker` と組み合わせて、特定プレフィックスのキーを ORPHAN 集計から除外する。
