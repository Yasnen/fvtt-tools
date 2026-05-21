/**
 * validate.mjs
 *
 * Babele 辞書 JSON の構造チェックコマンド。
 *
 * 使い方:
 *   fvtt-tools validate <path> [<path> ...]
 *
 * <path> にはファイルまたはディレクトリを指定できる。
 * ディレクトリを指定した場合は配下の *.json を対象とする。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';
import { C } from '../lib/json-utils.mjs';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`使い方: fvtt-tools validate <path> [<path> ...]

Babele 辞書 JSON の構造チェックを行います。
ディレクトリを指定した場合は配下の *.json を再帰せず 1 段のみ対象とします。

チェック項目:
  - JSON 構文エラー
  - 必須フィールド: label
  - entries または mapping のいずれかが存在するか
  - mapping の各エントリが path フィールドを持つか（オブジェクト形式の場合）
  - entries の各ドキュメントに name フィールドがあるか

例:
  fvtt-tools validate compendium/
  fvtt-tools validate compendium/wfrp4e-core.items.json
`);
  process.exit(0);
}

/** 対象ファイルを収集 */
function collectFiles(paths) {
  const files = [];
  for (const p of paths) {
    const abs = resolve(p);
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      console.error(`エラー: パスにアクセスできません: ${abs}`);
      process.exit(1);
    }
    if (stat.isDirectory()) {
      for (const f of readdirSync(abs)) {
        if (extname(f) === '.json') files.push(join(abs, f));
      }
    } else {
      files.push(abs);
    }
  }
  return files;
}

const files = collectFiles(args);

if (files.length === 0) {
  console.error('エラー: 対象ファイルが見つかりません。');
  process.exit(1);
}

let errorCount = 0;
let warnCount  = 0;

/** @param {string} msg */
function error(msg) {
  console.log(`  ${C.RED}[ERROR]${C.RESET} ${msg}`);
  errorCount++;
}

/** @param {string} msg */
function warn(msg) {
  console.log(`  ${C.YELLOW}[WARN] ${C.RESET} ${msg}`);
  warnCount++;
}

function ok(msg) {
  console.log(`  ${C.GREEN}[OK]   ${C.RESET} ${msg}`);
}

for (const file of files) {
  console.log(`\n${C.BOLD}${file}${C.RESET}`);

  // JSON 構文チェック
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    error(`JSON 構文エラー: ${e.message}`);
    continue;
  }

  // label
  if (!doc.label) {
    error('"label" フィールドがありません');
  } else {
    ok(`label: "${doc.label}"`);
  }

  // entries または mapping
  const hasEntries = doc.entries != null;
  const hasMapping = doc.mapping != null;
  if (!hasEntries && !hasMapping) {
    warn('"entries" と "mapping" のどちらも存在しません');
  }

  // mapping 検証
  if (hasMapping) {
    let mappingErrors = 0;
    for (const [key, val] of Object.entries(doc.mapping)) {
      if (typeof val === 'object' && val !== null && !val.path) {
        error(`mapping["${key}"] にオブジェクト形式で "path" フィールドがありません`);
        mappingErrors++;
      }
    }
    if (mappingErrors === 0) ok(`mapping: ${Object.keys(doc.mapping).length} エントリ — OK`);
  }

  // entries 検証
  if (hasEntries) {
    if (typeof doc.entries !== 'object') {
      error('"entries" はオブジェクトまたは配列である必要があります');
    } else if (Array.isArray(doc.entries)) {
      // 配列形式: 各エントリに id または name が必要
      let missingIdOrName = 0;
      for (const val of doc.entries) {
        if (typeof val === 'object' && val !== null && val.id === undefined && val.name === undefined) {
          missingIdOrName++;
        }
      }
      if (missingIdOrName > 0) {
        warn(`entries(配列) 内 ${missingIdOrName} 件のドキュメントに "id"/"name" フィールドがありません`);
      } else {
        ok(`entries(配列): ${doc.entries.length} ドキュメント — OK`);
      }
    } else {
      // オブジェクト形式: 各エントリに name が推奨
      let missingName = 0;
      for (const val of Object.values(doc.entries)) {
        if (typeof val === 'object' && val !== null && val.name === undefined) {
          missingName++;
        }
      }
      if (missingName > 0) {
        warn(`entries 内 ${missingName} 件のドキュメントに "name" フィールドがありません`);
      } else {
        ok(`entries: ${Object.keys(doc.entries).length} ドキュメント — OK`);
      }
    }
  }
}

// サマリー
console.log(`\n${C.BOLD}${C.CYAN}=== 検証サマリー ===${C.RESET}`);
console.log(`  対象ファイル数: ${files.length}`);
if (errorCount > 0) {
  console.log(`  ${C.RED}ERROR: ${errorCount} 件${C.RESET}`);
} else {
  console.log(`  ${C.GREEN}ERROR: 0 件${C.RESET}`);
}
if (warnCount > 0) {
  console.log(`  ${C.YELLOW}WARN : ${warnCount} 件${C.RESET}`);
} else {
  console.log(`  WARN : 0 件`);
}
console.log('');

if (errorCount > 0) process.exit(1);
