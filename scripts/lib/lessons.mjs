import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const LESSONS_DIR = path.resolve('lessons');

export const REQUIRED_FIELDS = [
  'id',
  'title',
  'domain',
  'tags',
  'status',
  'scope',
  'applies_to',
  'summary',
  'first_seen',
  'last_verified',
];

export const REQUIRED_SECTIONS = ['现象', '根因', '处置', '证据', '教训'];
export const STATUS_VALUES = ['draft', 'verified', 'deprecated'];
export const ID_RE = /^GEN-[A-Z0-9]+-\d{4}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
export const DOMAIN_RE = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

// 公共仓脱敏检查：命中即失败
const SENSITIVE_PATTERNS = [
  {
    name: '私网 IPv4',
    re: /\b(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})\b/g,
  },
  {
    name: '内部域名',
    re: /\bhttps?:\/\/[^\s/]+\.(?:internal|local|corp)\b/gi,
  },
  {
    name: '疑似密钥',
    re: /\b(?:sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,})\b/g,
  },
  {
    name: '手机号',
    re: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
  },
];

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseValue(value) {
  if (value === '') return '';
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter(Boolean);
  }
  return unquote(value);
}

export function parseFrontMatter(raw, file) {
  const lines = raw.split(/\r?\n/);
  if (lines[0].trim() !== '---') {
    throw new Error(`${file}: 缺少 front-matter（首行必须是 ---）`);
  }

  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error(`${file}: front-matter 未闭合`);
  }

  const data = {};
  for (const line of lines.slice(1, end)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = line.indexOf(':');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    data[key] = parseValue(line.slice(index + 1).trim());
  }

  return {
    data,
    body: lines.slice(end + 1).join('\n').trim(),
  };
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      entry.name !== 'README.md'
    ) {
      files.push(full);
    }
  }
  return files;
}

export async function loadLessons(root = LESSONS_DIR) {
  const files = (await walk(root)).sort((a, b) => a.localeCompare(b));
  const lessons = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const relative = path.relative(root, file).split(path.sep).join('/');
    const segments = relative.split('/');
    const parsed = parseFrontMatter(raw, relative);
    lessons.push({
      file: relative,
      fileName: segments[segments.length - 1],
      fileDomain: segments.slice(0, -1).join('/'),
      raw,
      ...parsed,
    });
  }

  return lessons;
}

export function validateLesson(lesson) {
  const errors = [];
  const { data, body, file, fileName, fileDomain, raw } = lesson;

  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === '') {
      errors.push(`缺少必填字段 ${field}`);
    }
  }

  if (data.id && !ID_RE.test(data.id)) {
    errors.push(`id 格式不正确（应为 GEN-<域代码>-<4 位序号>）：${data.id}`);
  }
  if (data.title && String(data.title).length < 4) {
    errors.push('title 至少 4 个字符');
  }
  if (data.summary && String(data.summary).length < 8) {
    errors.push('summary 至少 8 个字符');
  }
  if (data.domain && !DOMAIN_RE.test(data.domain)) {
    errors.push(`domain 格式不正确：${data.domain}`);
  }
  if (data.domain && data.domain !== fileDomain) {
    errors.push(`domain 与目录不一致：front-matter=${data.domain}，目录=${fileDomain}`);
  }
  if (!SLUG_RE.test(fileName)) {
    errors.push(`文件名必须是 kebab-case：${fileName}`);
  }
  if (data.status && !STATUS_VALUES.includes(data.status)) {
    errors.push(`status 取值非法：${data.status}（可选 ${STATUS_VALUES.join(' / ')}）`);
  }
  if (data.scope !== undefined && data.scope !== 'generic') {
    errors.push('公共仓条目的 scope 必须为 generic');
  }
  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    errors.push('tags 必须是数组，例如 [metro, cache]');
  }
  if (Array.isArray(data.tags) && data.tags.length === 0) {
    errors.push('tags 至少包含一个标签');
  }
  if (data.first_seen && !DATE_RE.test(data.first_seen)) {
    errors.push(`first_seen 日期格式应为 YYYY-MM-DD：${data.first_seen}`);
  }
  if (data.last_verified && !DATE_RE.test(data.last_verified)) {
    errors.push(`last_verified 日期格式应为 YYYY-MM-DD：${data.last_verified}`);
  }
  if (data.related !== undefined && !Array.isArray(data.related)) {
    errors.push('related 必须是数组，例如 [GEN-RN-0001]');
  }

  for (const section of REQUIRED_SECTIONS) {
    const hasSection = new RegExp(`^##\\s*${section}\\s*$`, 'm').test(body);
    if (!hasSection) {
      errors.push(`正文缺少「## ${section}」段落`);
    }
  }

  for (const rule of SENSITIVE_PATTERNS) {
    const matches = raw.match(rule.re);
    if (matches) {
      errors.push(`命中脱敏规则「${rule.name}」：${[...new Set(matches)].join(', ')}`);
    }
  }

  return errors;
}

export function checkUniqueIds(lessons) {
  const errors = [];
  const seen = new Map();
  for (const lesson of lessons) {
    const id = lesson.data.id;
    if (!id) continue;
    if (seen.has(id)) {
      errors.push(`ID 重复：${id}（${seen.get(id)} 与 ${lesson.file}）`);
    } else {
      seen.set(id, lesson.file);
    }
  }
  return errors;
}

export function buildIndex(lessons) {
  const entries = lessons
    .map(({ data, file }) => ({
      id: data.id,
      title: data.title,
      domain: data.domain,
      tags: data.tags,
      status: data.status,
      applies_to: data.applies_to,
      summary: data.summary,
      first_seen: data.first_seen,
      last_verified: data.last_verified,
      path: `lessons/${file}`,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    schema_version: 1,
    count: entries.length,
    lessons: entries,
  };
}

export function serializeIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}
