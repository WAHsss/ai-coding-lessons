import assert from 'node:assert/strict';
import test from 'node:test';
import { searchEntries } from '../../scripts/lib/search.mjs';

function entry(id, overrides = {}) {
  return {
    id,
    title: 'placeholder title',
    domain: 'build',
    tags: [],
    status: 'verified',
    summary: 'placeholder summary',
    body: 'placeholder body',
    ...overrides,
  };
}

const fixtures = [
  entry('GEN-BUILD-0001', { title: 'metro 缓存不失效', tags: ['metro', 'cache'] }),
  entry('GEN-BUILD-0002', { title: '构建退出码假成功', tags: ['exit-code'] }),
  entry('GEN-RN-0001', { domain: 'frontend/rn', title: '样式选择器子集', tags: ['stylesheet'] }),
  entry('GEN-BUILD-0003', { title: 'metro 不拾取新增目录', tags: ['metro', 'watch'] }),
  entry('GEN-BUILD-0004', { title: '草稿条目', tags: ['metro'], status: 'draft' }),
];

test('默认只返回 verified 且按权重排序', () => {
  const result = searchEntries(fixtures, { query: 'metro' });
  assert.deepEqual(
    result.results.map((item) => item.id),
    ['GEN-BUILD-0001', 'GEN-BUILD-0003'],
  );
  assert.equal(result.total, 2);
});

test('status 过滤与默认值', () => {
  assert.equal(searchEntries(fixtures, { query: 'metro', status: 'draft' }).results.length, 1);
});

test('domain 前缀匹配', () => {
  const result = searchEntries(fixtures, { query: '样式', domain: 'frontend' });
  assert.deepEqual(result.results.map((item) => item.id), ['GEN-RN-0001']);
  assert.equal(searchEntries(fixtures, { query: '样式', domain: 'build' }).results.length, 0);
});

test('tags 取交集且大小写无关', () => {
  const result = searchEntries(fixtures, { tags: ['METRO', 'cache'], query: '' });
  assert.deepEqual(result.results.map((item) => item.id), ['GEN-BUILD-0001']);
});

test('ID 精确命中权重最高', () => {
  const result = searchEntries(fixtures, { query: 'gen-build-0002' });
  assert.equal(result.results[0].id, 'GEN-BUILD-0002');
});

test('空 query 按 ID 排序并截断', () => {
  const result = searchEntries(fixtures, { limit: 2 });
  assert.deepEqual(result.results.map((item) => item.id), ['GEN-BUILD-0001', 'GEN-BUILD-0002']);
});

test('limit 超出上限被夹到 50', () => {
  const many = Array.from({ length: 60 }, (_, index) =>
    entry(`GEN-BUILD-${String(index).padStart(4, '0')}`),
  );
  assert.equal(searchEntries(many, { limit: 999 }).results.length, 50);
});
