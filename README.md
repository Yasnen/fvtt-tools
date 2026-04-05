# @yasnen/fvtt-tools

Foundry VTT モジュール開発・ローカライズ向け CLI ツール集。

外部依存ゼロ、Node.js 20+ の標準モジュールのみで動作。

## インストール

GitHub プライベートリポジトリから直接インストール:

```bash
npm install --save-dev github:Yasnen/fvtt-tools
```

または `package.json` に手動で追加:

```json
{
  "devDependencies": {
    "@yasnen/fvtt-tools": "github:Yasnen/fvtt-tools"
  }
}
```

## コマンド一覧

```
fvtt-tools <command> [options]

  sync-lang        上流 en.json と翻訳ファイルを三方向マージで同期
  fix-pack-names   fvtt unpack 後の非ASCII ファイル名を修正
  report           翻訳カバレッジをレポート表示
  validate         Babele 辞書 JSON の構造チェック
  placeholder-list 翻訳ファイル内のプレースホルダを一覧表示
```

---

### `sync-lang`

上流の `en.json` 更新を三方向マージで翻訳ファイルへ反映する。

```bash
fvtt-tools sync-lang <新en.json> [オプション]

オプション:
  --base           <path>    旧en.jsonのパス             (デフォルト: lang/en-base.json)
  --ja             <path>    翻訳ファイルのパス           (デフォルト: lang/ja.json)
  --out            <path>    出力先                       (デフォルト: --ja と同じ)
  --extra-marker   <key>     extraセクション開始マーカーキー
  --extra-prefix   <prefix>  ORPHAN除外プレフィックス（カンマ区切り複数指定可）
  --dry-run                  ファイルを変更せず差分のみ表示
  --update-base              同期後に en-base.json を更新
```

**WFRP4e 向け例:**

```bash
fvtt-tools sync-lang /path/to/wfrp4e/lang/en.json \
  --ja lang/wfrp4e-ja.json \
  --extra-marker "WFRP4eJaJp.comment.core-en.json" \
  --extra-prefix "WFRP4eJaJp." \
  --update-base
```

**出力カテゴリ:**

| カテゴリ | 説明 |
|---------|------|
| `[CHANGED]` | 英語値が変わったキー（再翻訳が必要な可能性） |
| `[NEW]` | 新規キー（プレースホルダ `===(.01)===` を付与） |
| `[ORPHAN]` | 翻訳ファイルにのみ存在するキー（上流から削除された） |

---

### `fix-pack-names`

`fvtt package unpack` は非ASCII文字をファイル名で `_` に置換するため、日本語名のドキュメントが `________{id}.json` のような名前で出力される。このコマンドは JSON 内の `name` フィールドを使って正規ファイル名に修正する。

```bash
fvtt-tools fix-pack-names <directory>
```

**例:**

```bash
fvtt-tools fix-pack-names src/packs/macros
```

---

### `report`

翻訳ファイルのカバレッジを表示する。

```bash
fvtt-tools report [オプション]

オプション:
  --ja           <path>    翻訳ファイル     (デフォルト: lang/ja.json)
  --base         <path>    上流 en.json    (デフォルト: lang/en-base.json)
  --extra-prefix <prefix>  集計除外プレフィックス
```

**出力例:**

```
=== 翻訳カバレッジ レポート ===
  翻訳ファイル  : lang/wfrp4e-ja.json
  ベース(en)    : lang/en-base.json

  総キー数（en）  :  1234
  翻訳済み        :  1190  (96.4%)
  プレースホルダ  :    18  ( 1.5%)  ← ===(.XX)===
  未翻訳（英語値）:    26  ( 2.1%)
```

---

### `validate`

Babele 辞書 JSON の構造チェック。ディレクトリを指定すると配下の `*.json` を対象とする。

```bash
fvtt-tools validate <path> [<path> ...]
```

**チェック項目:**
- JSON 構文エラー
- `label` フィールドの存在
- `entries` または `mapping` のいずれかが存在するか
- `mapping` の各エントリが `path` を持つか（オブジェクト形式の場合）
- `entries` の各ドキュメントに `name` フィールドがあるか

**例:**

```bash
fvtt-tools validate compendium/
fvtt-tools validate compendium/wfrp4e-core.items.json
```

エラーがある場合は exit code 1 で終了する。

---

### `placeholder-list`

翻訳ファイル内のプレースホルダ（`===(.XX)===`）を一覧表示する。

```bash
fvtt-tools placeholder-list [オプション]

オプション:
  --ja    <path>  翻訳ファイル    (デフォルト: lang/ja.json)
  --base  <path>  上流 en.json   (省略時: 英語値を非表示)
```

**出力例:**

