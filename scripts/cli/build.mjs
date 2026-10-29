import { resolveProject } from '../lib/project.mjs';
import {
  buildContentJson,
  checkIndexFresh,
  writeContentJson,
  writeIndexJson,
  LessonValidationError,
} from '../lib/build.mjs';
import { ok, err, warn, item } from './output.mjs';

function reportValidationError(error) {
  if (error instanceof LessonValidationError) {
    err(`构建失败，请先修复 ${error.errors.length} 个问题：`);
    for (const message of error.errors) item(message);
    return 1;
  }
  err(`构建失败：${error.message}`);
  return 1;
}

export async function run({ flags = {} }) {
  if (flags['index-only'] && flags['content-only']) {
    err('--index-only 与 --content-only 不能同时使用');
    return 2;
  }
  if (flags.check && flags['content-only']) {
    err('--check 只校验 index.json，不能与 --content-only 组合');
    return 2;
  }

  const project = await resolveProject({ root: flags.root });
  const events = {
    onEvent: ({ level, message }) => (level === 'warn' ? warn(message) : item(message)),
  };

  try {
    if (flags.check) {
      const { fresh, expected } = await checkIndexFresh(project.root);
      if (!fresh) {
        err('index.json 已过期，请执行 lessons build 后提交。');
        return 1;
      }
      ok(`索引检查通过：${JSON.parse(expected).count} 条经验。`);
      return 0;
    }

    if (flags['content-only']) {
      const content = await buildContentJson(project.root, events);
      await writeContentJson(project.root, content);
      ok(`已生成 dist/content.json：${content.count} 条经验。`);
      return 0;
    }

    const index = await writeIndexJson(project.root);
    ok(`已生成 index.json：${index.count} 条经验。`);

    if (!flags['index-only']) {
      const content = await buildContentJson(project.root, events);
      await writeContentJson(project.root, content);
      ok(`已生成 dist/content.json：${content.count} 条经验。`);
    }
    return 0;
  } catch (error) {
    return reportValidationError(error);
  }
}
