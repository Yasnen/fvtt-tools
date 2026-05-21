/**
 * sync-journal.mjs
 * Journal ローカライズ JSON を上流の HTML 構造変更に追従させる。
 */

import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { C } from '../lib/json-utils.mjs';

// ===== HTML セグメント分割 =====

const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

/** タグの終端 '>' を返す。属性値内のクォート区間をスキップして誤検出を防ぐ。 */
function findTagEnd(html, start) {
  let i = start;
  const len = html.length;
  while (i < len) {
    const ch = html[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < len && html[i] !== q) i++;
      if (i < len) i++; // skip closing quote
    } else if (ch === '>') {
      return i;
    } else {
      i++;
    }
  }
  return -1;
}

/**
 * HTML をトップレベルのタグ単位でセグメント配列に分割する。
 */
function splitSegments(html) {
  const segments = [];
  let pos = 0;
  const len = html.length;

  while (pos < len) {
    while (pos < len && html.charCodeAt(pos) <= 32) pos++;
    if (pos >= len) break;

    if (html[pos] !== '<') {
      const next = html.indexOf('<', pos);
      if (next < 0) { const t = html.slice(pos).trim(); if (t) segments.push(t); break; }
      const t = html.slice(pos, next).trim();
      if (t) segments.push(t);
      pos = next;
      continue;
    }

    const tagMatch = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(pos));
    if (!tagMatch) {
      const end = findTagEnd(html, pos);
      if (end < 0) break;
      pos = end + 1;
      continue;
    }

    const tag = tagMatch[1].toLowerCase();

    if (VOID_TAGS.has(tag)) {
      const end = findTagEnd(html, pos);
      if (end < 0) break;
      segments.push(html.slice(pos, end + 1));
      pos = end + 1;
      continue;
    }

    let depth = 0;
    let i = pos;

    while (i < len) {
      if (html[i] !== '<') { i++; continue; }

      const rest = html.slice(i);
      const openM = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(rest);
      if (openM && openM[1].toLowerCase() === tag) {
        const tagEnd = findTagEnd(html, i);
        if (tagEnd < 0) { i++; continue; }
        const fullTag = html.slice(i, tagEnd + 1);
        if (!fullTag.endsWith('/>') && !VOID_TAGS.has(tag)) depth++;
        i = tagEnd + 1;
        continue;
      }

      const closeRe = new RegExp(`^<\\/${tag}>`, 'i');
      if (closeRe.test(rest)) {
        depth--;
        i += `</${tag}>`.length;
        if (depth === 0) {
          segments.push(html.slice(pos, i));
          pos = i;
          break;
        }
        continue;
      }

      i++;
    }

    if (depth > 0) {
      segments.push(html.slice(pos).trim());
      break;
    }
  }

  return segments.filter(s => s.trim());
}

// ===== テキスト抽出・比較 =====

function normalizeSegment(seg) {
  return seg.replace(/\s+/g, ' ').trim();
}

/**
 * HTML からタグを除いたテキストコンテンツを取得する。
 */
