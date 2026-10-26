import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loadLessons, validateLesson, checkUniqueIds } from './lib/lessons.mjs';

// 服务端数据源：把 index 元数据与正文合并成单个 JSON，供 MCP/HTTP 服务只读加载。
// 产物不进 git（dist/ 已忽略），服务器上由 deploy/update-content.sh 定时重建。

const OUTPUT_FILE = path.resolve('dist/content.json');

function currentCommit() {
  // 容器内构建时镜像没有 git，由调用方通过 GIT_COMMIT 传入
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.trim();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function main() {
  let lessons;
  try {
    lessons = await loadLessons();
  } catch (error) {
    console.error(`内容构建失败：${error.message}`);
    process.exit(1);
  }

  const errors = [];
  for (const lesson of lessons) {
    for (const message of validateLesson(lesson)) {
      errors.push(`${lesson.file}: ${message}`);
    }
  }
  errors.push(...checkUniqueIds(lessons));

  if (errors.length > 0) {
    console.error(`内容构建失败，请先修复 ${errors.length} 个问题：`);
    for (const message of errors) console.error(`- ${message}`);
    process.exit(1);
  }

  const entries = lessons
    .map(({ data, body, file }) => ({
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
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const content = {
    schema_version: 1,
    built_at: new Date().toISOString(),
    commit: currentCommit(),
    count: entries.length,
    lessons: entries,
  };

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  console.log(`已生成 dist/content.json：${entries.length} 条经验（commit ${content.commit ?? 'unknown'}）。`);
}

main();
