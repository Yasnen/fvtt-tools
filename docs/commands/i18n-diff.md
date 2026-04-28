# i18n-diff

## 概要

2 つのリポジトリ（またはブランチ）間の言語ファイル差分を比較し、
コミットごとに cherry-pick 可否を判定する。

## 使い方

```bash
fvtt-tools i18n-diff --from <path> --to <path> [オプション]
```

## オプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--from <path>` | 必須 | 比較元（cherry-pick 送り出し元）リポジトリルートパス |
| `--to <path>` | 必須 | 比較先（cherry-pick 適用先）リポジトリルートパス |
| `--lang <file>` | `lang/ja.json` | 言語ファイルの相対パス |
| `--limit <n>` | `20` | 対象コミット数 |
| `--diff-only` | — | 差分レポートのみ表示（cherry-pick 判定をスキップ） |

## 判定結果の種類

| 判定 | 意味 |
|------|------|
| `OK` | cherry-pick 可能（言語ファイルのみ変更、to 側に対応するキーが存在） |
| `SKIP` | 適用不要（to 側に既に同じ値が存在） |
| `CAUTION` | 要確認（from のみのキーを含む、値が混在するなど） |
| `NG` | 不可（言語ファイル以外のファイルも変更されている） |

## 出力例

```
============================================================
【言語ファイル差分レポート】  --from: ../branch-a  --to: ../branch-b
============================================================
  共通・値も同じ  :  312 件
  共通・値が異なる:    5 件
  from のみ       :    8 件
  to のみ         :    2 件

--- 値が異なる共通キー ---
  WFRP4E.Foo.Bar
    from: "Foo"
      to: "フー"

============================================================
【cherry-pick 可否判定】（from → to 方向、直近 30 件）
============================================================
  ✅ [OK     ] abc1234 翻訳: Foo.Bar を更新
               → cherry-pick 可能
  ⏭  [SKIP   ] def5678 翻訳: 共通キーを修正
               → 対象ブランチに既に同じ値が存在
  ⚠  [CAUTION] ghi9012 翻訳: 新規キー追加
               → from のみのキーを含む: WFRP4E.New.Key
  ✖  [NG     ] jkl3456 feat: スクリプトと翻訳を同時変更
               → 言語ファイル以外も変更: src/scripts/foo.js

=== サマリー ===
  OK: 1 件 / SKIP: 1 件 / CAUTION: 1 件 / NG: 1 件
```

---

## worktree を使った複数ブランチ比較ワークフロー

複数ブランチを同時に参照する場合、`git worktree` で各ブランチを別ディレクトリに展開すると
`--from` / `--to` に直接渡せて便利。

### 1. worktree を作成する

```bash
# 比較元ブランチ（from）を worktree として展開
git worktree add ../my-module-branch-a branch-a

# 比較先ブランチ（to）を worktree として展開
git worktree add ../my-module-branch-b branch-b
```

### 2. i18n-diff で差分と cherry-pick 可否を確認する

```bash
fvtt-tools i18n-diff \
  --from ../my-module-branch-a \
  --to   ../my-module-branch-b \
  --lang lang/ja.json \
  --limit 30
```

### 3. OK コミットを cherry-pick する

`branch-b` の作業ディレクトリに移動して cherry-pick:

```bash
cd ../my-module-branch-b

# OK と表示されたコミットを cherry-pick
git cherry-pick abc1234

# 複数ある場合はまとめて指定（古い順に列挙）
git cherry-pick abc1234 bcd2345
```

### 4. CAUTION コミットの扱い

CAUTION は自動判定が難しいケース。内容を確認してから手動でパッチを当てるか、一部だけ取り込む:

```bash
# 変更内容を確認する
git show abc1234 -- lang/ja.json

# 内容を確認した上で cherry-pick し、コンフリクトを手動解消
git cherry-pick abc1234
# コンフリクトが出たら手動修正後
git cherry-pick --continue
```

### 5. 終わったら worktree を削除する

```bash
git worktree remove ../my-module-branch-a
git worktree remove ../my-module-branch-b
```

---

## 差分確認だけしたい場合

`--diff-only` を付けると JSON ファイルの比較のみ表示し、git log / cherry-pick 判定をスキップする:

```bash
fvtt-tools i18n-diff \
  --from ../my-module-branch-a \
  --to   ../my-module-branch-b \
  --diff-only
```
