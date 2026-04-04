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

import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { loadJson, flatten, C } from '../lib/json-utils.mjs';

// ===== 生テキストへの値置換 =====

/**
 * 生JSONテキストの葉文字列値を replacements に従って置換する。
 * 構造・空白・改行等のフォーマットをすべて保持する。
 * @param {string} raw - 元のJSONテキスト
 * @param {Map<string, string>} replacements - dotPath -> 新しい文字列値
 * @returns {string}
 */
function applyValueReplacements(raw, replacements) {
  if (replacements.size === 0) return raw;

  let i = 0;
  const len = raw.length;
  const keyStack = [];
  const patches = []; // { start, end, newJson }

  function skipWS() {
    while (i < len && (raw[i] === ' ' || raw[i] === '\t' || raw[i] === '\n' || raw[i] === '\r')) i++;
  }

  function readString() {
    const start = i;
    i++; // skip "
    while (i < len) {
      if (raw[i] === '\\') { i += 2; continue; }
      if (raw[i] === '"') { i++; break; }
      i++;
    }
    return { start, end: i, parsed: JSON.parse(raw.slice(start, i)) };
  }

  function parseValue() {
    skipWS();
    if (i >= len) return;
    const ch = raw[i];
    if (ch === '{') {
      i++;
      skipWS();
      while (i < len && raw[i] !== '}') {
        skipWS();
        const { parsed: key } = readString();
        keyStack.push(key);
        skipWS();
        i++; // skip ':'
        parseValue();
        keyStack.pop();
        skipWS();
        if (raw[i] === ',') i++;
        skipWS();
      }
      if (i < len) i++; // skip '}'
    } else if (ch === '[') {
      i++;
      let idx = 0;
      skipWS();
      while (i < len && raw[i] !== ']') {
        keyStack.push(String(idx++));
        parseValue();
        keyStack.pop();
        skipWS();
        if (raw[i] === ',') i++;
        skipWS();
      }
      if (i < len) i++; // skip ']'
    } else if (ch === '"') {
      const path = keyStack.join('.');
      const start = i;
      readString();
      if (replacements.has(path)) {
        patches.push({ start, end: i, newJson: JSON.stringify(replacements.get(path)) });
      }
    } else {
      // number, boolean, null
      while (i < len && raw[i] !== ',' && raw[i] !== '}' && raw[i] !== ']' &&
             raw[i] !== ' ' && raw[i] !== '\t' && raw[i] !== '\n' && raw[i] !== '\r') i++;
    }
  }

  parseValue();

  // 後ろから置換適用（位置がずれないよう逆順）
  patches.sort((a, b) => b.start - a.start);
  let result = raw;
  for (const { start, end, newJson } of patches) {
    result = result.slice(0, start) + newJson + result.slice(end);
  }
  return result;
}

/**
 * extra セクションのエントリを JSON テキストの末尾 '}' の直前に挿入する。
 * @param {string} text
 * @param {Array<[string, unknown]>} extraEntries
 * @param {string} indentStr
 * @returns {string}
 */
function appendExtraSection(text, extraEntries, indentStr) {
  if (extraEntries.length === 0) return text;

  function serializeValue(val, depth) {
    if (val === null || typeof val !== 'object') return JSON.stringify(val);
    const pad   = indentStr.repeat(depth);
    const inner = indentStr.repeat(depth + 1);
    const entries = Object.entries(val);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([k, v], idx) => {
      const comma = idx < entries.length - 1 ? ',' : '';
      return `${inner}${JSON.stringify(k)}: ${serializeValue(v, depth + 1)}${comma}`;
    });
    return `{\n${lines.join('\n')}\n${pad}}`;
  }

  const lines = extraEntries.map(([k, v], idx) => {
    const comma = idx < extraEntries.length - 1 ? ',' : '';
    return `${indentStr}${JSON.stringify(k)}: ${serializeValue(v, 1)}${comma}`;
  });

  const lastBrace = text.lastIndexOf('}');
  return text.slice(0, lastBrace) + ',\n' + lines.join('\n') + '\n' + text.slice(lastBrace);
}

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
  --placeholder-sep <str>   プレースホルダの数字前の文字列（デフォルト: "."）
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
let extraMarker      = null;
let extraPrefixes    = [];
let placeholderSep   = '.';
let dryRun           = false;
let updateBase       = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--base':         basePath      = resolve(args[++i]); break;
    case '--ja':           jaPath        = resolve(args[++i]); break;
    case '--out':          outPath       = resolve(args[++i]); break;
    case '--extra-marker': extraMarker   = args[++i]; break;
    case '--extra-prefix':
      extraPrefixes = args[++i].split(',').map(s => s.trim()).filter(Boolean);
      break;
    case '--placeholder-sep': placeholderSep = args[++i]; break;
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

const newEnRaw = readFileSync(newEnPath, 'utf8');
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
  for (const k of extraTopKeys) {
    if (path === k || path.startsWith(k + '.')) return true;
  }
  return false;
}

function isExtraPrefix(path) {
  return extraPrefixes.some(p => path.startsWith(p));
}

// ===== 三方向マージ（flat map として構築） =====

const warnings = {
  changed: [],
  newKeys: [],
  orphans: [],
};

const counter = { n: 0 };
const flatReplacements = new Map(); // dotPath -> 新しい文字列値

for (const [path, newEnVal] of Object.entries(flatNewEn)) {
  if (typeof newEnVal !== 'string') continue;
  const baseVal = flatBase[path];
  const jaVal   = flatJa[path];

  if (jaVal !== undefined) {
    if (base !== null && baseVal !== undefined && baseVal !== newEnVal) {
      warnings.changed.push({ path, baseVal, newVal: newEnVal, jaVal });
    }
    if (jaVal !== newEnVal) flatReplacements.set(path, jaVal);
  } else {
    const seq = String(++counter.n).padStart(3, '0');
    const placeholder = `===(${placeholderSep}${seq})===`;
    warnings.newKeys.push({ path, newVal: newEnVal, placeholder });
    flatReplacements.set(path, newEnVal + placeholder);
  }
}

// ===== ORPHAN 検出 =====

for (const path of Object.keys(flatJa)) {
  if (path in flatNewEn) continue;
  if (isExtraKey(path)) continue;
  if (isExtraPrefix(path)) continue;
  warnings.orphans.push({ path, jaVal: flatJa[path] });
}

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
  // 新en.json の raw テキストに値だけ置換して出力
  let outText = applyValueReplacements(newEnRaw, flatReplacements);

  // extra セクション（ja.json にのみ存在するマーカー以降のキー）を末尾に追記
  if (markerIdx >= 0) {
    const indentMatch = newEnRaw.match(/\n( +|\t+)"/);
    const indentStr = indentMatch ? indentMatch[1] : '    ';
    const extraEntries = jaTopKeys.slice(markerIdx).map(k => [k, ja[k]]);
    outText = appendExtraSection(outText, extraEntries, indentStr);
  }

  writeFileSync(outPath, outText, 'utf8');
  console.log(`\n出力: ${outPath}`);

  if (updateBase) {
    writeFileSync(basePath, newEnRaw, 'utf8');
    console.log(`更新: ${basePath} (新en.json の内容でベースを更新しました)`);
  }
}

console.log('');
