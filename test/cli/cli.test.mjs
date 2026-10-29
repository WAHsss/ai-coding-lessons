import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(ROOT, 'bin', 'lessons.mjs');

function runCli(args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd: ROOT, encoding: 'utf8' });
}

test('--help 列出全部八个命令', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  for (const name of ['init', 'new', 'validate', 'search', 'build', 'serve', 'publish', 'check']) {
    assert.match(result.stderr, new RegExp(`\\b${name}\\b`));
  }
});

test('未知命令退出码 2', () => {
  const result = runCli(['nope']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /未知命令/);
});

test('未知选项退出码 2', () => {
  const result = runCli(['validate', '--nope']);
  assert.equal(result.status, 2);
});

test('非 TTY 且缺参数时 new 立即失败', () => {
  const result = runCli(['new']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /非交互环境/);
});

test('validate 与 check 在真实仓库上退出 0', () => {
  assert.equal(runCli(['validate']).status, 0);
  assert.equal(runCli(['check']).status, 0);
});

test('search --json 只输出 JSON 到 stdout', () => {
  const result = runCli(['search', 'metro', '--domain', 'build', '--json']);
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.ok(Array.isArray(payload.results));
  assert.ok(payload.results.length > 0);
});
