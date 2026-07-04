/**
 * json-utils.test.mjs
 * findPlaceholder / PLACEHOLDER_RE のユニットテスト。
 * 追加依存なしで実行できるよう Node 組み込みの node:test を使用する。
 *   実行: npm test  （= node --test）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findPlaceholder, PLACEHOLDER_RE } from '../src/lib/json-utils.mjs';

test('sync-lang が英語値末尾に追記したデフォルト形式を検出する', () => {
  // sync-lang は `newEnVal + placeholder` を出力する（値全体はプレースホルダではない）
  assert.equal(findPlaceholder('Some new string===(.001)==='), '===(.001)===');
});

test('値全体がプレースホルダの場合も検出する', () => {
  assert.equal(findPlaceholder('===(.001)==='), '===(.001)===');
});

test('プレースホルダが値の途中にあっても検出する', () => {
  assert.equal(findPlaceholder('前===(.007)===後'), '===(.007)===');
});

test('--placeholder-sep を変更した形式（_）も検出する', () => {
  assert.equal(findPlaceholder('text===(_001)==='), '===(_001)===');
});

test('--placeholder-digits を変更した桁数も検出する', () => {
  assert.equal(findPlaceholder('text===(.42)==='), '===(.42)===');
});

test('区切りなし（===()===）でも検出する', () => {
  assert.equal(findPlaceholder('text===()==='), '===()===');
});

test('複数含む場合は最初の1件を返す', () => {
  assert.equal(findPlaceholder('===(.001)======(.002)==='), '===(.001)===');
});

test('プレースホルダを含まない文字列は null', () => {
  assert.equal(findPlaceholder('翻訳済みの文字列'), null);
});

test('=== を含むが括弧のない文字列は null（誤検出しない）', () => {
  assert.equal(findPlaceholder('=== 見出し ==='), null);
});

test('--placeholder-mark をデフォルト === から変更した形式は検出対象外（既知の制約）', () => {
  // ドキュメント化された制約: マークを変更すると report/placeholder-list では検出されない
  assert.equal(findPlaceholder('text###(.001)###'), null);
});

test('文字列以外の入力は null を返す', () => {
  assert.equal(findPlaceholder(123), null);
  assert.equal(findPlaceholder(null), null);
  assert.equal(findPlaceholder(undefined), null);
  assert.equal(findPlaceholder(true), null);
  assert.equal(findPlaceholder(['===(.001)===']), null);
  assert.equal(findPlaceholder({ v: '===(.001)===' }), null);
});

test('PLACEHOLDER_RE はグローバルフラグを持たない（exec の lastState に依存しない）', () => {
  // g フラグがあると exec 呼び出し間で lastIndex が進み判定が不安定になる
  assert.equal(PLACEHOLDER_RE.flags, '');
  // 同じ入力を繰り返し判定しても結果が変わらないこと
  assert.equal(findPlaceholder('===(.001)==='), '===(.001)===');
  assert.equal(findPlaceholder('===(.001)==='), '===(.001)===');
});
