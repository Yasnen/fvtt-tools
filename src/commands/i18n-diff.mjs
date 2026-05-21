/**
 * i18n-diff.mjs
 *
 * 言語ファイルの差分比較と cherry-pick 可否判定コマンド。
 *
 * 使い方:
 *   fvtt-tools i18n-diff --from <path> --to <path> [options]
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { loadJson, flatten, C, requireValue } from '../lib/json-utils.mjs';

const args = process.argv.slice(2);

function printHelp() {
  console.log(`使い方: fvtt-tools i18n-diff --from <path> --to <path> [options]

Options:
  --from <path>   比較元（cherry-pick 送り出し元）リポジトリルートパス  [必須]
  --to   <path>   比較先（cherry-pick 適用先）リポジトリルートパス      [必須]
  --lang <file>   言語ファイルの相対パス（デフォルト: lang/ja.json）
  --limit <n>     対象コミット数（デフォルト: 20）
  --diff-only     差分レポートのみ表示（cherry-pick判定をスキップ）
  -h, --help      このヘルプを表示
`);
}

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

// 引数パース
let fromPath = null;
let toPath   = null;
let langFile = 'lang/ja.json';
let limit    = 20;
let diffOnly = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--from') {
    fromPath = requireValue(args, i++, '--from');
  } else if (arg === '--to') {
    toPath = requireValue(args, i++, '--to');
  } else if (arg === '--lang') {
    langFile = requireValue(args, i++, '--lang');
  } else if (arg === '--limit') {
    limit = parseInt(requireValue(args, i++, '--limit'), 10);
    if (isNaN(limit)) {
      console.error('エラー: --limit には整数を指定してください。');
      process.exit(1);
    }
  } else if (arg === '--diff-only') {
    diffOnly = true;
  }
}

if (!fromPath) {
  console.error('エラー: --from が未指定です。');
  process.exit(1);
}
if (!toPath) {
  console.error('エラー: --to が未指定です。');
  process.exit(1);
}

// ─── フェーズ1：JSONファイル比較 ───────────────────────────────────────────

const fromJson = loadJson(join(fromPath, langFile), `--from: ${langFile}`);
const toJson   = loadJson(join(toPath,   langFile), `--to: ${langFile}`);

const fromFlat = flatten(fromJson);
const toFlat   = flatten(toJson);

const allKeys = new Set([...Object.keys(fromFlat), ...Object.keys(toFlat)]);

const same     = new Set();
const differ   = new Set();
const fromOnly = new Set();
const toOnly   = new Set();

for (const key of allKeys) {
  const inFrom = key in fromFlat;
  const inTo   = key in toFlat;
  if (inFrom && inTo) {
    if (fromFlat[key] === toFlat[key]) {
      same.add(key);
    } else {
      differ.add(key);
    }
  } else if (inFrom) {
    fromOnly.add(key);
  } else {
    toOnly.add(key);
  }
}

// ─── フェーズ1 出力 ────────────────────────────────────────────────────────

const SEP = '='.repeat(60);
console.log(`\n${C.BOLD}${SEP}${C.RESET}`);
console.log(`${C.BOLD}【言語ファイル差分レポート】  --from: ${fromPath}  --to: ${toPath}${C.RESET}`);
console.log(`${C.BOLD}${SEP}${C.RESET}`);
console.log(`  共通・値も同じ  : ${String(same.size).padStart(4)} 件`);
console.log(`  共通・値が異なる: ${String(differ.size).padStart(4)} 件`);
console.log(`  from のみ       : ${String(fromOnly.size).padStart(4)} 件`);
console.log(`  to のみ         : ${String(toOnly.size).padStart(4)} 件`);

if (differ.size > 0) {
  console.log(`\n--- 値が異なる共通キー ---`);
  for (const key of [...differ].sort()) {
    console.log(`  ${key}`);
    console.log(`    from: ${fromFlat[key]}`);
    console.log(`      to: ${toFlat[key]}`);
  }
}

if (diffOnly) {
  process.exit(0);
}

// ─── フェーズ2：cherry-pick 可否判定 ──────────────────────────────────────

console.log(`\n${C.BOLD}${SEP}${C.RESET}`);
console.log(`${C.BOLD}【cherry-pick 可否判定】（from → to 方向、直近 ${limit} 件）${C.RESET}`);
console.log(`${C.BOLD}${SEP}${C.RESET}`);

const logResult = spawnSync('git', ['log', '--oneline', `-${limit}`, '--', langFile], {
  cwd: fromPath,
  encoding: 'utf8',
});

if (logResult.status !== 0) {
  console.error(`エラー: git log 失敗: ${logResult.stderr.trim()}`);
  process.exit(1);
}

const commits = logResult.stdout.trim().split('\n').filter(Boolean).map(line => {
  const idx = line.indexOf(' ');
  return { hash: line.slice(0, idx), message: line.slice(idx + 1) };
});

if (commits.length === 0) {
  console.log('  コミットが見つかりませんでした。');
  process.exit(0);
}

/**
 * コミットで変更されたキーを返す。
 * @param {string} hash
 * @returns {{ keys: string[] } | { error: string }}
 */
