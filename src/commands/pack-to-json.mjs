/**
 * pack-to-json.mjs
 *
 * Foundry VTT の LevelDB パックを個別の JSON ファイルに変換する。
 * @foundryvtt/foundryvtt-cli の extractPack Node.js API を使用する。
 *
 * 使い方:
 *   fvtt-tools pack-to-json <pack-dir> [オプション]
 *
 * オプション:
 *   --out <dir>      出力ディレクトリ (デフォルト: ./<pack名>/)
 *   --clean          出力先を先にクリアする
 *   --folders        フォルダ構造を再現する
 *   --omit-volatile  volatile フィールド（_stats 等）を除外
 *   --yaml           JSON の代わりに YAML で出力
 */

import { resolve, basename } from 'path';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`使い方: fvtt-tools pack-to-json <pack-dir> [オプション]

Foundry VTT の LevelDB パックを個別の JSON ファイルに変換します。
@foundryvtt/foundryvtt-cli の extractPack API を内部で使用します。

オプション:
  --out <dir>      出力ディレクトリ (デフォルト: ./<pack名>/)
  --clean          出力先を先にクリアする
  --folders        フォルダ構造を再現する
  --omit-volatile  volatile フィールド（_stats 等）を除外
  --yaml           JSON の代わりに YAML で出力

例:
  fvtt-tools pack-to-json packs/macros
  fvtt-tools pack-to-json packs/items --out src/packs/items --clean
`);
  process.exit(0);
}

let packPath      = null;
let outDir        = null;
let clean         = false;
let folders       = false;
let omitVolatile  = false;
let yaml          = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--out':          outDir       = resolve(args[++i]); break;
    case '--clean':        clean        = true; break;
    case '--folders':      folders      = true; break;
    case '--omit-volatile':omitVolatile = true; break;
    case '--yaml':         yaml         = true; break;
    default:
      if (!packPath && !args[i].startsWith('--')) {
        packPath = resolve(args[i]);
      } else {
        console.error(`不明なオプション: ${args[i]}`);
        process.exit(1);
      }
  }
}

if (!packPath) {
  console.error('エラー: パックディレクトリのパスを指定してください。');
  process.exit(1);
}

if (!outDir) {
  outDir = resolve(basename(packPath));
}

let extractPack;
try {
  ({ extractPack } = await import('@foundryvtt/foundryvtt-cli'));
} catch {
  console.error('エラー: @foundryvtt/foundryvtt-cli が見つかりません。');
  console.error('       npm install --save-dev @foundryvtt/foundryvtt-cli でインストールしてください。');
  process.exit(1);
}

await extractPack(packPath, outDir, {
  log:          true,
  clean,
  folders,
  omitVolatile,
  yaml,
});
