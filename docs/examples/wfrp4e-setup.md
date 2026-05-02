# wfrp4e-ja-jp での設定例

## package.json

```json
{
  "devDependencies": {
    "@foundryvtt/foundryvtt-cli": "^3.0.0",
    "@yasnen/fvtt-tools": "github:Yasnen/fvtt-tools"
  },
  "scripts": {
    "unpack:packs": "fvtt-tools pack-to-json $WFRP4E_CORE_DIR --out src/packs --omit-volatile --clean",
    "sync-lang":    "fvtt-tools sync-lang $UPSTREAM_EN --ja lang/wfrp4e-ja.json --base lang/en-base.json --extra-marker WFRP4eJaJp.comment.core-en.json --extra-prefix WFRP4eJaJp. --update-base",
    "report":       "fvtt-tools report --ja lang/wfrp4e-ja.json --base lang/en-base.json",
    "validate":     "fvtt-tools validate compendium/"
  }
}
```

`WFRP4E_CORE_DIR` は `module.json` があるモジュールルートディレクトリのパス（例: `~/foundry/data/modules/wfrp4e-core`）。

## 使用例

```bash
# wfrp4e-core の全 pack を src/packs/ に展開
WFRP4E_CORE_DIR=~/foundry/data/modules/wfrp4e-core npm run unpack:packs
# → src/packs/wfrp4e-core_items/, src/packs/wfrp4e-core_skills/, ... が生成される

# または --merge で各 pack を 1 ファイルにまとめる
fvtt-tools pack-to-json ~/foundry/data/modules/wfrp4e-core --out src/packs --merge

# 上流 en.json のパスを指定して同期
UPSTREAM_EN=/path/to/wfrp4e/lang/en.json npm run sync-lang

# または直接
npx fvtt-tools sync-lang /path/to/wfrp4e/lang/en.json \
  --ja lang/wfrp4e-ja.json \
  --extra-marker "WFRP4eJaJp.comment.core-en.json" \
  --extra-prefix "WFRP4eJaJp." \
  --update-base
```

## オプションの意味

| オプション | 値 | 理由 |
|-----------|---|------|
| `--ja` | `lang/wfrp4e-ja.json` | WFRP4e 翻訳ファイルのパス |
| `--base` | `lang/en-base.json` | 前回同期時の en.json スナップショット |
| `--extra-marker` | `WFRP4eJaJp.comment.core-en.json` | 翻訳ファイル内の extra セクション開始キー |
| `--extra-prefix` | `WFRP4eJaJp.` | WFRP4e 独自追加キーのプレフィックス（ORPHAN 除外用） |
| `--update-base` | — | 同期後に `en-base.json` を自動更新 |
