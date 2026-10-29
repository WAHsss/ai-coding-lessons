import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(ROOT, 'bin', 'lessons.mjs');

test('serve --print-config 的 stdout 是可直接粘贴的 JSON', () => {
  const result = spawnSync(process.execPath, [BIN, 'serve', '--print-config'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const config = JSON.parse(result.stdout);
  const server = config.mcpServers['ai-coding-lessons'];
  assert.equal(server.command, 'node');
  assert.ok(server.args[0].endsWith('mcp-local.mjs'));
  assert.ok(path.isAbsolute(server.env.CONTENT_PATH));
});
