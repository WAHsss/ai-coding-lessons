import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { searchEntries } from '../../scripts/lib/search.mjs';

// CLI 的本地检索与 server 的 searchLessons 是两份独立实现（server 是独立 pnpm 包）。
// 这条测试是它们唯一的一致性守门：同一批条目 + 同一组参数，结果 ID 顺序必须相同。

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER_SEARCH = path.join(ROOT, 'server', 'dist', 'src', 'search.js');

async function loadServerSearch() {
  try {
    return await import(pathToFileURL(SERVER_SEARCH).href);
  } catch {
    return null;
  }
}

const fixtures = [
  {
    id: 'GEN-BUILD-0001',
    title: 'metro 缓存不失效',
    domain: 'build',
    tags: ['metro', 'cache'],
    status: 'verified',
    scope: 'generic',
    applies_to: 'metro',
    summary: '改完已有文件要重启 dev server。',
    first_seen: '2026-10-18',
    last_verified: '2026-10-26',
    related: [],
    path: 'lessons/build/a.md',
    body: '运行中的 metro 依赖文件监听，缓存继续发出旧结果。',
  },
  {
    id: 'GEN-BUILD-0002',
    title: '构建退出码假成功',
    domain: 'build',
    tags: ['exit-code', 'wrapper'],
    status: 'verified',
    scope: 'generic',
    applies_to: 'taro cli',
    summary: '包装脚本吞掉子进程退出码时，构建会假成功。',
    first_seen: '2026-10-18',
    last_verified: '2026-10-26',
    related: [],
    path: 'lessons/build/b.md',
    body: '子进程日志里其实有 Unexpected token，但 exit code 是 0。',
  },
  {
    id: 'GEN-RN-0001',
    title: 'StyleSheet 选择器子集',
    domain: 'frontend/rn',
    tags: ['stylesheet', 'rn'],
    status: 'verified',
    scope: 'generic',
    applies_to: 'react-native',
    summary: 'RN 只认独立单类选择器。',
    first_seen: '2026-10-18',
    last_verified: '2026-10-26',
    related: [],
    path: 'lessons/frontend/rn/c.md',
    body: '属性选择器与复合多类被静默丢弃。',
  },
];

const cases = [
  { query: 'metro' },
  { query: '缓存' },
  { query: 'exit-code' },
  { query: 'gen-build-0002' },
  { query: '', domain: 'frontend' },
  { query: 'metro', domain: 'build', tags: ['cache'] },
  { query: '构建', status: 'draft' },
];

test('CLI 检索与 server 检索结果顺序一致', async (t) => {
  const server = await loadServerSearch();
  if (!server) {
    t.skip('server/dist 未编译，跳过一致性对比');
    return;
  }

  for (const params of cases) {
    const local = searchEntries(fixtures, params).results.map((entry) => entry.id);
    const remote = server.searchLessons(fixtures, params).results.map((entry) => entry.id);
    assert.deepEqual(local, remote, `参数 ${JSON.stringify(params)} 的结果不一致`);
  }
});
