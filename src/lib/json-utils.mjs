/**
 * json-utils.mjs
 * 共有ユーティリティ: JSON ファイル読み込みとフラット化
 */

import { readFileSync } from 'fs';

/**
 * JSON ファイルを読み込んでパースする。
 * エラー時は標準エラーに出力して process.exit(1)。
 * @param {string} filePath
 * @param {string} label - エラーメッセージ用ラベル
 * @returns {object}
 */
export function loadJson(filePath, label = filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error(`エラー: ファイルが見つかりません: ${filePath} (${label})`);
    } else {
      console.error(`エラー: JSON 解析失敗 ${filePath} (${label}): ${e.message}`);
    }
    process.exit(1);
  }
}

/**
 * ネストされたオブジェクトを { "key.subkey": value } のフラットマップに展開する。
 * @param {object} obj
 * @param {string} prefix
 * @returns {Record<string, unknown>}
 */
export function flatten(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flatten(v, path));
    } else {
      result[path] = v;
    }
  }
  return result;
}

/**
 * オプション引数の値を取得する。次のトークンが存在しない場合はエラーで終了。
 * 使い方: `value = requireValue(args, i++, '--option')` — i++ で呼び出すこと。
 * @param {string[]} args - process.argv スライス済み引数配列
 * @param {number} i - 現在のインデックス（オプション名の位置）
 * @param {string} optName - オプション名（エラーメッセージ用）
 * @returns {string}
 */
export function requireValue(args, i, optName) {
  if (i + 1 >= args.length) {
    console.error(`エラー: ${optName} には値が必要です。`);
    process.exit(1);
  }
  return args[i + 1];
}

// ANSI カラーコード
export const C = {
  RESET:  '\x1b[0m',
  BOLD:   '\x1b[1m',
  RED:    '\x1b[31m',
  GREEN:  '\x1b[32m',
  YELLOW: '\x1b[33m',
  CYAN:   '\x1b[36m',
};
