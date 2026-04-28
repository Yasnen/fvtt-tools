# git worktree + cherry-pick ワークフロー

複数バージョンブランチを持つ翻訳プロジェクトで、`fvtt-tools` を使った同期作業を効率的に行うためのワークフロー。

## 前提

- 翻訳対象モジュールが複数のブランチ（例: `v11`, `v12`, `main`）を持つ
- `fvtt-tools sync-lang` で得たコミットを複数ブランチに適用したい
- `git worktree` を使うと複数ブランチを同時に別ディレクトリへチェックアウトでき、`stash` や `checkout` の切り替えが不要になる

---

## 1. worktree のセットアップ

```bash
# 翻訳プロジェクトのルートで作業
cd ~/trpg/dev/wfrp4e-ja-jp

# メインブランチは既存の作業ディレクトリをそのまま使う
# 他ブランチ用の worktree を追加する（兄弟ディレクトリに展開するのが見通しがよい）
git worktree add ../wfrp4e-ja-jp-v11 v11
git worktree add ../wfrp4e-ja-jp-v12 v12
```

確認:

```bash
git worktree list
# /home/hayashi/trpg/dev/wfrp4e-ja-jp       683b1c0 [main]
# /home/hayashi/trpg/dev/wfrp4e-ja-jp-v11   aabbcc0 [v11]
# /home/hayashi/trpg/dev/wfrp4e-ja-jp-v12   ddeeff0 [v12]
```

`fvtt-tools` は npm でインストール済みのためどの worktree でも共通で使える。別途インストール不要。

---

## 2. メインブランチで sync-lang を実行してコミット

```bash
cd ~/trpg/dev/wfrp4e-ja-jp   # メインの worktree

# 上流 en.json のパスを指定して同期・コミット
fvtt-tools sync-lang /path/to/wfrp4e/lang/en.json \
  --ja lang/wfrp4e-ja.json \
  --extra-marker "WFRP4eJaJp.comment.core-en.json" \
  --extra-prefix "WFRP4eJaJp." \
  --update-base

git add lang/
git commit -m "sync-lang: update to upstream en.json YYYY-MM-DD"
```

コミットハッシュを確認しておく:

```bash
git log --oneline -1
# a1b2c3d sync-lang: update to upstream en.json 2026-04-05
```

---

## 3. 他ブランチへ cherry-pick

```bash
cd ~/trpg/dev/wfrp4e-ja-jp-v12   # v12 の worktree

git cherry-pick a1b2c3d
```

コンフリクトが発生した場合:

```bash
# コンフリクトを手動解消後
git add lang/
git cherry-pick --continue
```

v11 にも同様に適用:

```bash
cd ~/trpg/dev/wfrp4e-ja-jp-v11

git cherry-pick a1b2c3d
```

---

## 4. 複数コミットをまとめて cherry-pick する場合

```bash
# main の最新 3 コミットを v12 へ適用
cd ~/trpg/dev/wfrp4e-ja-jp-v12

git cherry-pick main~3..main
# または範囲指定（開始コミットは含まない）
git cherry-pick a1b2c3d..f6e7d8c
```

---

## 5. worktree の片付け

作業が完了したら worktree を削除する:

```bash
# メインリポジトリから削除（ブランチ自体は残る）
git worktree remove ../wfrp4e-ja-jp-v12
git worktree remove ../wfrp4e-ja-jp-v11

# 削除済み worktree の参照を整理
git worktree prune
```

---

## よくあるパターン

### `--dry-run` で差分確認してから各 worktree に適用

```bash
# main で変更内容を確認
fvtt-tools sync-lang /path/to/en.json --dry-run

# 問題なければ本適用
fvtt-tools sync-lang /path/to/en.json --update-base
git add lang/ && git commit -m "sync-lang: ..."

# 各 worktree に cherry-pick
for dir in ../wfrp4e-ja-jp-v11 ../wfrp4e-ja-jp-v12; do
  git -C "$dir" cherry-pick "$(git rev-parse HEAD)"
done
```

### ブランチごとに上流バージョンが異なる場合

各 worktree で `sync-lang` を個別に実行する（`--base` に各ブランチ対応の `en-base.json` が存在する）:

```bash
cd ~/trpg/dev/wfrp4e-ja-jp-v11
fvtt-tools sync-lang /path/to/wfrp4e-v11/lang/en.json \
  --ja lang/wfrp4e-ja.json \
  --update-base
git add lang/ && git commit -m "sync-lang: v11 upstream update"
```

この場合は cherry-pick ではなく各ブランチで独立してコミットする。

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `cherry-pick` でコンフリクト | `lang/ja.json` の ORPHAN/extra セクション付近が多い。手動マージ後 `git cherry-pick --continue` |
| `git worktree add` で "already checked out" | 同一ブランチを複数 worktree に展開不可。別ブランチを使うか `-b` で新ブランチを作成 |
| `fvtt-tools: command not found` | `npx fvtt-tools` を使うか `./node_modules/.bin/fvtt-tools` を指定 |
