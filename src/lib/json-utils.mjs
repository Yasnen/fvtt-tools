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

// ANSI カラーコード
export const C = {
  RESET:  '\x1b[0m',
  BOLD:   '\x1b[1m',
  RED:    '\x1b[31m',
  GREEN:  '\x1b[32m',
  YELLOW: '\x1b[33m',
  CYAN:   '\x1b[36m',
};