```
=== プレースホルダ一覧 (18件) ===
  翻訳ファイル: lang/wfrp4e-ja.json

  ===(.01)===  WFRP4E.SomeKey.New
               英語: "Some new string"
  ===(.02)===  WFRP4E.Another.Key
               英語: "Another string"
```

---

### `i18n-diff`

言語ファイルの差分を比較し、コミットごとに cherry-pick 可否を判定する。

```bash
fvtt-tools i18n-diff --from <path> --to <path> [オプション]

オプション:
  --from <path>   比較元（cherry-pick 送り出し元）リポジトリルートパス  [必須]
  --to   <path>   比較先（cherry-pick 適用先）リポジトリルートパス      [必須]
  --lang <file>   言語ファイルの相対パス（デフォルト: lang/ja.json）
  --limit <n>     対象コミット数（デフォルト: 20）
  --diff-only     差分レポートのみ表示（cherry-pick判定をスキップ）
```

**判定結果の種類:**

| 判定 | 意味 |
|------|------|
| `OK` | cherry-pick 可能（言語ファイルのみ変更、to 側に対応するキーが存在） |
| `SKIP` | 適用不要（to 側に既に同じ値が存在） |
| `CAUTION` | 要確認（from のみのキーを含む、値が混在するなど） |
| `NG` | 不可（言語ファイル以外のファイルも変更されている） |

---

#### worktree を使った複数ブランチ比較と cherry-pick

翻訳リポジトリで複数ブランチを同時に参照する場合、`git worktree` で各ブランチを別ディレクトリに展開すると `--from` / `--to` に直接渡せて便利。

**1. worktree を作成する**

```bash
# 比較元ブランチ（from）を worktree として展開
git worktree add ../my-module-branch-a branch-a

# 比較先ブランチ（to）を worktree として展開
git worktree add ../my-module-branch-b branch-b
```

**2. `i18n-diff` で差分と cherry-pick 可否を確認する**

```bash
fvtt-tools i18n-diff \
  --from ../my-module-branch-a \
  --to   ../my-module-branch-b \
  --lang lang/ja.json \
  --limit 30
```

出力例:

```
============================================================
【言語ファイル差分レポート】  --from: ../my-module-branch-a  --to: ../my-module-branch-b
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

**3. OK コミットを cherry-pick する**

`branch-b` の作業ディレクトリ（またはそのリポジトリ）に移動して cherry-pick:

```bash
cd ../my-module-branch-b

# OK と表示されたコミットを cherry-pick
git cherry-pick abc1234

# 複数ある場合はまとめて指定（古い順に列挙）
git cherry-pick abc1234 bcd2345
```

**4. CAUTION コミットの扱い**

CAUTION は自動判定が難しいケース。内容を確認してから手動でパッチを当てるか、一部だけ取り込む:

```bash
# 変更内容を確認する
git show abc1234 -- lang/ja.json

# 内容を確認した上で cherry-pick し、コンフリクトを手動解消
git cherry-pick abc1234
# コンフリクトが出たら手動修正後
git cherry-pick --continue
```

**5. 終わったら worktree を削除する**

```bash
git worktree remove ../my-module-branch-a
git worktree remove ../my-module-branch-b
```

---

#### 差分確認だけしたい場合

`--diff-only` を付けると JSON ファイルの比較のみ表示し、git log / cherry-pick 判定をスキップする:

```bash
fvtt-tools i18n-diff \
  --from ../my-module-branch-a \
  --to   ../my-module-branch-b \
  --diff-only
```

---

## `wfrp4e-ja-jp` での設定例

`package.json`:

```json
{
  "devDependencies": {
    "@foundryvtt/foundryvtt-cli": "^3.0.0",
    "@yasnen/fvtt-tools": "github:Yasnen/fvtt-tools"
  },
  "scripts": {
    "unpack:packs": "fvtt package unpack -n macros --in packs --out src/packs/macros && fvtt-tools fix-pack-names src/packs/macros",
    "sync-lang":    "fvtt-tools sync-lang $UPSTREAM_EN --ja lang/wfrp4e-ja.json --base lang/en-base.json --extra-marker WFRP4eJaJp.comment.core-en.json --extra-prefix WFRP4eJaJp. --update-base",
    "report":       "fvtt-tools report --ja lang/wfrp4e-ja.json --base lang/en-base.json",
    "validate":     "fvtt-tools validate compendium/"
  }
}
```

使用例:

```bash
# 上流 en.json のパスを指定して同期
UPSTREAM_EN=/path/to/wfrp4e/lang/en.json npm run sync-lang

# または直接
npx fvtt-tools sync-lang /path/to/wfrp4e/lang/en.json \
  --ja lang/wfrp4e-ja.json \
  --extra-marker "WFRP4eJaJp.comment.core-en.json" \
  --extra-prefix "WFRP4eJaJp." \
  --update-base
```

## ライセンス

MIT