function getTouchedKeys(hash) {
  const afterResult = spawnSync('git', ['show', `${hash}:${langFile}`], {
    cwd: fromPath,
    encoding: 'utf8',
  });
  if (afterResult.status !== 0) {
    return { error: `git show ${hash}:${langFile} 失敗` };
  }

  const beforeResult = spawnSync('git', ['show', `${hash}^:${langFile}`], {
    cwd: fromPath,
    encoding: 'utf8',
  });
  if (beforeResult.status !== 0) {
    return { error: `git show ${hash}^:${langFile} 失敗（初回コミットの可能性）` };
  }

  let afterFlat, beforeFlat;
  try {
    afterFlat = flatten(JSON.parse(afterResult.stdout));
  } catch (e) {
    return { error: `変更後ファイルのJSON解析失敗: ${e.message}` };
  }
  try {
    beforeFlat = flatten(JSON.parse(beforeResult.stdout));
  } catch (e) {
    return { error: `変更前ファイルのJSON解析失敗: ${e.message}` };
  }

  const keys = [];
  for (const key of new Set([...Object.keys(afterFlat), ...Object.keys(beforeFlat)])) {
    if (afterFlat[key] !== beforeFlat[key]) keys.push(key);
  }
  return { keys };
}

/**
 * コミットの cherry-pick 可否を判定する。
 * 優先順位: NG → SKIP → OK → CAUTION
 * @param {string} hash
 * @returns {{ judgment: string, detail: string }}
 */
function classifyCommit(hash) {
  const filesResult = spawnSync('git', ['diff-tree', '--no-commit-id', '-r', '--name-only', hash], {
    cwd: fromPath,
    encoding: 'utf8',
  });

  if (filesResult.status !== 0) {
    return { judgment: 'CAUTION', detail: `git diff-tree 失敗: ${filesResult.stderr.trim()}` };
  }

  const changedFiles = filesResult.stdout.trim().split('\n').filter(Boolean);
  const otherFiles   = changedFiles.filter(f => f !== langFile);

  if (otherFiles.length > 0) {
    return { judgment: 'NG', detail: `言語ファイル以外も変更: ${otherFiles.join(', ')}` };
  }

  const result = getTouchedKeys(hash);
  if (result.error) {
    return { judgment: 'CAUTION', detail: result.error };
  }

  const { keys: touchedKeys } = result;

  // touchedKeys は from リポジトリのキー変化のため toOnly キーは絶対に含まれない（判定不要）

  // SKIP: 全キーが same（または変更なし）
  if (touchedKeys.length === 0 || touchedKeys.every(k => same.has(k))) {
    return { judgment: 'SKIP', detail: '対象ブランチに既に同じ値が存在' };
  }

  // OK: 全キーが differ（to にキーが存在し、パッチ適用で整合が取れる可能性が高い）
  if (touchedKeys.every(k => differ.has(k))) {
    return { judgment: 'OK', detail: 'cherry-pick 可能' };
  }

  // CAUTION: from のみのキーを含む場合
  const fromOnlyTouched = touchedKeys.filter(k => fromOnly.has(k));
  if (fromOnlyTouched.length > 0) {
    const preview = fromOnlyTouched.slice(0, 3).join(', ') + (fromOnlyTouched.length > 3 ? '...' : '');
    return { judgment: 'CAUTION', detail: `from のみのキーを含む: ${preview}` };
  }

  // CAUTION: same と differ が混在、またはその他
  const differTouched = touchedKeys.filter(k => differ.has(k));
  if (differTouched.length > 0) {
    const preview = differTouched.slice(0, 3).join(', ') + (differTouched.length > 3 ? '...' : '');
    return { judgment: 'CAUTION', detail: `値が異なるキーを含む: ${preview}` };
  }

  return { judgment: 'CAUTION', detail: `分類不明のキーを含む: ${touchedKeys.slice(0, 3).join(', ')}` };
}

const ICONS  = { OK: '✅', SKIP: '⏭ ', CAUTION: '⚠ ', NG: '✖ ' };
const COLORS = { OK: C.GREEN, SKIP: C.CYAN, CAUTION: C.YELLOW, NG: C.RED };

const summary = { OK: 0, SKIP: 0, CAUTION: 0, NG: 0 };

for (const { hash, message } of commits) {
  const { judgment, detail } = classifyCommit(hash);
  const color = COLORS[judgment];
  const icon  = ICONS[judgment];
  console.log(`  ${icon} ${color}[${judgment.padEnd(7)}]${C.RESET} ${hash} ${message}`);
  console.log(`               → ${detail}`);
  summary[judgment]++;
}

console.log(`\n${C.BOLD}=== サマリー ===${C.RESET}`);
console.log(`  OK: ${summary.OK} 件 / SKIP: ${summary.SKIP} 件 / CAUTION: ${summary.CAUTION} 件 / NG: ${summary.NG} 件`);
console.log('');
