import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveProject } from '../../scripts/lib/project.mjs';

async function withTempRepo(fn) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'lessons-project-'));
  const repo = path.join(base, 'repo');
  await mkdir(path.join(repo, 'lessons', 'build'), { recursive: true });
  try {
    await fn({ base, repo });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

test('cwd 就是项目根时直接命中', async () => {
  await withTempRepo(async ({ repo }) => {
    const project = await resolveProject({ cwd: repo });
    assert.equal(project.root, repo);
    assert.equal(project.lessonsDir, path.join(repo, 'lessons'));
    assert.equal(project.indexFile, path.join(repo, 'index.json'));
    assert.equal(project.contentFile, path.join(repo, 'dist', 'content.json'));
    assert.equal(project.sourcesFile, path.join(repo, 'sources.json'));
    assert.equal(project.serverDir, path.join(repo, 'server'));
  });
});

test('从两层子目录向上找到项目根', async () => {
  await withTempRepo(async ({ repo }) => {
    const nested = path.join(repo, 'scripts', 'cli');
    await mkdir(nested, { recursive: true });
    const project = await resolveProject({ cwd: nested });
    assert.equal(project.root, repo);
  });
});

test('显式 root 优先于向上查找', async () => {
  await withTempRepo(async ({ base, repo }) => {
    const project = await resolveProject({ root: repo, cwd: base });
    assert.equal(project.root, repo);
  });
});

test('显式 root 不存在时报错', async () => {
  await withTempRepo(async ({ base }) => {
    await assert.rejects(
      () => resolveProject({ root: path.join(base, 'missing'), cwd: base }),
      /--root 指向的目录不存在/,
    );
  });
});

test('找不到 lessons/ 时回退 cwd', async () => {
  await withTempRepo(async ({ base }) => {
    const empty = path.join(base, 'empty');
    await mkdir(empty, { recursive: true });
    const project = await resolveProject({ cwd: empty });
    assert.equal(project.root, empty);
  });
});
