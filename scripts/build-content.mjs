import path from 'node:path';
import { buildContentJson, writeContentJson, LessonValidationError } from './lib/build.mjs';

// 薄封装：解析 cwd 作为项目根，实际逻辑在 scripts/lib/build.mjs。
// 服务端数据源：本地条目 + sources.json 指向的外部条目，合并成单个 JSON。
// 本仓只保存外部源指针，正文在构建时拉取，因此本仓 git 历史里没有他人内容。
// 产物不进 git（dist/ 已忽略），服务器上由 deploy/update-content.sh 定时重建。

const ROOT = path.resolve('.');

async function main() {
  try {
    const content = await buildContentJson(ROOT, {
      onEvent: ({ level, message }) => (level === 'warn' ? console.warn(message) : console.log(message)),
    });
    await writeContentJson(ROOT, content);

    const external = content.count - content.local_count;
    console.log(
      `已生成 dist/content.json：${content.count} 条经验（本地 ${content.local_count}，外部 ${external}；commit ${content.commit ?? 'unknown'}）。`,
    );
  } catch (error) {
    if (error instanceof LessonValidationError) {
      console.error(`内容构建失败，请先修复 ${error.errors.length} 个问题：`);
      for (const message of error.errors) console.error(`- ${message}`);
      process.exit(1);
    }
    console.error(`内容构建失败：${error.message}`);
    process.exit(1);
  }
}

main();
