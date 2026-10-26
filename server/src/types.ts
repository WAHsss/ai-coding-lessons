export const STATUS_VALUES = ['draft', 'verified', 'deprecated'] as const;
export type Status = (typeof STATUS_VALUES)[number];

/** 与 scripts/build-content.mjs 生成的 dist/content.json 对齐（schema_version: 1）。 */
export interface LessonEntry {
  id: string;
  title: string;
  domain: string;
  tags: string[];
  status: string;
  scope?: string;
  applies_to: string;
  summary: string;
  first_seen: string;
  last_verified: string;
  related: string[];
  path: string;
  body: string;
  /** 条目来源：本地为 local，外部为 owner/repo */
  source?: string;
  /** 外部条目的原始链接，便于溯源与下架核对 */
  source_url?: string;
}

export interface ContentSnapshot {
  schema_version: number;
  built_at: string;
  commit: string | null;
  count: number;
  local_count?: number;
  sources?: unknown[];
  lessons: LessonEntry[];
}

/** 去掉正文后的元数据，检索结果用。 */
export type LessonMeta = Omit<LessonEntry, 'body'>;

export function toMeta({ body: _body, ...meta }: LessonEntry): LessonMeta {
  return meta;
}
