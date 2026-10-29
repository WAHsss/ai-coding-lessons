// 本地全文检索：权重与 server/src/search.ts 完全一致，由 test/cli/search-parity.test.mjs 守门。
// 两份实现刻意不共享代码（server 是独立 pnpm 包），靠一致输出对齐。

export const DEFAULT_STATUS = 'verified';
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

/** 把 loadLessons() 的条目压成与 server LessonEntry 同形的结构。 */
export function toSearchEntry(lesson) {
  const { data } = lesson;
  return {
    id: data.id,
    title: data.title,
    domain: data.domain,
    tags: data.tags ?? [],
    status: data.status,
    applies_to: data.applies_to,
    summary: data.summary,
    first_seen: data.first_seen,
    last_verified: data.last_verified,
    body: lesson.body,
  };
}

export function lessonsToSearchEntries(lessons) {
  return lessons.map(toSearchEntry);
}

function matchDomain(entry, domain) {
  return entry.domain === domain || entry.domain.startsWith(`${domain}/`);
}

export function filterEntries(entries, params) {
  const status = params.status ?? DEFAULT_STATUS;
  return entries.filter((entry) => {
    if (entry.status !== status) return false;
    if (params.domain && !matchDomain(entry, params.domain)) return false;
    if (params.tags && params.tags.length > 0) {
      const owned = new Set((entry.tags ?? []).map((tag) => tag.toLowerCase()));
      if (!params.tags.every((tag) => owned.has(tag.toLowerCase()))) return false;
    }
    return true;
  });
}

function score(entry, tokens) {
  let total = 0;
  const title = String(entry.title ?? '').toLowerCase();
  const summary = String(entry.summary ?? '').toLowerCase();
  const body = String(entry.body ?? '').toLowerCase();
  const domain = String(entry.domain ?? '').toLowerCase();
  const tags = (entry.tags ?? []).map((tag) => tag.toLowerCase());

  if (tokens.some((token) => String(entry.id ?? '').toLowerCase() === token)) total += 100;

  for (const token of tokens) {
    if (title.includes(token)) total += 4;
    if (tags.some((tag) => tag === token)) total += 3;
    else if (tags.some((tag) => tag.includes(token))) total += 1;
    if (summary.includes(token)) total += 2;
    if (domain.includes(token)) total += 1;
    if (body.includes(token)) total += 1;
  }
  return total;
}

/** 返回 { total, results }，results 为原始 entry 数组。 */
export function searchEntries(entries, params = {}) {
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const filtered = filterEntries(entries, params);

  const tokens = (params.query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    const sorted = [...filtered].sort((a, b) => a.id.localeCompare(b.id));
    return { total: sorted.length, results: sorted.slice(0, limit) };
  }

  const ranked = filtered
    .map((entry) => ({ entry, score: score(entry, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));

  return { total: ranked.length, results: ranked.slice(0, limit).map((item) => item.entry) };
}

/** 直接对 loadLessons() 的结果检索，返回值带 file 便于打印位置。 */
export function searchLocal(lessons, params = {}) {
  const byId = new Map();
  const entries = lessons.map((lesson) => {
    const entry = toSearchEntry(lesson);
    byId.set(entry.id, lesson);
    return entry;
  });

  const { total, results } = searchEntries(entries, params);
  return { total, results: results.map((entry) => ({ ...entry, file: byId.get(entry.id)?.file })) };
}
