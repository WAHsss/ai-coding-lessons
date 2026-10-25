import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  loadLessons,
  validateLesson,
  checkUniqueIds,
  buildIndex,
  serializeIndex,
} from './lib/lessons.mjs';

const INDEX_FILE = path.resolve('index.json');
const checkOnly = process.argv.includes('--check');

async function main() {
  let lessons;
  try {
    lessons = await loadLessons();
  } catch (error) {
    console.error(`索引生成失败：${error.message}`);
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
    console.error(`索引生成失败，请先修复 ${errors.length} 个问题：`);
    for (const message of errors) console.error(`- ${message}`);
    process.exit(1);
  }

  const output = serializeIndex(buildIndex(lessons));

  if (checkOnly) {
    let current = '';
    try {
      current = await readFile(INDEX_FILE, 'utf8');
    } catch {
      current = '';
    }
    if (current !== output) {
      console.error('index.json 已过期，请执行 node scripts/build-index.mjs 后提交。');
      process.exit(1);
    }
    console.log(`索引检查通过：${lessons.length} 条经验。`);
    return;
  }

  await writeFile(INDEX_FILE, output, 'utf8');
  console.log(`已生成 index.json：${lessons.length} 条经验。`);
}

main();
