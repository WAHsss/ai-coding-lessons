import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loadLessons, validateLesson, checkUniqueIds } from './lib/lessons.mjs';
import { loadAllSources } from './lib/sources.mjs';

// 服务端数据源：本地条目 + sources.json 指向的外部条目，合并成单个 JSON。
// 本仓只保存外部源指针，正文在构建时拉取，因此本仓 git 历史里没有他人内容。
// 产物不进 git（dist/ 已忽略），服务器上由 deploy/update-content.sh 定时重建。

const OUTPUT_FILE = path.resolve('dist/content.json');
const SOURCES_FILE = path.resolve('sources.json');

function currentCommit() {
  // 容器内构建时镜像没有 git，由调用方通过 GIT_COMMIT 传入
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.trim();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
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

async function main() {
  let localLessons;
  try {
    localLessons = await loadLessons();
  } catch (error) {
    console.error(`内容构建失败：${error.message}`);
    process.exit(1);
  }

  // 本地条目必须严格合规：不合规直接失败（这里是内容质量的主闸门）
  const errors = [];
  for (const lesson of localLessons) {
    for (const message of validateLesson(lesson)) {
      errors.push(`${lesson.file}: ${message}`);
    }
  }
  errors.push(...checkUniqueIds(localLessons));
  if (errors.length > 0) {
    console.error(`内容构建失败，请先修复 ${errors.length} 个问题：`);
    for (const message of errors) console.error(`- ${message}`);
    process.exit(1);
  }

  const entries = localLessons.map((lesson) => toEntry(lesson, { source: 'local' }));
  const seen = new Set(entries.map((entry) => entry.id));

  // 外部源：单个源失败或单条不合规都只跳过，不阻塞构建
  const registry = await readJson(SOURCES_FILE);
  const sources = Array.isArray(registry?.sources) ? registry.sources.filter((s) => s?.repo) : [];
  const previous = await readJson(OUTPUT_FILE);
  const previousByRepo = new Map(
    (previous?.sources ?? []).map((item) => [`${item.repo}#${item.ref || 'main'}`, item]),
  );

  const sourceResults = await loadAllSources(sources, previousByRepo);
  const sourceReport = [];

  for (const result of sourceResults) {
    const { source, key } = result;
    if (!result.ok) {
      console.warn(`[源跳过] ${key}：${result.error}`);
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
      console.warn(`[条跳过] ${source.repo}:${item.path}：${item.reasons.join('；')}`);
    }
    if (result.reused) {
      console.log(`[源未变] ${key}：复用上次结果 ${added} 条`);
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

  const content = {
    schema_version: 1,
    built_at: new Date().toISOString(),
    commit: currentCommit(),
    count: entries.length,
    local_count: localLessons.length,
    sources: sourceReport,
    lessons: entries,
  };

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(content, null, 2)}\n`, 'utf8');

  const external = entries.length - localLessons.length;
  console.log(
    `已生成 dist/content.json：${entries.length} 条经验（本地 ${localLessons.length}，外部 ${external}；commit ${content.commit ?? 'unknown'}）。`,
  );
}

main();
