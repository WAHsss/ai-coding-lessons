import assert from 'node:assert/strict';
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ContentStore } from '../src/content.js';
import { lesson } from './fixtures.js';

function contentJson(ids: string[]): string {
  return JSON.stringify({
    schema_version: 1,
    built_at: '2026-01-01T00:00:00.000Z',
    commit: 'abc',
    count: ids.length,
    lessons: ids.map((id) => lesson({ id })),
  });
}

async function touch(file: string, seconds: number): Promise<void> {
  const atime = new Date(seconds * 1000);
  await utimes(file, atime, atime);
}

test('ContentStore 加载、热更新与容错', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'acl-content-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'content.json');

  await writeFile(file, contentJson(['GEN-A-0001']), 'utf8');
  await touch(file, 1000);

  const store = new ContentStore(file, { pollMs: 60_000 });
  await store.start();
  t.after(() => store.stop());

  assert.equal(store.getSnapshot().count, 1);
  assert.equal(store.getLesson('gen-a-0001')?.id, 'GEN-A-0001');
  assert.equal(store.getLesson('GEN-X-9999'), null);

  // mtime 未变不重载
  assert.equal(await store.reloadIfChanged(), false);

  // 内容更新后被拾取
  await writeFile(file, contentJson(['GEN-A-0001', 'GEN-B-0002']), 'utf8');
  await touch(file, 2000);
  assert.equal(await store.reloadIfChanged(), true);
  assert.equal(store.getSnapshot().count, 2);

  // 新文件损坏：reloadIfChanged 抛错，但旧快照保留
  await writeFile(file, '{"schema_version": 99}', 'utf8');
  await touch(file, 3000);
  await assert.rejects(() => store.reloadIfChanged());
  assert.equal(store.getSnapshot().count, 2);
});
