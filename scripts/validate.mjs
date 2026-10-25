import { loadLessons, validateLesson, checkUniqueIds, LESSONS_DIR } from './lib/lessons.mjs';

async function main() {
  let lessons;
  try {
    lessons = await loadLessons();
  } catch (error) {
    console.error(`校验失败：${error.message}`);
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
    console.error(`校验失败，共 ${errors.length} 个问题：`);
    for (const message of errors) console.error(`- ${message}`);
    process.exit(1);
  }

  console.log(`校验通过：${lessons.length} 条经验（${LESSONS_DIR}）。`);
}

main();
