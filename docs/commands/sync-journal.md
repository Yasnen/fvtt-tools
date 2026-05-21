# sync-journal

## 概要

Babele Journal ローカライズ JSON において、上流モジュールの HTML 構造が更新された場合
（`_text` → `text_` の変更）に、ローカライズ済みの `text` フィールドを追従させる。

セグメント単位で差分を検出し、構造変化のみであれば自動適用、
テキスト内容が変わった場合や新規追加セグメントは `_needs_review` フィールドで記録する。

## 使い方

```bash
fvtt-tools sync-journal <input.json> [オプション]
```

## オプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--out <path>` | 入力ファイルと同じ | 出力先パス |
| `--dry-run` | — | ファイルを変更せず差分のみ表示 |

## 入力ファイル形式

2 種類の形式を自動判別する。

### entries/pages 形式（通常）

`entries` キーを持つ場合、`entries[JournalName].pages[PageName]` を処理対象とみなす。

```json
{
  "label": "Journals",
  "mapping": { "pages": { "path": "pages", "converter": "fvttJaJournalPages" } },
  "entries": {
    "JournalName": {
      "name": "...",
      "_id": "...",
      "pages": {
        "PageName": {
          "name": "ローカライズ済み名前",
          "text": "ローカライズ済みHTML（更新対象）",
          "_id": "xxxxxx",
          "_text": "旧原文HTML（旧ベース）",
          "text_": "新原文HTML（新ベース）"
        }
      }
    }
  }
}
```

コンソール出力のエントリ名は `JournalName / PageName` 形式で表示される。

### フラット形式

トップレベルのキーがエントリ名で、各エントリが直接フィールドを持つ形式。

```json
{
  "EntryName": {
    "name": "ローカライズ済み名前",
    "text": "ローカライズ済みHTML（更新対象）",
    "_id": "xxxxxx",
    "_text": "旧原文HTML（旧ベース）",
    "text_": "新原文HTML（新ベース）"
  }
}
```

### フィールド一覧

| フィールド | 役割 |
|-----------|------|
| `_text` | 前回の同期時点の原文（ベースライン） |
| `text_` | 上流モジュールの最新原文 |
| `text` | ローカライズ済み HTML（このコマンドが更新する） |

## 差分カテゴリ

`_text` と `text_` をトップレベルタグ単位のセグメント配列として比較し、各セグメントを以下に分類する。

| カテゴリ | 判定条件 | `text` への処理 |
|---------|---------|----------------|
| `EQUAL` | `_text` と `text_` のセグメントが一致 | JA 側のセグメントをそのまま維持 |
| `STRUCTURAL` | タグ構造のみ変化（テキスト内容は同一） | JA 側に同じ構造変化を自動適用 |
| `CHANGED` | テキスト内容も変化 | JA 側をそのまま残し `_needs_review` に記録 |
| `INSERTED` | `text_` にのみ存在する新規セグメント | 原文のまま挿入し `_needs_review` に記録 |
| `DELETED` | `_text` にのみ存在するセグメント | JA 側から削除 |

### STRUCTURAL の例

テーブルセル内への `<p>` タグ追加など、テキストは同じで構造だけが変わった場合。

```
_text: <td><em>1 Advantage</em></td>
text_: <td><p><em>1 Advantage</em></p></td>
JA:   <td><em>1 Vorsprung</em></td>   ← JA に翻訳済みの場合
→ 出力: <td><p><em>1 Vorsprung</em></p></td>  ← text_ の構造 + JA のテキスト
```

JA 側にセグメントが存在しない場合は `text_` をそのまま使用する。

## `_needs_review` フィールド

CHANGED または INSERTED セグメントが存在したエントリのルートに配列として追加される。

```json
{
  "EntryName": {
    "text": "...",
    "text_": "...",
    "_needs_review": ["CHANGED", "INSERTED"]
  }
}
```

- 重複なしの分類名リスト
- レビュー不要なエントリにはフィールドを追加しない
- 次回同期時に前回の `_needs_review` は上書きリセットされる

## 使用例

### 基本

```bash
fvtt-tools sync-journal lang/journal-ja.json
```

### 変更内容を確認してから適用

```bash
# まず --dry-run で差分確認
fvtt-tools sync-journal lang/journal-ja.json --dry-run

# 問題なければ実際に適用
fvtt-tools sync-journal lang/journal-ja.json
```

### 出力先を別ファイルに指定

```bash
fvtt-tools sync-journal lang/journal-ja.json --out lang/journal-ja-synced.json
```

## 出力例

```
[STRUCTURAL] 構造のみ変化したセグメント（自動適用）
  Group Advantage: 1 セグメント

[INSERTED] 新規追加セグメント（要レビュー）
  Group Advantage
    追加: <p>@UUID[...]{Strike to Injure}</p>

=== 同期サマリー ===
  処理エントリ数        : 1
  STRUCTURAL（自動）    : 1 セグメント
  CHANGED（要レビュー） : 0 エントリ
  INSERTED（要レビュー）: 1 エントリ
  DELETED               : 0 セグメント
```

## Tips

- **`_text` が必須**: `_text` が欠けているエントリはスキップされ警告が表示される。`text_` が欠けているエントリは更新なしとして警告なしでスキップされる。
- **`text` は段落単位で対応付け**: `text` のセグメント数が `_text` より少ない場合（未翻訳セグメントがある場合）、対応するセグメントに JA 訳がなければ `text_` の内容がそのまま使われる。
- **CHANGED は自動修正されない**: 原文テキストが変わった箇所は翻訳者による確認が必要なため JA 側を保持したまま `_needs_review` に記録される。
- **JSON インデントは自動検出**: 入力ファイルのインデントスタイル（スペース数・タブ）を検出して出力に維持する。