function extractText(html) {
  let result = '';
  let i = 0;
  const len = html.length;
  while (i < len) {
    if (html[i] === '<') {
      const end = findTagEnd(html, i);
      if (end < 0) break;
      result += ' ';
      i = end + 1;
    } else {
      result += html[i++];
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * HTML のテキストノードをリスト（深さ優先順）で取得する。
 */
function getTextNodes(html) {
  const nodes = [];
  let i = 0;
  const len = html.length;
  while (i < len) {
    if (html[i] === '<') {
      const end = findTagEnd(html, i);
      if (end < 0) break;
      i = end + 1;
    } else {
      const end = html.indexOf('<', i);
      const textEnd = end < 0 ? len : end;
      const trimmed = html.slice(i, textEnd).trim();
      if (trimmed) nodes.push(trimmed);
      i = textEnd;
    }
  }
  return nodes;
}

/**
 * STRUCTURAL 判定：タグ構造のみ変化し、テキスト内容は同一か。
 */
function isStructural(oldSeg, newSeg) {
  if (normalizeSegment(oldSeg) === normalizeSegment(newSeg)) return false;
  return extractText(oldSeg) === extractText(newSeg);
}

/**
 * STRUCTURAL 変換：text_ の構造に JA のテキストノードを適用する。
 * テキストノード数が一致しない場合（<strong> </strong> 等による差異）は JA をそのまま返す。
 */
function applyStructural(newSeg, jaSeg) {
  const jaNodes = getTextNodes(jaSeg);
  if (jaNodes.length === 0) return newSeg;
  if (jaNodes.length !== getTextNodes(newSeg).length) return jaSeg;

  let jaIdx = 0;
  let result = '';
  let i = 0;
  const len = newSeg.length;

  while (i < len) {
    if (newSeg[i] === '<') {
      const end = findTagEnd(newSeg, i);
      if (end < 0) { result += newSeg.slice(i); break; }
      result += newSeg.slice(i, end + 1);
      i = end + 1;
    } else {
      const end = newSeg.indexOf('<', i);
      const textEnd = end < 0 ? len : end;
      const text = newSeg.slice(i, textEnd);
      const trimmed = text.trim();
      if (trimmed && jaIdx < jaNodes.length) {
        const lead = text.slice(0, text.length - text.trimStart().length);
        const trail = text.slice(text.trimEnd().length);
        result += lead + jaNodes[jaIdx++] + trail;
      } else {
        result += text;
      }
      i = textEnd;
    }
  }

  return result;
}

// ===== LCS ベースのセグメント差分 =====

/**
 * oldSegs と newSegs の差分を求め、各操作を分類して返す。
 * @returns {{type: 'EQUAL'|'STRUCTURAL'|'CHANGED'|'INSERT'|'DELETE', oldSeg?: string, newSeg?: string, oldIdx?: number, newIdx?: number}[]}
 */
function diffSegments(oldSegs, newSegs) {
  const m = oldSegs.length;
  const n = newSegs.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (normalizeSegment(oldSegs[i - 1]) === normalizeSegment(newSegs[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const raw = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalizeSegment(oldSegs[i - 1]) === normalizeSegment(newSegs[j - 1])) {
      raw.unshift({ type: 'EQUAL', oldSeg: oldSegs[i - 1], newSeg: newSegs[j - 1], oldIdx: i - 1, newIdx: j - 1 });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: 'INSERT', newSeg: newSegs[j - 1], newIdx: j - 1 });
      j--;
    } else {
      raw.unshift({ type: 'DELETE', oldSeg: oldSegs[i - 1], oldIdx: i - 1 });
      i--;
    }
  }

  // 隣接する DELETE+INSERT を STRUCTURAL/CHANGED に昇格
  const ops = [];
  let di = 0;
  while (di < raw.length) {
    const op = raw[di];
    if (op.type === 'DELETE' && di + 1 < raw.length && raw[di + 1].type === 'INSERT') {
      const ins = raw[di + 1];
      if (isStructural(op.oldSeg, ins.newSeg)) {
        ops.push({ type: 'STRUCTURAL', oldSeg: op.oldSeg, newSeg: ins.newSeg, oldIdx: op.oldIdx, newIdx: ins.newIdx });
      } else {
        ops.push({ type: 'CHANGED', oldSeg: op.oldSeg, newSeg: ins.newSeg, oldIdx: op.oldIdx, newIdx: ins.newIdx });
      }
      di += 2;
    } else {
      ops.push(op);
      di++;
    }
  }

  return ops;
}

// ===== エントリ同期 =====

/**
 * 1 エントリを同期し、更新された text と needsReview を返す。
 */
function syncEntry(oldText, newText, jaText) {
  const oldSegs = splitSegments(oldText);
  const newSegs = splitSegments(newText);
  const jaSegs = splitSegments(jaText);
  // テキストノードを持たない空白専用セグメント（<strong> </strong> 等）を除外してインデックスを正規化
  const jaContentSegs = jaSegs.filter(seg => extractText(seg).trim() !== '');
  const ops = diffSegments(oldSegs, newSegs);

  const resultSegs = [];
  const needsReview = new Set();

  for (const op of ops) {
    switch (op.type) {
      case 'EQUAL': {
        const jaSeg = op.oldIdx < jaContentSegs.length ? jaContentSegs[op.oldIdx] : op.newSeg;
        resultSegs.push(jaSeg);
        break;
      }
      case 'STRUCTURAL': {
        const jaSeg = op.oldIdx < jaContentSegs.length ? jaContentSegs[op.oldIdx] : null;
        resultSegs.push(jaSeg ? applyStructural(op.newSeg, jaSeg) : op.newSeg);
        break;
      }
      case 'CHANGED': {
        const jaSeg = op.oldIdx < jaContentSegs.length ? jaContentSegs[op.oldIdx] : op.oldSeg;
        resultSegs.push(jaSeg);
        needsReview.add('CHANGED');
        break;
      }
      case 'INSERT': {
        resultSegs.push(op.newSeg);
        needsReview.add('INSERTED');
        break;
      }
      case 'DELETE':
        // 削除 - 出力に含めない
        break;
    }
  }

  return { newText: resultSegs.join(''), ops, needsReview: [...needsReview] };
}

// ===== 出力ユーティリティ =====

function detectIndent(raw) {
  const m = raw.match(/\n([ \t]+)"/);
  return m ? m[1] : '  ';
}

/**
 * エントリの出力オブジェクトを構築する（プロパティ順を維持し _needs_review を text_ の後に配置）。
 */
function buildOutputEntry(original, updatedText, needsReview) {
  const out = {};
  let addedNeedsReview = false;
  for (const [k, v] of Object.entries(original)) {
    if (k === '_needs_review') continue;
    out[k] = k === 'text' ? updatedText : v;
    if (k === 'text_') {
      if (needsReview.length > 0) {
        out['_needs_review'] = needsReview;
        addedNeedsReview = true;
      }
    }
  }
  if (!addedNeedsReview && needsReview.length > 0) {
    out['_needs_review'] = needsReview;
  }
  return out;
}

// ===== 引数パース =====

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`使い方: fvtt-tools sync-journal <input.json> [オプション]

引数:
  <input.json>        対象の Babele Journal JSON ファイル（必須）

オプション:
  --out  <path>       出力先（デフォルト: 入力ファイルと同じパス）
  --dry-run           ファイルを変更せず差分・警告のみ表示
  --help / -h         ヘルプ表示
`);
  process.exit(0);
}

let inputPath = null;
let outPath = null;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--out':     outPath = resolve(args[++i]); break;
    case '--dry-run': dryRun = true; break;
    default:
      if (!inputPath && !args[i].startsWith('--')) {
        inputPath = resolve(args[i]);
      } else {
        console.error(`不明なオプション: ${args[i]}`);
        process.exit(1);
      }
  }
}

