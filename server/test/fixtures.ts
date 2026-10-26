import type { LessonEntry } from '../src/types.js';

export function lesson(partial: Partial<LessonEntry> & { id: string }): LessonEntry {
  return {
    title: '默认标题',
    domain: 'build',
    tags: ['metro'],
    status: 'verified',
    scope: 'generic',
    applies_to: 'all',
    summary: '默认摘要内容',
    first_seen: '2026-01-01',
    last_verified: '2026-01-02',
    related: [],
    path: `lessons/build/${partial.id.toLowerCase()}.md`,
    body: '## 现象\n正文',
    ...partial,
  };
}
