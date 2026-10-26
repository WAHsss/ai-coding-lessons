import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ContentStore } from './content.js';
import {
  countBy,
  filterLessons,
  searchLessons,
  sortedCounts,
  DEFAULT_STATUS,
  MAX_LIMIT,
} from './search.js';
import { STATUS_VALUES, toMeta } from './types.js';

function json(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

const statusSchema = z
  .enum(STATUS_VALUES)
  .optional()
  .describe(`条目状态，默认 ${DEFAULT_STATUS}`);

export function createMcpServer(store: ContentStore, version: string): McpServer {
  const server = new McpServer({ name: 'ai-coding-lessons', version });

  server.registerTool(
    'search_lessons',
    {
      title: '搜索经验条目',
      description:
        '检索 ai-coding-lessons 通用经验库（AI Coding 与软件工程踩坑经验）。' +
        `默认只返回 ${DEFAULT_STATUS} 条目；返回元数据列表，正文请用 get_lesson 获取。`,
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('关键词，空格分词，匹配 id / title / tags / summary / 正文'),
        domain: z.string().optional().describe('按域过滤，支持前缀，如 frontend 或 frontend/rn'),
        tags: z.array(z.string()).optional().describe('标签过滤，需全部命中'),
        status: statusSchema,
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .describe(`返回条数，默认 10，最大 ${MAX_LIMIT}`),
      },
    },
    async (params) => {
      const { total, results } = searchLessons(store.getSnapshot().lessons, params);
      return json({ total, count: results.length, results: results.map(toMeta) });
    },
  );

  server.registerTool(
    'get_lesson',
    {
      title: '读取经验条目全文',
      description: '按 id（如 GEN-RN-0001）返回条目完整元数据与正文（现象/根因/处置/证据/教训）。',
      inputSchema: {
        id: z.string().describe('条目 ID，格式 GEN-<域代码>-<4 位序号>'),
      },
    },
    async ({ id }) => {
      const lesson = store.getLesson(id);
      if (!lesson) {
        return {
          isError: true,
          content: [{ type: 'text', text: `条目不存在：${id}` }],
        };
      }
      return json(lesson);
    },
  );

  server.registerTool(
    'list_domains',
    {
      title: '列出经验域',
      description: '列出全部 domain 及条目数。',
      inputSchema: { status: statusSchema },
    },
    async ({ status }) => {
      const lessons = filterLessons(store.getSnapshot().lessons, { status });
      return json({ domains: sortedCounts(countBy(lessons.map((l) => l.domain))) });
    },
  );

  server.registerTool(
    'list_tags',
    {
      title: '列出标签',
      description: '列出全部标签及条目数，可按 domain 过滤。',
      inputSchema: {
        status: statusSchema,
        domain: z.string().optional().describe('按域过滤，支持前缀'),
      },
    },
    async ({ status, domain }) => {
      const lessons = filterLessons(store.getSnapshot().lessons, { status, domain });
      return json({ tags: sortedCounts(countBy(lessons.flatMap((l) => l.tags))) });
    },
  );

  server.registerTool(
    'get_content_version',
    {
      title: '内容版本',
      description: '返回当前加载内容的版本信息（构建时间、git commit、条目数）。',
      inputSchema: {},
    },
    async () => {
      const { schema_version, built_at, commit, count } = store.getSnapshot();
      return json({ schema_version, built_at, commit, count });
    },
  );

  return server;
}
