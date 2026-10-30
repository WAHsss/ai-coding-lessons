import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 脚手架：ID 分配、slug 生成、模板渲染。模板内置在代码里，
// 因此即便用户目录里没有 templates/ 也能生成合规条目。

const DOMAIN_CODES = {
  'ai-coding': 'AI',
  testing: 'TEST',
  tooling: 'TOOL',
  build: 'BUILD',
  deploy: 'DEPLOY',
  backend: 'BACKEND',
};

/** 域 → ID 域代码。未列出的域取路径末段大写（frontend/rn → RN）。 */
export function domainCode(domain) {
  if (DOMAIN_CODES[domain]) return DOMAIN_CODES[domain];
  const last = domain.split('/').pop() ?? domain;
  return last.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function sequenceOf(id, code) {
  const match = new RegExp(`^GEN-${code}-(\\d{4})$`).exec(id ?? '');
  return match ? Number(match[1]) : null;
}

/** 该域下一个可用序号：现有最大序号 +1。 */
export function nextSequence(lessons, code) {
  let max = 0;
  for (const lesson of lessons) {
    const seq = sequenceOf(lesson.data?.id, code);
    if (seq !== null && seq > max) max = seq;
  }
  return max + 1;
}

export function allocateId(lessons, domain) {
  const code = domainCode(domain);
  const seq = nextSequence(lessons, code);
  return { id: `GEN-${code}-${String(seq).padStart(4, '0')}`, code, seq };
}

/** 标题 → kebab slug；纯中文标题回退为 `域-序号`，仍满足 kebab-case。 */
export function slugify(title, fallback) {
  const ascii = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || fallback;
}

async function uniqueSlug(dir, slug) {
  let candidate = `${slug}.md`;
  let index = 2;
  const existing = new Set(await readdir(dir).catch(() => []));
  while (existing.has(candidate)) {
    candidate = `${slug}-${index}.md`;
    index += 1;
  }
  return candidate;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function renderTemplate({ id, title, domain, tags, status, appliesTo, summary }) {
  return `---
id: ${id}
title: ${title}
domain: ${domain}
tags: [${tags.join(', ')}]
status: ${status}
scope: generic
applies_to: ${appliesTo}
summary: ${summary}
first_seen: ${today()}
last_verified: ${today()}
related: []
---

## 现象

观察到什么。保留原始报错、日志关键行、命令输出（英文原文不要翻译）。

## 根因

为什么会这样。落到机制、源码位置或工具行为；根因未定时写已排除项。

## 处置

怎么改。给出通用文件类型、配置项与写法，避免绑定具体项目。

## 证据

怎么证明修好了。保留命令、产物校验、测试结果或真机现象。

## 教训

下次如何一步到位，如何避免误判。

## 适用边界

- 适用：
- 不适用：
`;
}

/**
 * 在 lessons/<domain>/ 下落盘一条新条目。
 * 返回 { file, id, title }。
 */
export async function createLesson({ lessonsDir, lessons, domain, title, tags = [], status = 'draft', appliesTo, summary }) {
  const { id, seq } = allocateId(lessons, domain);
  const dir = path.join(lessonsDir, domain);
  await mkdir(dir, { recursive: true });

  const slug = slugify(title, `${domain.split('/').pop()}-${seq}`);
  const fileName = await uniqueSlug(dir, slug);

  const content = renderTemplate({
    id,
    title,
    domain,
    tags,
    status,
    appliesTo: appliesTo || domain,
    summary: summary || title,
  });

  const file = path.join(dir, fileName);
  await writeFile(file, content, 'utf8');
  return { file, id, title };
}
