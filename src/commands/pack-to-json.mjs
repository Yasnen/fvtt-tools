/**
 * pack-to-json.mjs
 *
 * Foundry VTT モジュール/システムの全 LevelDB パックを JSON に変換する。
 * module.json / system.json を読み取り、全 packs を一括処理する。
 * @foundryvtt/foundryvtt-cli の extractPack Node.js API を使用する。
 *
 * 使い方:
 *   fvtt-tools pack-to-json <module-dir> [オプション]
 *
 * オプション:
 *   --out <dir>      出力ベースディレクトリ (デフォルト: カレント)
 *   --merge          各 pack を <moduleId>_<packName>.json にまとめる
 *   --clean          出力先を先にクリアする
 *   --folders        フォルダ構造を再現する (--merge と併用不可)
 *   --omit-volatile  volatile フィールド（_stats 等）を除外
 *   --yaml           JSON の代わりに YAML で出力 (--merge と併用不可)
 */

import { resolve, join, extname } from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { mkdtemp, readdir, readFile, writeFile, rm, stat, mkdir } from 'fs/promises';
import { tmpdir } from 'os';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`使い方: fvtt-tools pack-to-json <module-dir> [オプション]

Foundry VTT モジュール/システムの全 pack を JSON に変換します。
module.json または system.json を読み取り、全 packs を一括処理します。
@foundryvtt/foundryvtt-cli の extractPack API を内部で使用します。

オプション:
  --out <dir>      出力ベースディレクトリ (デフォルト: カレント)
  --merge          各 pack を <moduleId>_<packName>.json にまとめる
  --clean          出力先を先にクリアする
  --folders        フォルダ構造を再現する (--merge と併用不可)
  --omit-volatile  volatile フィールド（_stats 等）を除外
  --yaml           JSON の代わりに YAML で出力 (--merge と併用不可)

出力命名規則:
  通常:   <out>/<moduleId>_<packName>/
  --merge: <out>/<moduleId>_<packName>.json

例:
  fvtt-tools pack-to-json ~/foundry/data/modules/wfrp4e-core
  fvtt-tools pack-to-json ~/foundry/data/modules/wfrp4e-core --out ~/tmp --merge
  fvtt-tools pack-to-json ~/foundry/data/systems/wfrp4e --omit-volatile --clean
`);
  process.exit(0);
}

let moduleDir    = null;
let outBase      = resolve('.');
let merge        = false;
let clean        = false;
let folders      = false;
let omitVolatile = false;
let yaml         = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--out':          outBase      = resolve(args[++i]); break;
    case '--merge':        merge        = true; break;
    case '--clean':        clean        = true; break;
    case '--folders':      folders      = true; break;
    case '--omit-volatile':omitVolatile = true; break;
    case '--yaml':         yaml         = true; break;
    default:
      if (!moduleDir && !args[i].startsWith('--')) {
        moduleDir = resolve(args[i]);
      } else {
        console.error(`不明なオプション: ${args[i]}`);
        process.exit(1);
      }
  }
}

if (!moduleDir) {
  console.error('エラー: モジュール/システムディレクトリのパスを指定してください。');
  process.exit(1);
}

if (merge && yaml) {
  console.error('エラー: --merge と --yaml は同時に使用できません。');
  process.exit(1);
}

if (merge && folders) {
  console.error('エラー: --merge と --folders は同時に使用できません。');
  process.exit(1);
}

// マニフェスト読み込み
const manifest = await loadManifest(moduleDir);
if (!manifest) {
  console.error(`エラー: ${moduleDir} に module.json / system.json が見つかりません。`);
  process.exit(1);
}

const moduleId = manifest.id;
const packs    = manifest.packs ?? [];

if (packs.length === 0) {
  console.error(`エラー: ${moduleId} に packs が定義されていません。`);
  process.exit(1);
}

console.log(`モジュール: ${moduleId} (${packs.length} packs)`);

// extractPack のロード
let extractPack;
try {
  const cwdRequire = createRequire(resolve(process.cwd(), '__placeholder__.js'));
  const pkgPath    = cwdRequire.resolve('@foundryvtt/foundryvtt-cli');
  ({ extractPack } = await import(pathToFileURL(pkgPath).href));
} catch {
  console.error('エラー: @foundryvtt/foundryvtt-cli が見つかりません。');
  console.error('       npm install --save-dev @foundryvtt/foundryvtt-cli でインストールしてください。');
  process.exit(1);
}

// 全 pack を処理
for (const pack of packs) {
  const packPath  = resolve(moduleDir, pack.path);
  const outName   = `${moduleId}_${pack.name}`;

  const packExists = await stat(packPath).catch(() => null);
  if (!packExists?.isDirectory()) {
    console.warn(`[スキップ] ${pack.name}: ${packPath} が見つかりません。`);
    continue;
  }

  if (!merge) {
    const outDir = join(outBase, outName);
    await mkdir(outDir, { recursive: true });
    console.log(`[pack-to-json] ${outName} → ${outDir}`);
    await extractPack(packPath, outDir, { log: true, clean, folders, omitVolatile, yaml });
  } else {
    const outFile = join(outBase, `${outName}.json`);
    const tmpDir  = await mkdtemp(join(tmpdir(), 'fvtt-pack-'));
    try {
      await extractPack(packPath, tmpDir, { log: false, clean: false, folders: false, omitVolatile, yaml: false });
      const files   = await collectJsonFiles(tmpDir);
      const entries = await Promise.all(files.map(async f => JSON.parse(await readFile(f, 'utf8'))));
      const output  = {
        moduleId,
        name:    pack.name,
        label:   pack.label,
        type:    pack.type,
        path:    pack.path,
        count:   entries.length,
        entries,
      };
      await writeFile(outFile, JSON.stringify(output, null, 2), 'utf8');
      console.log(`[pack-to-json] ${outName}: ${entries.length} 件 → ${outFile}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }
}

async function loadManifest(dir) {
  for (const name of ['module.json', 'system.json']) {
    const p = join(dir, name);
    const s = await stat(p).catch(() => null);
    if (s?.isFile()) return JSON.parse(await readFile(p, 'utf8'));
  }
  return null;
}

async function collectJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files   = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJsonFiles(full));
    } else if (extname(entry.name) === '.json') {
      files.push(full);
    }
  }
  return files;
}
