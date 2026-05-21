/**
 * fix-pack-names.mjs
 *
 * fvtt package unpack は非ASCII文字をファイル名で _ に置換するため、
 * 日本語名のドキュメントが ________{id}.json のような名前で出力される。
 * このコマンドは JSON の name フィールドを使って正規ファイル名に修正する。
 *
 * 使い方:
 *   fvtt-tools fix-pack-names <dir>
 */

import { readdirSync, readFileSync, renameSync, unlinkSync, existsSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`使い方: fvtt-tools fix-pack-names <directory>

fvtt package unpack 後に生成された非ASCII文字が _ に置換されたファイル名を、
JSON 内の name フィールドを元に正規ファイル名へ修正します。
重複 _id が検出された場合、正規ファイル名のものを保持して他を削除します。

例:
  fvtt-tools fix-pack-names src/packs/macros
`);
  process.exit(0);
}

const dir = resolve(args[0]);

if (!existsSync(dir)) {
  console.error(`エラー: ディレクトリが見つかりません: ${dir}`);
  process.exit(1);
}
if (!statSync(dir).isDirectory()) {
  console.error(`エラー: パスがディレクトリではありません: ${dir}`);
  process.exit(1);
}

/** ファイル名として使えない文字のみ _ に置換（日本語等は保持） */
function toSafeFilename(str) {
  return str.replace(/[/\\?*:|"<>]/g, '_');
}

const files = readdirSync(dir).filter(f => extname(f) === '.json');

/** _id → { file, doc }[] のマップを構築 */
const byId = new Map();
for (const file of files) {
  const filePath = join(dir, file);
  let doc;
  try {
    doc = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.warn(`WARN: JSON パース失敗 (スキップ): ${file}: ${e.message}`);
    continue;
  }
  const id = doc._id;
  if (!id) {
    console.warn(`WARN: _id が見つかりません: ${file}`);
    continue;
  }
  if (!byId.has(id)) byId.set(id, []);
  byId.get(id).push({ file, filePath, doc });
}

for (const [, entries] of byId) {
  const name = entries[0].doc.name ?? entries[0].doc._id;
  const canonical = `${toSafeFilename(name)}_${entries[0].doc._id}.json`;

  if (entries.length === 1) {
    const { file, filePath } = entries[0];
    if (file !== canonical) {
      const dest = join(dir, canonical);
      renameSync(filePath, dest);
      console.log(`RENAME: ${file} → ${canonical}`);
    }
  } else {
    // 重複あり: 正規名のファイルを残し、それ以外を削除
    const canonicalPath = join(dir, canonical);
    const keep = entries.find(e => e.file === canonical) ?? entries[0];
    for (const entry of entries) {
      if (entry.file === keep.file) continue;
      unlinkSync(entry.filePath);
      console.log(`DELETE: ${entry.file} (重複, ${keep.file} を保持)`);
    }
    if (keep.file !== canonical) {
      renameSync(keep.filePath, canonicalPath);
      console.log(`RENAME: ${keep.file} → ${canonical}`);
    }
  }
}

console.log('fix-pack-names: 完了');
