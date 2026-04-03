/**
 * sync-lang.mjs
 *
 * 上流の en.json が更新された際に翻訳ファイルを追従させるコマンド。
 * 三方向マージを用いて、英語値の変更・新規キー・削除キーを区別して処理する。
 *
 * 使い方:
 *   fvtt-tools sync-lang <新en.json のパス> [オプション]
 *
 * オプション:
 *   --base           <path>    旧en.jsonのパス（デフォルト: lang/en-base.json）
 *   --ja             <path>    現在の翻訳ファイルのパス（デフォルト: lang/ja.json）
 *   --out            <path>    出力先（デフォルト: --ja と同じパス）
 *   --extra-marker   <key>     extraセクション開始マーカーキー（省略時: 機能無効）
 *   --extra-prefix   <prefix>  ORPHAN除外するキープレフィックス（省略時: なし）
 *   --dry-run                  ファイルを変更せず差分・警告のみ表示
 *   --update-base              同期後に en-base.json を新en.jsonで更新
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { loadJson, flatten, C } from '../lib/json-utils.mjs';

// ===== 引数パース =====

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`使い方: fvtt-tools sync-lang <新en.json のパス> [オプション]

オプション:
  --base           <path>    旧en.jsonのパス（デフォルト: lang/en-base.json）
  --ja             <path>    現在の翻訳ファイルのパス（デフォルト: lang/ja.json）
  --out            <path>    出力先（デフォルト: --ja と同じパス）
  --extra-marker   <key>     extraセクション開始マーカーキー（省略時: 機能無効）
  --extra-prefix   <prefix>  ORPHAN除外するキープレフィックス（カンマ区切りで複数指定可）
  --dry-run                  ファイルを変更せず差分・警告のみ表示
  --update-base              同期後に en-base.json を新en.jsonで更新

例:
  fvtt-tools sync-lang /path/to/en.json --dry-run
  fvtt-tools sync-lang /path/to/en.json \\
    --ja lang/wfrp4e-ja.json \\
    --extra-marker "WFRP4eJaJp.comment.core-en.json" \\
    --extra-prefix "WFRP4eJaJp." \\
    --update-base
`);
  process.exit(0);
}

const CWD = process.cwd();

let newEnPath     = null;
let basePath      = resolve(CWD, 'lang/en-base.json');
let jaPath        = resolve(CWD, 'lang/ja.json');
let outPath       = null;
let extraMarker   = null;
let extraPrefixes = [];
let dryRun        = false;
let updateBase    = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--base':         basePath      = resolve(args[++i]); break;
    case '--ja':           jaPath        = resolve(args[++i]); break;
    case '--out':          outPath       = resolve(args[++i]); break;
    case '--extra-marker': extraMarker   = args[++i]; break;
    case '--extra-prefix':
      extraPrefixes = args[++i].split(',').map(s => s.trim()).filter(Boolean);
      break;
    case '--dry-run':      dryRun        = true; break;
    case '--update-base':  updateBase    = true; break;
    default:
      if (!newEnPath && !args[i].startsWith('--')) {
        newEnPath = resolve(args[i]);
      } else {
        console.error(`不明なオプション: ${args[i]}`);
        process.exit(1);
      }
  }
}

if (!newEnPath) {
  console.error('エラー: 新en.jsonのパスを指定してください。');
  process.exit(1);
}

if (!outPath) outPath = jaPath;

// ===== ファイル読み込み =====

const newEn = loadJson(newEnPath, '新en.json');
const ja    = loadJson(jaPath,    '翻訳ファイル');

let base = null;
try {
  base = loadJson(basePath, 'en-base.json');
} catch {
  // en-base.json が存在しない場合は CHANGED 検出をスキップ
}

// ===== フラット化 =====

const flatNewEn = flatten(newEn);
const flatBase  = base ? flatten(base) : {};
const flatJa    = flatten(ja);

// ===== extra セクション特定 =====

const jaTopKeys  = Object.keys(ja);
const markerIdx  = extraMarker ? jaTopKeys.indexOf(extraMarker) : -1;
const extraTopKeys = new Set(markerIdx >= 0 ? jaTopKeys.slice(markerIdx) : []);

function isExtraKey(path) {
  const topKey = path.split('.')[0];
  return extraTopKeys.has(topKey);
}

function isExtraPrefix(path) {
  return extraPrefixes.some(p => path.startsWith(p));
}

// ===== 三方向マージ =====

const warnings = {
  changed: [],
  newKeys: [],
  orphans: [],
};

const counter = { n: 0 };

function mergeSection(newEnObj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(newEnObj)) {
    const path = prefix ? `${prefix}.${k}` : k;

    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = mergeSection(v, path);
    } else {
      const baseVal  = flatBase[path];
      const jaVal    = flatJa[path];
      const newEnVal = v;

      if (jaVal !== undefined) {
        if (base !== null && baseVal !== undefined && baseVal !== newEnVal) {
          warnings.changed.push({ path, baseVal, newVal: newEnVal, jaVal });
        }
        result[k] = jaVal;
      } else {
        const seq = String(++counter.n).padStart(2, '0');
        const placeholder = `===(.${seq})===`;
        warnings.newKeys.push({ path, newVal: newEnVal, placeholder });
        result[k] = placeholder;
      }
    }
  }
  return result;
}

const mainOutput = mergeSection(newEn);

// ===== ORPHAN 検出 =====

for (const path of Object.keys(flatJa)) {
  if (path in flatNewEn) continue;
  if (isExtraKey(path)) continue;
  if (isExtraPrefix(path)) continue;
  warnings.orphans.push({ path, jaVal: flatJa[path] });
}

// ===== extra セクションの構築 =====

const extraOutput = {};
if (markerIdx >= 0) {
  for (const k of jaTopKeys.slice(markerIdx)) {
    extraOutput[k] = ja[k];
  }
}

// ===== 出力オブジェクト合成 =====

const output = { ...mainOutput, ...extraOutput };

// ===== 警告の表示 =====

if (warnings.changed.length > 0) {
  console.log(`\n${C.BOLD}${C.YELLOW}[CHANGED] 英語値が変わったキー（要確認: 再翻訳が必要な場合あり）${C.RESET}`);
  for (const { path, baseVal, newVal, jaVal } of warnings.changed) {
    console.log(`  ${C.YELLOW}${path}${C.RESET}`);
    console.log(`    旧英語: ${JSON.stringify(baseVal)}`);
    console.log(`    新英語: ${JSON.stringify(newVal)}`);
    console.log(`    現在のja: ${JSON.stringify(jaVal)}`);
  }
}

if (warnings.newKeys.length > 0) {
  console.log(`\n${C.BOLD}${C.GREEN}[NEW] 新規キー（プレースホルダを付与）${C.RESET}`);
  for (const { path, newVal, placeholder } of warnings.newKeys) {
    console.log(`  ${C.GREEN}${path}${C.RESET} → ${placeholder}`);
    console.log(`    英語: ${JSON.stringify(newVal)}`);
  }
}

if (warnings.orphans.length > 0) {
  console.log(`\n${C.BOLD}${C.RED}[ORPHAN] 翻訳ファイルにのみ存在するキー（新en.jsonに対応キーなし）${C.RESET}`);
  for (const { path, jaVal } of warnings.orphans) {
    console.log(`  ${C.RED}${path}${C.RESET}: ${JSON.stringify(jaVal)}`);
  }
}

// ===== サマリー =====

console.log(`\n${C.BOLD}${C.CYAN}=== 同期サマリー ===${C.RESET}`);
console.log(`  新en.jsonキー数  : ${Object.keys(flatNewEn).length}`);
console.log(`  CHANGED（要確認）: ${warnings.changed.length}`);
console.log(`  NEW（新規）      : ${warnings.newKeys.length}`);
console.log(`  ORPHAN（孤立）   : ${warnings.orphans.length}`);
if (!base) {
  console.log(`  ${C.YELLOW}注意: en-base.json が見つからないため CHANGED 検出はスキップされました。${C.RESET}`);
  console.log(`        初回同期後に --update-base で en-base.json を作成してください。`);
}

// ===== ファイル書き込み =====

if (dryRun) {
  console.log(`\n${C.YELLOW}[dry-run] ファイルへの書き込みをスキップしました。${C.RESET}`);
} else {
  writeFileSync(outPath, JSON.stringify(output, null, 4) + '\n', 'utf8');
  console.log(`\n出力: ${outPath}`);

  if (updateBase) {
    writeFileSync(basePath, JSON.stringify(newEn, null, 4) + '\n', 'utf8');
    console.log(`更新: ${basePath} (新en.json の内容でベースを更新しました)`);
  }
}

console.log('');
