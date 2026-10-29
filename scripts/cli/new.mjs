import path from 'node:path';
import { stat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { resolveProject } from '../lib/project.mjs';
import { loadLessons } from '../lib/lessons.mjs';
import { createLesson, domainCode } from '../lib/scaffold.mjs';
import { ok, err, info } from './output.mjs';

const STATUS_VALUES = ['draft', 'verified', 'deprecated'];

async function exists(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function ask(flags) {
  // 非 TTY 且缺参数时绝不等待输入：CI / 管道里必须立即失败。
  if (!process.stdin.isTTY) return null;

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const domain = flags.domain || (await rl.question('domain（例：frontend/rn、build）: ')).trim();
    const title = flags.title || (await rl.question('title（一句话标题）: ')).trim();
    const tags = flags.tags ?? (await rl.question('tags（逗号分隔，可留空）: '))
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const status = flags.status || 'draft';
    return { domain, title, tags, status };
  } finally {
    rl.close();
  }
}

export async function run({ flags = {} }) {
  const project = await resolveProject({ root: flags.root });

  if (!(await exists(project.lessonsDir))) {
    err(`找不到 ${project.lessonsDir}，请先运行 lessons init`);
    return 1;
  }

  let input;
  if (flags.domain && flags.title) {
    input = { domain: flags.domain, title: flags.title, tags: flags.tags ?? [], status: flags.status ?? 'draft' };
  } else {
    input = await ask(flags);
    if (!input) {
      err('非交互环境必须同时提供 --domain 与 --title');
      return 2;
    }
  }

  const { domain, title, tags, status } = input;
  if (!domain || !title) {
    err('--domain 与 --title 不能为空');
    return 2;
  }
  if (!STATUS_VALUES.includes(status)) {
    err(`--status 取值非法：${status}（可选 ${STATUS_VALUES.join(' / ')}）`);
    return 2;
  }

  let lessons;
  try {
    lessons = await loadLessons(project.lessonsDir);
  } catch (error) {
    err(`读取现有条目失败：${error.message}`);
    return 1;
  }

  const { file, id } = await createLesson({
    lessonsDir: project.lessonsDir,
    lessons,
    domain,
    title,
    tags,
    status,
  });

  ok(`已创建 ${path.relative(project.root, file)}（${id}，域代码 ${domainCode(domain)}）`);
  info('下一步：补齐「现象 / 根因 / 处置 / 证据 / 教训」后运行 lessons validate --strict');
  return 0;
}
