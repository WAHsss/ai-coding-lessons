import path from 'node:path';
import { resolveProject } from '../lib/project.mjs';
import { loadLessons, validateLesson, checkUniqueIds } from '../lib/lessons.mjs';
import { collectStrictWarnings } from '../lib/validate-strict.mjs';
import { ok, err, warn, item } from './output.mjs';

export async function run({ flags = {} }) {
  const project = await resolveProject({ root: flags.root });

  let lessons;
  try {
    lessons = await loadLessons(project.lessonsDir);
  } catch (error) {
    err(`校验失败：${error.message}`);
    return 1;
  }

  const errors = [];
  for (const lesson of lessons) {
    for (const message of validateLesson(lesson)) {
      errors.push(`${lesson.file}: ${message}`);
    }
  }
  errors.push(...checkUniqueIds(lessons));

  if (errors.length > 0) {
    err(`校验失败，共 ${errors.length} 个问题：`);
    for (const message of errors) item(message);
    return 1;
  }

  if (flags.strict) {
    const warnings = collectStrictWarnings(lessons);
    if (warnings.length > 0) {
      warn(`strict 质量检查发现 ${warnings.length} 个提示：`);
      for (const entry of warnings) item(`${entry.file}: [${entry.rule}] ${entry.message}`);
      return 1;
    }
  }

  const label = path.relative(process.cwd(), project.lessonsDir) || project.lessonsDir;
  ok(`校验通过：${lessons.length} 条经验（${label}）${flags.strict ? '，strict 无提示' : ''}。`);
  return 0;
}
