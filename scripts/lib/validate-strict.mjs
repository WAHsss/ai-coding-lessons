import { REQUIRED_SECTIONS } from './lessons.mjs';

// strict 质量启发式：全部是 warning，`validate --strict` 才升级为失败。
// 目标是给维护者省 review 成本，因此宁可漏报也不要误报——规则可独立删除。

export const KNOWN_DOMAINS = [
  'frontend/rn',
  'frontend/h5',
  'build',
  'deploy',
  'testing',
  'tooling',
  'ai-coding',
];

const MIN_LENGTHS = {
  现象: 20,
  根因: 20,
  处置: 20,
  证据: 10,
  教训: 10,
};

// 只匹配「对根因下结论」的推测措辞。`均可能抛错` / `构建又可能要求` 属于列举，
// 不是推测根因，基线里已确认不应报警。
const VAGUE_WORDS = /可能(?:是|为|由|因为)|也许(?:是|因为)|大概是|疑似|推测|maybe/i;
const STALE_DAYS = 180;

const PLACEHOLDER_LINES = [
  '观察到什么。保留原始报错、日志关键行、命令输出（英文原文不要翻译）。',
  '为什么会这样。尽量落到机制、源码位置或工具行为；根因未定时写已排除项。',
  '怎么改。给出通用文件类型、配置项与写法，避免绑定具体项目。',
  '怎么证明修好了。命令、产物校验、测试结果、真机现象等。',
  '下次如何一步到位，如何避免误判。',
];

const EVIDENCE_SIGNALS = [
  /`/,
  /\bhttps?:\/\//,
  /[\w./-]+\.(?:ts|tsx|js|jsx|json|log|md|bundle|apk|yml|yaml|sh|ps1|gradle|properties|png|jpg)\b/i,
  /\b(?:ERROR|WARN|Exception|FAILED|HTTP|GET|POST|200|404|500)\b/,
];

const WEAK_SENSITIVE = [
  { name: '邮箱', re: /[\w.+-]+@[\w-]+\.[\w.]+/ },
  { name: 'Bearer 令牌', re: /Bearer\s+[A-Za-z0-9._-]{8,}/i },
  // 值必须是 12 位以上的不透明串，避免命中 `Unexpected token: punc` 这类报错原文
  { name: '密钥赋值', re: /(?:password|passwd|token|secret|api[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9_\-./+=]{12,}/i },
];

function sectionText(body, name) {
  const re = new RegExp(`^##\\s*${name}\\s*$`, 'm');
  const match = re.exec(body);
  if (!match) return null;
  const rest = body.slice(match.index + match[0].length);
  const next = rest.search(/^##\s+/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function plainLength(text) {
  return text.replace(/\s+/g, '').length;
}

function nonEmptyLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim() !== '').length;
}

function isPlaceholderOnly(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !PLACEHOLDER_LINES.includes(line));
  return lines.length === 0;
}

function bigrams(title) {
  const normalized = title.toLowerCase().replace(/[\s\-_/:,，。、（）()【】[\]"'`]+/g, '');
  const result = new Set();
  for (let i = 0; i < normalized.length - 1; i += 1) {
    result.add(normalized.slice(i, i + 2));
  }
  return result;
}

function overlapRatio(a, b) {
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  if (smaller.size === 0) return 0;
  let hits = 0;
  for (const item of smaller) if (larger.has(item)) hits += 1;
  return hits / smaller.size;
}

function daysSince(dateString) {
  const time = Date.parse(`${dateString}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / 86_400_000);
}

/** 返回 [{ file, rule, message }]，按文件名排序。 */
export function collectStrictWarnings(lessons) {
  const warnings = [];
  const tagSets = lessons.map((lesson) => ({
    lesson,
    tags: new Set((lesson.data.tags ?? []).map((tag) => String(tag).toLowerCase())),
    titleGrams: bigrams(String(lesson.data.title ?? '')),
  }));

  for (const lesson of lessons) {
    const { data, body, file } = lesson;

    for (const section of REQUIRED_SECTIONS) {
      const text = sectionText(body, section);
      if (text === null) continue;

      if (section === '证据' && isPlaceholderOnly(text)) {
        warnings.push({ file, rule: '空证据', message: '「证据」段为空或仍是模板占位' });
      }

      // 只有「一句话概括、没有任何可对照信息」才算无实据。
      // 多条定性描述（修复前/后对比、真机现象）在基线里属于可接受证据，不报警。
      if (
        section === '证据' &&
        text !== '' &&
        nonEmptyLines(text) <= 1 &&
        !EVIDENCE_SIGNALS.some((re) => re.test(text))
      ) {
        warnings.push({
          file,
          rule: '证据无实据',
          message: '「证据」段没有命令、日志行或产物路径，结论不可验证',
        });
      }

      const min = MIN_LENGTHS[section];
      if (min && plainLength(text) < min) {
        warnings.push({ file, rule: '段落过短', message: `「${section}」段不足 ${min} 字，疑似模板残留` });
      }
    }

    const rootCause = sectionText(body, '根因');
    if (rootCause && VAGUE_WORDS.test(rootCause)) {
      warnings.push({ file, rule: '模糊根因', message: '「根因」段出现推测性措辞，公共仓不写推测' });
    }

    if (data.domain && !KNOWN_DOMAINS.includes(data.domain)) {
      warnings.push({ file, rule: '未知域', message: `domain「${data.domain}」不在已知 ${KNOWN_DOMAINS.length} 域内` });
    }

    const days = daysSince(data.last_verified);
    if (data.status === 'verified' && days !== null && days > STALE_DAYS) {
      warnings.push({
        file,
        rule: '条目陈旧',
        message: `last_verified 距今 ${days} 天（> ${STALE_DAYS}），建议复核版本适用性`,
      });
    }

    for (const rule of WEAK_SENSITIVE) {
      const match = rule.re.exec(body);
      if (match) {
        warnings.push({ file, rule: '敏感信息', message: `正文出现疑似${rule.name}：${match[0]}` });
      }
    }
  }

  for (let i = 0; i < tagSets.length; i += 1) {
    for (let j = i + 1; j < tagSets.length; j += 1) {
      const a = tagSets[i];
      const b = tagSets[j];
      if (a.lesson.data.domain !== b.lesson.data.domain) continue;
      const sharedTags = [...a.tags].filter((tag) => b.tags.has(tag));
      if (sharedTags.length < 2) continue;
      if (overlapRatio(a.titleGrams, b.titleGrams) < 0.6) continue;
      warnings.push({
        file: b.lesson.file,
        rule: '标题近似重复',
        message: `与 ${a.lesson.file} 同域、共享标签 ${sharedTags.join('/')} 且标题高度重合`,
      });
    }
  }

  warnings.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));
  return warnings;
}
