import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  loadLessons,
  validateLesson,
  checkUniqueIds,
  buildIndex,
  serializeIndex,
} from './lessons.mjs';
import { loadAllSources } from './sources.mjs';

// 构建逻辑的唯一实现。脚本（scripts/*.mjs）与 CLI（bin/lessons.mjs）都只做编排，
// 保证两条入口产出的 index.json / dist/content.json 完全一致。

/** 条目校验未通过。errors 为可直接打印的 `文件: 问题` 列表。 */
export class LessonValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'LessonValidationError';
    this.errors = errors;
  }
}

export const PATHS = {
  indexPath: (root) => path.join(root, 'index.json'),
  contentPath: (root) => path.join(root, 'dist', 'content.json'),
  sourcesPath: (root) => path.join(root, 'sources.json'),
};

/** 读取并硬校验本地条目；不合规直接抛 LessonValidationError。 */
export async function loadValidatedLessons(root) {
  let lessons;
  try {
    lessons = await loadLessons(path.join(root, 'lessons'));
  } catch (error) {
    throw new LessonValidationError(error.message, [error.message]);
  }

  const errors = [];
  for (const lesson of lessons) {
    for (const message of validateLesson(lesson)) {
      errors.push(`${lesson.file}: ${message}`);
    }
  }
  errors.push(...checkUniqueIds(lessons));

  if (errors.length > 0) {
    throw new LessonValidationError(`共 ${errors.length} 个问题`, errors);
  }
  return lessons;
}

/** 生成索引对象（不落盘）。 */
export async function buildIndexJson(root) {
  return buildIndex(await loadValidatedLessons(root));
}

/** 序列化索引，保证与历史产物字节一致。 */
export function serializeIndexJson(index) {
  return serializeIndex(index);
}

/** 比对磁盘上的 index.json 与重新构建的结果。 */
export async function checkIndexFresh(root) {
  const expected = serializeIndexJson(await buildIndexJson(root));
  let current = '';
  try {
    current = await readFile(PATHS.indexPath(root), 'utf8');
  } catch {
    current = '';
  }
  return { fresh: current === expected, current, expected };
}

/** 写入 index.json。 */
export async function writeIndexJson(root, index) {
  const value = index ?? (await buildIndexJson(root));
  await writeFile(PATHS.indexPath(root), serializeIndexJson(value), 'utf8');
  return value;
}

function currentCommit(root) {
  // 容器内构建时镜像没有 git，由调用方通过 GIT_COMMIT 传入
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.trim();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: root }).trim();
  } catch {
    return null;
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function toEntry(lesson, extra = {}) {
  const { data, body, file } = lesson;
  return {
    id: data.id,
    title: data.title,
    domain: data.domain,
    tags: data.tags,
    status: data.status,
    scope: data.scope,
    applies_to: data.applies_to,
    summary: data.summary,
    first_seen: data.first_seen,
    last_verified: data.last_verified,
    related: data.related ?? [],
    path: `lessons/${file}`,
    body,
    ...extra,
  };
}

/**
 * 本地条目 + sources.json 指向的外部条目，合并成单个对象。
 * 单个外部源失败或单条不合规只跳过并记录，不阻塞构建。
 * onEvent 用于把 `[源跳过]` / `[条跳过]` 之类的诊断交给调用方输出。
 */
export async function buildContentJson(root, { onEvent = () => {} } = {}) {
  const localLessons = await loadValidatedLessons(root);
  const entries = localLessons.map((lesson) => toEntry(lesson, { source: 'local' }));
  const seen = new Set(entries.map((entry) => entry.id));

  const registry = await readJson(PATHS.sourcesPath(root));
  const sources = Array.isArray(registry?.sources) ? registry.sources.filter((s) => s?.repo) : [];
  const previous = await readJson(PATHS.contentPath(root));
  const previousByRepo = new Map(
    (previous?.sources ?? []).map((item) => [`${item.repo}#${item.ref || 'main'}`, item]),
  );

  const sourceResults = await loadAllSources(sources, previousByRepo);
  const sourceReport = [];

  for (const result of sourceResults) {
    const { source, key } = result;
    if (!result.ok) {
      onEvent({ level: 'warn', message: `[源跳过] ${key}：${result.error}` });
      sourceReport.push({ repo: source.repo, ref: source.ref || 'main', error: result.error, count: 0 });
      continue;
    }

    let added = 0;
    for (const lesson of result.lessons) {
      const id = lesson.data.id;
      if (seen.has(id)) {
        result.rejected.push({ path: lesson.file, reasons: [`ID 已被占用：${id}`] });
        continue;
      }
      seen.add(id);
      entries.push(
        toEntry(lesson, { source: source.repo, source_url: lesson.source_url }),
      );
      added += 1;
    }

    for (const item of result.rejected) {
      onEvent({ level: 'warn', message: `[条跳过] ${source.repo}:${item.path}：${item.reasons.join('；')}` });
    }
    if (result.reused) {
      onEvent({ level: 'info', message: `[源未变] ${key}：复用上次结果 ${added} 条` });
    }
    sourceReport.push({
      repo: source.repo,
      ref: source.ref || 'main',
      revision: result.revision ?? null,
      etag: result.etag ?? null,
      lessons: result.lessons,
      count: added,
      rejected: result.rejected.length,
    });
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));

  return {
    schema_version: 1,
    built_at: new Date().toISOString(),
    commit: currentCommit(root),
    count: entries.length,
    local_count: localLessons.length,
    sources: sourceReport,
    lessons: entries,
  };
}

/** 写入 dist/content.json，返回内容对象。 */
export async function writeContentJson(root, content) {
  const value = content ?? (await buildContentJson(root));
  const outputFile = PATHS.contentPath(root);
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return value;
}
