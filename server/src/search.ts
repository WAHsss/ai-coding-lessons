import type { LessonEntry, Status } from './types.js';

export interface SearchParams {
  query?: string;
  domain?: string;
  tags?: string[];
  status?: Status;
  limit?: number;
}

export const DEFAULT_STATUS: Status = 'verified';
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

function matchDomain(lesson: LessonEntry, domain: string): boolean {
  return lesson.domain === domain || lesson.domain.startsWith(`${domain}/`);
}

export function filterLessons(lessons: LessonEntry[], params: SearchParams): LessonEntry[] {
  const status = params.status ?? DEFAULT_STATUS;
  return lessons.filter((lesson) => {
    if (lesson.status !== status) return false;
    if (params.domain && !matchDomain(lesson, params.domain)) return false;
    if (params.tags && params.tags.length > 0) {
      const owned = new Set(lesson.tags.map((t) => t.toLowerCase()));
      if (!params.tags.every((t) => owned.has(t.toLowerCase()))) return false;
    }
    return true;
  });
}

function score(lesson: LessonEntry, tokens: string[]): number {
  let total = 0;
  const title = lesson.title.toLowerCase();
  const summary = lesson.summary.toLowerCase();
  const body = lesson.body.toLowerCase();
  const domain = lesson.domain.toLowerCase();
  const tags = lesson.tags.map((t) => t.toLowerCase());

  if (tokens.some((t) => lesson.id.toLowerCase() === t)) total += 100;

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

export interface SearchResult {
  total: number;
  results: LessonEntry[];
}

export function searchLessons(lessons: LessonEntry[], params: SearchParams): SearchResult {
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const filtered = filterLessons(lessons, params);

  const tokens = (params.query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    const sorted = [...filtered].sort((a, b) => a.id.localeCompare(b.id));
    return { total: sorted.length, results: sorted.slice(0, limit) };
  }

  const ranked = filtered
    .map((lesson) => ({ lesson, score: score(lesson, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.lesson.id.localeCompare(b.lesson.id));

  return { total: ranked.length, results: ranked.slice(0, limit).map((item) => item.lesson) };
}

export function countBy<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

export function sortedCounts(counts: Map<string, number>): Array<{ name: string; count: number }> {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
