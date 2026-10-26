import { parseFrontMatter, validateLesson } from './lessons.mjs';

// 外部源聚合：只存指针（sources.json），正文在构建时从源仓库拉取，本仓不留副本。
// 任何网络/格式问题都降级为「跳过并记录」，绝不让构建失败——否则一个坏源会拖垮整站。

const TREE_API = 'https://api.github.com/repos';
const RAW_BASE = 'https://raw.githubusercontent.com';
const FETCH_TIMEOUT_MS = 20_000;

async function request(url, headers = {}) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'ai-coding-lessons-builder', ...headers },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return response;
}

/** 列出一个源仓库的候选文件（只取 path 前缀下的 .md，跳过 README）。 */
export async function listSourceFiles(source, etag) {
  const url = `${TREE_API}/${source.repo}/git/trees/${encodeURIComponent(source.ref || 'main')}?recursive=1`;
  const response = await request(url, etag ? { 'if-none-match': etag } : {});

  if (response.status === 304) {
    return { unchanged: true, etag };
  }
  if (!response.ok) {
    throw new Error(`列出文件失败 HTTP ${response.status}`);
  }

  const payload = await response.json();
  const base = String(source.path || '').replace(/\/+$/, '');
  const files = (payload.tree || [])
    .filter((node) => node.type === 'blob')
    .map((node) => node.path)
    .filter((filePath) => (base ? filePath.startsWith(`${base}/`) : true))
    .filter((filePath) => filePath.endsWith('.md'))
    .filter((filePath) => !filePath.endsWith('/README.md') && filePath !== 'README.md');

  return {
    unchanged: false,
    etag: response.headers.get('etag') || null,
    revision: payload.sha ?? null,
    files,
  };
}

async function fetchRaw(source, filePath) {
  const url = `${RAW_BASE}/${source.repo}/${source.ref || 'main'}/${filePath}`;
  const response = await request(url);
  if (!response.ok) {
    throw new Error(`读取 ${filePath} 失败 HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * 拉取并校验单个源的条目。
 * 不合规的条目（缺字段、缺段落、命中脱敏规则）只跳过该条，不影响其他条目。
 */
export async function loadSource(source, previous) {
  const listed = await listSourceFiles(source, previous?.etag);

  if (listed.unchanged && previous?.lessons) {
    return {
      lessons: previous.lessons,
      rejected: [],
      etag: listed.etag ?? previous.etag,
      revision: previous.revision ?? null,
      reused: true,
    };
  }

  const base = String(source.path || '').replace(/\/+$/, '');
  const lessons = [];
  const rejected = [];

  for (const filePath of listed.files) {
    let raw;
    try {
      raw = await fetchRaw(source, filePath);
    } catch (error) {
      rejected.push({ path: filePath, reasons: [error.message] });
      continue;
    }

    const relative = base ? filePath.slice(base.length + 1) : filePath;
    let parsed;
    try {
      parsed = parseFrontMatter(raw, filePath);
    } catch (error) {
      rejected.push({ path: filePath, reasons: [error.message] });
      continue;
    }

    const segments = relative.split('/');
    const lesson = {
      file: `@${source.repo}/${relative}`,
      fileName: segments[segments.length - 1],
      // 外部源不要求目录与 domain 对齐，目录结构由作者自行决定
      fileDomain: parsed.data.domain ?? segments.slice(0, -1).join('/'),
      raw,
      ...parsed,
    };

    const reasons = validateLesson(lesson);
    if (reasons.length > 0) {
      rejected.push({ path: filePath, reasons });
      continue;
    }

    lessons.push({
      ...lesson,
      source: source.repo,
      source_url: `https://github.com/${source.repo}/blob/${source.ref || 'main'}/${filePath}`,
    });
  }

  return {
    lessons,
    rejected,
    etag: listed.etag ?? null,
    revision: listed.revision ?? null,
    reused: false,
  };
}

/** 汇总所有外部源；单个源失败只记录，不抛错。 */
export async function loadAllSources(sources, previousByRepo) {
  const results = [];
  for (const source of sources) {
    const key = `${source.repo}#${source.ref || 'main'}`;
    try {
      const result = await loadSource(source, previousByRepo.get(key));
      results.push({ source, key, ok: true, ...result });
    } catch (error) {
      results.push({ source, key, ok: false, error: error.message, lessons: [], rejected: [] });
    }
  }
  return results;
}
