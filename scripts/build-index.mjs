import path from 'node:path';
import { checkIndexFresh, writeIndexJson, LessonValidationError } from './lib/build.mjs';

// 薄封装：解析 cwd 作为项目根，实际逻辑在 scripts/lib/build.mjs。
// CLI（bin/lessons.mjs）走同一份实现，保证产物字节一致。

const ROOT = path.resolve('.');
const checkOnly = process.argv.includes('--check');

async function main() {
  try {
    if (checkOnly) {
      const { fresh, expected } = await checkIndexFresh(ROOT);
      if (!fresh) {
        console.error('index.json 已过期，请执行 node scripts/build-index.mjs 后提交。');
        process.exit(1);
      }
      const count = JSON.parse(expected).count;
      console.log(`索引检查通过：${count} 条经验。`);
      return;
    }

    const index = await writeIndexJson(ROOT);
    console.log(`已生成 index.json：${index.count} 条经验。`);
  } catch (error) {
    if (error instanceof LessonValidationError) {
      console.error(`索引生成失败，请先修复 ${error.errors.length} 个问题：`);
      for (const message of error.errors) console.error(`- ${message}`);
      process.exit(1);
    }
    console.error(`索引生成失败：${error.message}`);
    process.exit(1);
  }
}

main();