if (!inputPath) {
  console.error('エラー: 入力ファイルのパスを指定してください。');
  process.exit(1);
}

if (!outPath) outPath = inputPath;

// ===== ファイル読み込み =====

let rawText, data;
try {
  rawText = readFileSync(inputPath, 'utf8');
  data = JSON.parse(rawText);
} catch (e) {
  if (e.code === 'ENOENT') {
    console.error(`エラー: ファイルが見つかりません: ${inputPath}`);
  } else if (e instanceof SyntaxError) {
    console.error(`エラー: JSON 解析失敗: ${inputPath}: ${e.message}`);
  } else {
    console.error(`エラー: ファイルが読み込めません: ${inputPath}: ${e.message}`);
  }
  process.exit(1);
}

// ===== フォーマット検出 =====

/**
 * entries > pages 形式か（フラット形式かを判定する）。
 */
function isEntriesPagesFormat(data) {
  if (!('entries' in data) || data.entries === null || typeof data.entries !== 'object' || Array.isArray(data.entries)) return false;
  const firstEntry = Object.values(data.entries).find(v => v !== null && typeof v === 'object');
  return firstEntry !== undefined && 'pages' in firstEntry && firstEntry.pages !== null && typeof firstEntry.pages === 'object';
}

// ===== 処理 =====

const summary = {
  entries: 0,
  structural: 0,
  changed: new Set(),
  inserted: new Set(),
  deleted: 0,
};

const structuralDetails = []; // { entryName, count }
const changedDetails = [];    // { entryName, oldSeg, newSeg }
const insertedDetails = [];   // { entryName, newSeg }
const deletedDetails = [];    // { entryName, oldSeg }

/**
 * 1ページを処理する。
 * ops が null の場合は処理対象外（_text なし・text_ なし）。
 */
function processPage(page, label) {
  if (!('_text' in page)) {
    console.warn(`警告: _text フィールドがありません。スキップ: ${label}`);
    return { processedPage: page, ops: null };
  }
  if (!('text_' in page)) {
    return { processedPage: page, ops: null };
  }
  const jaText = page.text ?? '';
  const { newText, ops, needsReview } = syncEntry(page._text, page.text_, jaText);
  return { processedPage: buildOutputEntry(page, newText, needsReview), ops };
}

/**
 * 処理結果を集計する。
 */
function collectOps(ops, label) {
  summary.entries++;
  let structCount = 0;
  for (const op of ops) {
    switch (op.type) {
      case 'STRUCTURAL':
        structCount++;
        summary.structural++;
        break;
      case 'CHANGED':
        summary.changed.add(label);
        changedDetails.push({ entryName: label, oldSeg: op.oldSeg, newSeg: op.newSeg });
        break;
      case 'INSERT':
        summary.inserted.add(label);
        insertedDetails.push({ entryName: label, newSeg: op.newSeg });
        break;
      case 'DELETE':
        summary.deleted++;
        deletedDetails.push({ entryName: label, oldSeg: op.oldSeg });
        break;
    }
  }
  if (structCount > 0) {
    structuralDetails.push({ entryName: label, count: structCount });
  }
}

