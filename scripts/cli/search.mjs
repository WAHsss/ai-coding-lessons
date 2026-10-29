import { resolveProject } from '../lib/project.mjs';
import { loadLessons } from '../lib/lessons.mjs';
import { searchLocal, DEFAULT_STATUS } from '../lib/search.mjs';
import { out, json, ok, err, warn } from './output.mjs';

function printTable(results) {
  const columns = [
    { key: 'id', width: 0 },
    { key: 'domain', width: 0 },
    { key: 'status', width: 0 },
    { key: 'title', width: 0 },
  ];
  for (const column of columns) {
    column.width = Math.max(
      column.key.length,
      ...results.map((entry) => String(entry[column.key] ?? '').length),
    );
  }
  for (const entry of results) {
    out(columns.map((column) => String(entry[column.key] ?? '').padEnd(column.width)).join('  ').trimEnd());
  }
}

export async function run({ flags = {}, positionals = [] }) {
  const query = positionals.join(' ').trim();
  const project = await resolveProject({ root: flags.root });

  let lessons;
  try {
    lessons = await loadLessons(project.lessonsDir);
  } catch (error) {
    err(`检索失败：${error.message}`);
    return 1;
  }

  const { total, results } = searchLocal(lessons, {
    query,
    domain: flags.domain,
    tags: flags.tags,
    status: flags.status ?? DEFAULT_STATUS,
    limit: flags.limit,
  });

  if (flags.json) {
    json({
      query,
      total,
      results: results.map((entry) => ({
        id: entry.id,
        title: entry.title,
        domain: entry.domain,
        tags: entry.tags,
        status: entry.status,
        summary: entry.summary,
        file: `lessons/${entry.file}`,
      })),
    });
    return 0;
  }

  if (results.length === 0) {
    warn(`未命中：${query || '(空查询)'}`);
    return 0;
  }

  printTable(results);
  ok(`${query ? `「${query}」` : '全部条目'} 命中 ${total} 条，显示 ${results.length} 条。`);
  return 0;
}
