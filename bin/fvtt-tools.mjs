#!/usr/bin/env node
/**
 * fvtt-tools CLI エントリポイント
 * サブコマンドを対応するコマンドモジュールにルーティングする。
 */

const COMMANDS = {
  'sync-lang':       () => import('../src/commands/sync-lang.mjs'),
  'fix-pack-names':  () => import('../src/commands/fix-pack-names.mjs'),
  'pack-to-json':    () => import('../src/commands/pack-to-json.mjs'),
  'report':          () => import('../src/commands/report.mjs'),
  'validate':        () => import('../src/commands/validate.mjs'),
  'placeholder-list':() => import('../src/commands/placeholder-list.mjs'),
  'i18n-diff':       () => import('../src/commands/i18n-diff.mjs'),
};

const [,, command, ...rest] = process.argv;

if (!command || command === '--help' || command === '-h') {
  console.log(`使い方: fvtt-tools <command> [options]

コマンド:
  sync-lang        上流 en.json と翻訳ファイルを三方向マージで同期
  fix-pack-names   fvtt unpack 後の非ASCII ファイル名を修正
  pack-to-json     NeDB(.db)パックファイルを個別の JSON ファイルに変換
  report           翻訳カバレッジをレポート表示
  validate         Babele 辞書 JSON の構造チェック
  placeholder-list 翻訳ファイル内のプレースホルダを一覧表示
  i18n-diff        言語ファイルの差分比較と cherry-pick 可否判定

各コマンドの詳細: fvtt-tools <command> --help
`);
  process.exit(0);
}

if (!(command in COMMANDS)) {
  console.error(`エラー: 不明なコマンド: ${command}`);
  console.error(`使用可能なコマンド: ${Object.keys(COMMANDS).join(', ')}`);
  process.exit(1);
}

// サブコマンドに残りの引数を渡す
process.argv = [process.argv[0], process.argv[1], ...rest];

await COMMANDS[command]();
