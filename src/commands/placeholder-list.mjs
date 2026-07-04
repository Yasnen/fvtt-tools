/**
 * placeholder-list.mjs
 *
 * 翻訳ファイル内のプレースホルダ（===(XXX)=== を含む値）を一覧表示するコマンド。
 *
 * 使い方:
 *   fvtt-tools placeholder-list [オプション]
 *
 * オプション:
 *   --ja    <path>  翻訳ファイルのパス（デフォルト: lang/ja.json）
 *   --base  <path>  上流 en.json のパス（省略時: 英語値を表示しない）
 */

import { resolve } from 'path';
import { existsSync } from 'fs';
import { loadJson, flatten, C, requireValue, findPlaceholder } from '../lib/json-utils.mjs';

const args = process.argv.slice(2);

if (args[0] === '--help' || args[0] === '-h') {
  console.log(`使い方: fvtt-tools placeholder-list [オプション]

翻訳ファイル内の未翻訳プレースホルダ ===(XXX)=== を一覧表示します。
--base を指定すると対応する英語値も表示します。

オプション:
  --ja    <path>  翻訳ファイルのパス（デフォルト: lang/ja.json）
  --base  <path>  上流 en.json のパス（省略時: 英語値を非表示）

例:
  fvtt-tools placeholder-list
  fvtt-tools placeholder-list --ja lang/wfrp4e-ja.json --base lang/en-base.json
`);
  process.exit(0);
}

const CWD = process.cwd();
let jaPath   = resolve(CWD, 'lang/ja.json');
let basePath = null;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--ja':   jaPath   = resolve(requireValue(args, i++, '--ja')); break;
    case '--base': basePath = resolve(requireValue(args, i++, '--base')); break;
    default:
      console.error(`不明なオプション: ${args[i]}`);
      process.exit(1);
  }
}

const ja      = loadJson(jaPath, '翻訳ファイル');
const flatJa  = flatten(ja);

let flatBase = null;
if (basePath) {
  if (!existsSync(basePath)) {
    console.warn(`${C.YELLOW}警告: en-base.json が見つかりません: ${basePath}${C.RESET}`);
    console.warn(`      英語値の表示をスキップします。\n`);
  } else {
    flatBase = flatten(loadJson(basePath, 'en-base.json'));
  }
}

const placeholders = [];
for (const [path, val] of Object.entries(flatJa)) {
  const marker = findPlaceholder(val);
  if (marker !== null) {
    placeholders.push({ path, marker, jaVal: val, enVal: flatBase?.[path] });
  }
}

if (placeholders.length === 0) {
  console.log(`\n${C.GREEN}プレースホルダなし — すべてのキーが翻訳済みです。${C.RESET}\n`);
  process.exit(0);
}

console.log(`\n${C.BOLD}${C.CYAN}=== プレースホルダ一覧 (${placeholders.length}件) ===${C.RESET}`);
console.log(`  翻訳ファイル: ${jaPath}\n`);

for (const { path, marker, jaVal, enVal } of placeholders) {
  console.log(`  ${C.YELLOW}${marker}${C.RESET}  ${path}`);
  console.log(`           現在値: ${JSON.stringify(jaVal)}`);
  if (enVal !== undefined) {
    console.log(`           英語  : ${JSON.stringify(enVal)}`);
  }
}

console.log('');