let output;

if (isEntriesPagesFormat(data)) {
  // entries > pages 形式
  output = {};
  for (const [topKey, topVal] of Object.entries(data)) {
    if (topKey !== 'entries') { output[topKey] = topVal; continue; }

    output.entries = {};
    for (const [journalName, journal] of Object.entries(topVal)) {
      if (typeof journal !== 'object' || journal === null || !journal.pages) {
        output.entries[journalName] = journal;
        continue;
      }

      const processedPages = {};
      for (const [pageName, page] of Object.entries(journal.pages)) {
        if (typeof page !== 'object' || page === null) {
          processedPages[pageName] = page;
          continue;
        }
        const label = `${journalName} / ${pageName}`;
        const { processedPage, ops } = processPage(page, label);
        if (ops !== null) collectOps(ops, label);
        processedPages[pageName] = processedPage;
      }

      // プロパティ順を維持しつつ pages を差し替え
      const outputJournal = {};
      for (const [k, v] of Object.entries(journal)) {
        outputJournal[k] = k === 'pages' ? processedPages : v;
      }
      output.entries[journalName] = outputJournal;
    }
  }
} else {
  // フラット形式
  output = {};
  for (const [entryName, entry] of Object.entries(data)) {
    if (typeof entry !== 'object' || entry === null) {
      output[entryName] = entry;
      continue;
    }
    const { processedPage, ops } = processPage(entry, entryName);
    if (ops !== null) collectOps(ops, entryName);
    output[entryName] = processedPage;
  }
}

// ===== コンソール出力 =====

if (structuralDetails.length > 0) {
  console.log(`\n${C.BOLD}${C.CYAN}[STRUCTURAL] 構造のみ変化したセグメント（自動適用）${C.RESET}`);
  for (const { entryName, count } of structuralDetails) {
    console.log(`  ${entryName}: ${count} セグメント`);
  }
}

if (changedDetails.length > 0) {
  console.log(`\n${C.BOLD}${C.YELLOW}[CHANGED] テキストも変化したセグメント（要レビュー）${C.RESET}`);
  for (const { entryName, oldSeg, newSeg } of changedDetails) {
    console.log(`  ${C.YELLOW}${entryName}${C.RESET}`);
    console.log(`    旧原文: ${oldSeg.slice(0, 80)}${oldSeg.length > 80 ? '...' : ''}`);
    console.log(`    新原文: ${newSeg.slice(0, 80)}${newSeg.length > 80 ? '...' : ''}`);
  }
}

if (insertedDetails.length > 0) {
  console.log(`\n${C.BOLD}${C.GREEN}[INSERTED] 新規追加セグメント（要レビュー）${C.RESET}`);
  for (const { entryName, newSeg } of insertedDetails) {
    console.log(`  ${C.GREEN}${entryName}${C.RESET}`);
    console.log(`    追加: ${newSeg.slice(0, 80)}${newSeg.length > 80 ? '...' : ''}`);
  }
}

if (deletedDetails.length > 0) {
  console.log(`\n${C.BOLD}${C.RED}[DELETED] 削除されたセグメント${C.RESET}`);
  for (const { entryName, oldSeg } of deletedDetails) {
    console.log(`  ${C.RED}${entryName}${C.RESET}`);
    console.log(`    削除: ${oldSeg.slice(0, 80)}${oldSeg.length > 80 ? '...' : ''}`);
  }
}

console.log(`\n${C.BOLD}${C.CYAN}=== 同期サマリー ===${C.RESET}`);
console.log(`  処理エントリ数        : ${summary.entries}`);
console.log(`  STRUCTURAL（自動）    : ${summary.structural} セグメント`);
console.log(`  CHANGED（要レビュー） : ${summary.changed.size} エントリ`);
console.log(`  INSERTED（要レビュー）: ${summary.inserted.size} エントリ`);
console.log(`  DELETED               : ${summary.deleted} セグメント`);

// ===== ファイル書き込み =====

if (dryRun) {
  console.log(`\n${C.YELLOW}[dry-run] ファイルへの書き込みをスキップしました。${C.RESET}`);
} else {
  const indent = detectIndent(rawText);
  writeFileSync(outPath, JSON.stringify(output, null, indent) + '\n', 'utf8');
  console.log(`\n出力: ${outPath}`);
}

console.log('');
