import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterLessons, searchLessons } from '../src/search.js';
import { lesson } from './fixtures.js';

const POOL = [
  lesson({
    id: 'GEN-BUILD-0001',
    title: '构建退出码 0 不代表成功',
    tags: ['wrapper', 'spawn'],
    body: '## 现象\n包装器吞掉子进程退出码',
  }),
  lesson({
    id: 'GEN-RN-0001',
    title: 'Hermes 不保留函数源码',
    domain: 'frontend/rn',
    tags: ['hermes', 'runtime'],
    body: '## 现象\n源码特征识别恒为 false',
  }),
  lesson({
    id: 'GEN-RN-0002',
    title: '绝对定位弹层被祖先裁剪',
    domain: 'frontend/rn',
    tags: ['layout'],
    status: 'draft',
  }),
  lesson({
    id: 'GEN-H5-0001',
    title: '全局覆写特异性击穿隐藏类',
    domain: 'frontend/h5',
    tags: ['css'],
  }),
  lesson({
    id: 'GEN-TOOL-0001',
    title: 'PowerShell 执行策略禁用',
    domain: 'tooling',
    tags: ['powershell'],
    status: 'deprecated',
  }),
];

test('默认只返回 verified', () => {
  const { results } = searchLessons(POOL, {});
  assert.deepEqual(
    results.map((l) => l.id),
    ['GEN-BUILD-0001', 'GEN-H5-0001', 'GEN-RN-0001'],
  );
});

test('status 可切换，draft 单独可查', () => {
  const { results } = searchLessons(POOL, { status: 'draft' });
  assert.deepEqual(
    results.map((l) => l.id),
    ['GEN-RN-0002'],
  );
});

test('domain 支持前缀过滤', () => {
  const { results } = searchLessons(POOL, { domain: 'frontend' });
  assert.deepEqual(
    results.map((l) => l.id),
    ['GEN-H5-0001', 'GEN-RN-0001'],
  );
});

test('tags 需全部命中', () => {
  assert.equal(searchLessons(POOL, { tags: ['hermes'] }).total, 1);
  assert.equal(searchLessons(POOL, { tags: ['hermes', 'runtime'] }).total, 1);
  assert.equal(searchLessons(POOL, { tags: ['hermes', 'metro'] }).total, 0);
});

test('query：标题命中排在正文命中前，id 精确命中第一', () => {
  const pool = [
    lesson({ id: 'GEN-A-0001', title: '无关', body: '## 现象\n这里提到 metro 缓存' }),
    lesson({ id: 'GEN-B-0002', title: 'metro 缓存键不含 defineConstants' }),
    lesson({ id: 'GEN-C-0003', title: 'metro 无关标题' }),
  ];
  const { results } = searchLessons(pool, { query: 'metro' });
  assert.equal(results[0].id, 'GEN-B-0002');
  assert.equal(results[1].id, 'GEN-C-0003');
  assert.equal(results[2].id, 'GEN-A-0001');

  const byId = searchLessons(pool, { query: 'GEN-A-0001' });
  assert.equal(byId.results[0].id, 'GEN-A-0001');
});

test('limit 生效且封顶 50', () => {
  const pool = Array.from({ length: 60 }, (_, i) =>
    lesson({ id: `GEN-A-${String(i).padStart(4, '0')}` }),
  );
  assert.equal(searchLessons(pool, { limit: 5 }).results.length, 5);
  assert.equal(searchLessons(pool, { limit: 200 }).results.length, 50);
});

test('query 与过滤条件叠加', () => {
  const { results } = searchLessons(POOL, { query: '裁剪', status: 'draft', domain: 'frontend' });
  assert.deepEqual(
    results.map((l) => l.id),
    ['GEN-RN-0002'],
  );
});

test('filterLessons 空条件等价于按默认状态过滤', () => {
  assert.equal(filterLessons(POOL, {}).length, 3);
});
