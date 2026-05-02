/**
 * pack-to-json.mjs
 *
 * NeDB 形式（.db）の Foundry VTT パックファイルを個別の JSON ファイルに変換する。
 * 各ドキュメントを <name>_<_id>.json 形式で出力する。
 *
 * 使い方:
 *   fvtt-tools pack-to-json <pack.db> [オプション]
 *
 * オプション:
 *   --out    <dir>  出力ディレクトリ (デフォルト: ./<pack名>/)
 *   --indent <n>    JSON インデント幅 (デフォルト: 2)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, basename, join } from 'path';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`使い方: fvtt-tools pack-to-json <pack.db> [オプション]

NeDB 形式（.db）の Foundry VTT パックファイルを個別の JSON ファイルに変換します。
各ドキュメントを <name>_<_id>.json 形式で出力します。

オプション:
  --out    <dir>  出力ディレクトリ (デフォルト: ./<pack名>/)
  --indent <n>    JSON インデント幅 (デフォルト: 2)

例:
  fvtt-tools pack-to-json packs/macros.db
  fvtt-tools pack-to-json packs/items.db --out src/packs/items
`);
  process.exit(0);
}

let packPath = null;
let outDir   = null;
let indent   = 2;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--out':    outDir = resolve(args[++i]); break;
    case '--indent': indent = parseInt(args[++i], 10); break;
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
  console.error('エラー: パックファイルのパスを指定してください。');
  process.exit(1);
}

if (!outDir) {
  const base = basename(packPath).replace(/\.[^.]+$/, '');
  outDir = resolve(base);
}

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

function toSafeFilename(str) {
  return str.replace(/[/\\?*:|"<>]/g, '_');
}

const raw   = readFileSync(packPath, 'utf8');
const lines = raw.split('\n');

let count = 0;
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  let doc;
  try {
    doc = JSON.parse(trimmed);
  } catch {
    console.warn(`WARN: JSON パース失敗: ${trimmed.slice(0, 80)}`);
    continue;
  }

  // NeDB の削除済みエントリをスキップ
  if (doc.$$deleted) continue;

  const id = doc._id ?? doc.id;
  if (!id) {
    console.warn(`WARN: _id が見つかりません: ${JSON.stringify(doc).slice(0, 80)}`);
    continue;
  }

  const name     = doc.name ?? id;
  const filename = `${toSafeFilename(name)}_${id}.json`;
  writeFileSync(join(outDir, filename), JSON.stringify(doc, null, indent) + '\n', 'utf8');
  count++;
}

console.log(`pack-to-json: ${count} 件を ${outDir} に出力しました`);
