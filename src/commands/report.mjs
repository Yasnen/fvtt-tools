/**
 * report.mjs
 *
 * 翻訳ファイルのカバレッジをレポート表示するコマンド。
 *
 * 使い方:
 *   fvtt-tools report [オプション]
 *
 * オプション:
 *   --ja    <path>  翻訳ファイルのパス（デフォルト: lang/ja.json）
 *   --base  <path>  上流 en.json のパス（デフォルト: lang/en-base.json）
 *   --extra-prefix <prefix>  集計から除外するキープレフィックス（カンマ区切り）
 */

import { resolve } from 'path';
import { loadJson, flatten, C, requireValue, findPlaceholder } from '../lib/json-utils.mjs';

const args = process.argv.slice(2);

if (args[0] === '--help' || args[0] === '-h') {
  console.log(`使い方: fvtt-tools report [オプション]

オプション:
  --ja    <path>    翻訳ファイルのパス（デフォルト: lang/ja.json）
  --base  <path>    上流 en.json のパス（デフォルト: lang/en-base.json）
  --extra-prefix <prefix>  集計から除外するキープレフィックス（カンマ区切り）

判定ロジック:
  ===(XXX)=== を含む値  → プレースホルダ（未翻訳）
  ja値 === en値          → 英語のまま（未翻訳）
  それ以外               → 翻訳済み

例:
  fvtt-tools report
  fvtt-tools report --ja lang/wfrp4e-ja.json --base lang/en-base.json
  fvtt-tools report --extra-prefix "WFRP4eJaJp."
`);
  process.exit(0);
}

const CWD = process.cwd();
let jaPath        = resolve(CWD, 'lang/ja.json');
let basePath      = resolve(CWD, 'lang/en-base.json');
let extraPrefixes = [];

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--ja':           jaPath   = resolve(requireValue(args, i++, '--ja')); break;
    case '--base':         basePath = resolve(requireValue(args, i++, '--base')); break;
    case '--extra-prefix':
      extraPrefixes = requireValue(args, i++, '--extra-prefix').split(',').map(s => s.trim()).filter(Boolean);
      break;
    default:
      console.error(`不明なオプション: ${args[i]}`);
      process.exit(1);
  }
}

const ja   = loadJson(jaPath,   '翻訳ファイル');
const base = loadJson(basePath, 'en-base.json');

const flatJa   = flatten(ja);
const flatBase = flatten(base);

function isExtraPrefix(path) {
  return extraPrefixes.some(p => path.startsWith(p));
}

// en-base.json のキーを基準に集計
let total       = 0;
let translated  = 0;
let placeholder = 0;
let untranslated= 0;

for (const [path, enVal] of Object.entries(flatBase)) {
  if (isExtraPrefix(path)) continue;
  total++;

  const jaVal = flatJa[path];
  if (jaVal === undefined) {
    untranslated++;
    continue;
  }
  if (findPlaceholder(jaVal) !== null) {
    placeholder++;
  } else if (jaVal === enVal) {
    untranslated++;
  } else {
    translated++;
  }
}

const pct = (n) => total > 0 ? `${((n / total) * 100).toFixed(1).padStart(5)}%` : '  N/A';
const pad = (n) => String(n).padStart(5);

console.log(`\n${C.BOLD}${C.CYAN}=== 翻訳カバレッジ レポート ===${C.RESET}`);
console.log(`  翻訳ファイル  : ${jaPath}`);
console.log(`  ベース(en)    : ${basePath}`);
console.log('');
console.log(`  総キー数（en）  : ${pad(total)}`);
console.log(`  ${C.GREEN}翻訳済み${C.RESET}        : ${pad(translated)}  (${pct(translated)})`);
console.log(`  ${C.YELLOW}プレースホルダ${C.RESET}  : ${pad(placeholder)}  (${pct(placeholder)})  ← ===(XXX)===`);
console.log(`  ${C.RED}未翻訳（英語値）${C.RESET}: ${pad(untranslated)}  (${pct(untranslated)})`);
console.log('');
