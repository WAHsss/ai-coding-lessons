import assert from 'node:assert/strict';
import test from 'node:test';
import { collectStrictWarnings } from '../../scripts/lib/validate-strict.mjs';

function lesson(overrides = {}) {
  const data = {
    id: 'GEN-BUILD-0001',
    title: '被编辑的已有文件不会重新 transform',
    domain: 'build',
    tags: ['metro', 'cache'],
    status: 'verified',
    scope: 'generic',
    applies_to: 'metro dev server',
    summary: '改完已有文件要重启 dev server，否则拿到旧产物。',
    first_seen: '2026-10-18',
    last_verified: '2026-10-26',
    ...overrides,
  };
  return { file: 'build/fixture.md', data, body: overrides.body ?? goodBody };
}

const goodBody = `## 现象

改完已有文件后拉包，bundle 体积与改码前完全一致（\`13,517,216\`），新代码不在包里。

## 根因

运行中的 metro 依赖文件监听更新依赖图；已有文件的 transform 结果被缓存继续发出。

## 处置

改动保存后重启 dev server 再拉包；仍拿旧产物时清理 \`%TEMP%\\metro-cache\` 后重启。

## 证据

- 改动前 bundle \`size\` = \`13,517,216\`；重启后 \`size\` = \`13,518,584\`。
- \`grep __compat_probe__ index.bundle\` 命中数由 0 变为 1。

## 教训

「HTTP 200 + 体积正常」不等于产物是新的，判据永远是产物内容检索。
`;

test('合规条目零 warning', () => {
  assert.deepEqual(collectStrictWarnings([lesson()]), []);
});

test('模糊根因 + 空证据 → 两条 warning', () => {
  const body = `## 现象

改完代码后行为不对，页面没有更新。

## 根因

可能是缓存问题，具体机制还没查清。

## 处置

重启开发服务器之后再看，通常就好了。

## 证据

## 教训

下次遇到先怀疑缓存，别再花时间查代码。
`;
  const warnings = collectStrictWarnings([lesson({ body })]);
  const rules = warnings.map((item) => item.rule);
  assert.ok(rules.includes('模糊根因'));
  assert.ok(rules.includes('空证据'));
});

test('证据段只有一句无实据概括 → warning', () => {
  const body = goodBody.replace(
    /## 证据[\s\S]*?## 教训/,
    '## 证据\n\n实测修复后行为恢复正常。\n\n## 教训',
  );
  const warnings = collectStrictWarnings([lesson({ body })]);
  assert.ok(warnings.some((item) => item.rule === '证据无实据'));
});

test('未知域 → warning', () => {
  const warnings = collectStrictWarnings([lesson({ domain: 'unknown/area' })]);
  assert.ok(warnings.some((item) => item.rule === '未知域'));
});

test('verified 且超过 180 天未复核 → warning', () => {
  const warnings = collectStrictWarnings([lesson({ last_verified: '2025-01-01' })]);
  assert.ok(warnings.some((item) => item.rule === '条目陈旧'));
});

test('同域同标签且标题高度重合 → warning', () => {
  const first = lesson({ title: '运行中的 metro 不拾取新增目录' });
  const second = lesson({
    title: '运行中的 metro 不拾取新增文件',
    body: goodBody,
  });
  second.file = 'build/fixture-2.md';
  const warnings = collectStrictWarnings([first, second]);
  assert.ok(warnings.some((item) => item.rule === '标题近似重复' && item.file === second.file));
});

test('正文出现疑似密钥 → warning', () => {
  const body = goodBody.replace('## 教训', '## 教训\n\n部署脚本里写死了 token: abcdef1234567890abcdef，不能入库。\n');
  const warnings = collectStrictWarnings([lesson({ body })]);
  assert.ok(warnings.some((item) => item.rule === '敏感信息'));
});

test('真邮箱命中敏感信息，包名+版本不命中', () => {
  const emailBody = goodBody.replace('## 教训', '## 教训\n\n联系作者：alice@example.com。\n');
  assert.ok(collectStrictWarnings([lesson({ body: emailBody })]).some((item) => item.rule === '敏感信息'));

  const versionBody = goodBody.replace('## 教训', '## 教训\n\n锁定 react@19.0.0，避免被间接依赖升级带飞。\n');
  assert.equal(
    collectStrictWarnings([lesson({ body: versionBody })]).filter((item) => item.rule === '敏感信息').length,
    0,
  );
});
