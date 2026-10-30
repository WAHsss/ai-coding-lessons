import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadLessons, validateLesson } from '../../scripts/lib/lessons.mjs';
import { allocateId, createLesson, domainCode, slugify } from '../../scripts/lib/scaffold.mjs';

test('域代码映射', () => {
  assert.equal(domainCode('ai-coding'), 'AI');
  assert.equal(domainCode('testing'), 'TEST');
  assert.equal(domainCode('tooling'), 'TOOL');
  assert.equal(domainCode('build'), 'BUILD');
  assert.equal(domainCode('backend'), 'BACKEND');
  assert.equal(domainCode('frontend/rn'), 'RN');
  assert.equal(domainCode('frontend/h5'), 'H5');
});

test('ID 取现有最大序号 +1', () => {
  const lessons = [{ data: { id: 'GEN-BUILD-0003' } }, { data: { id: 'GEN-BUILD-0011' } }];
  assert.deepEqual(allocateId(lessons, 'build'), { id: 'GEN-BUILD-0012', code: 'BUILD', seq: 12 });
});

test('无同域条目时从 0001 开始', () => {
  assert.equal(allocateId([], 'frontend/rn').id, 'GEN-RN-0001');
});

test('slug 生成与中文回退', () => {
  assert.equal(slugify('Metro Cache Stale'), 'metro-cache-stale');
  assert.equal(slugify('纯中文标题', 'build-1'), 'build-1');
});

test('连续两次 new 的 ID 递增、文件名不冲突，且生成条目通过硬校验', async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'lessons-scaffold-'));
  const lessonsDir = path.join(base, 'lessons');
  await mkdir(lessonsDir, { recursive: true });

  try {
    const first = await createLesson({
      lessonsDir,
      lessons: [],
      domain: 'build',
      title: 'metro 缓存不失效',
      tags: ['metro', 'cache'],
    });
    const lessons = await loadLessons(lessonsDir);
    const second = await createLesson({
      lessonsDir,
      lessons,
      domain: 'build',
      title: 'metro 缓存不失效',
      tags: ['metro'],
    });

    assert.equal(first.id, 'GEN-BUILD-0001');
    assert.equal(second.id, 'GEN-BUILD-0002');
    assert.notEqual(first.file, second.file);

    for (const lesson of await loadLessons(lessonsDir)) {
      assert.deepEqual(validateLesson(lesson), [], lesson.file);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
