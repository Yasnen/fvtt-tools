# wfrp4e-ja-jp での設定例

## package.json

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

## 使用例

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

## オプションの意味

| オプション | 値 | 理由 |
|-----------|---|------|
| `--ja` | `lang/wfrp4e-ja.json` | WFRP4e 翻訳ファイルのパス |
| `--base` | `lang/en-base.json` | 前回同期時の en.json スナップショット |
| `--extra-marker` | `WFRP4eJaJp.comment.core-en.json` | 翻訳ファイル内の extra セクション開始キー |
| `--extra-prefix` | `WFRP4eJaJp.` | WFRP4e 独自追加キーのプレフィックス（ORPHAN 除外用） |
| `--update-base` | — | 同期後に `en-base.json` を自動更新 |
