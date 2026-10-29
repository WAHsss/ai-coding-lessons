import { execFileSync } from 'node:child_process';
import { run as runValidate } from './validate.mjs';
import { json, ok, err, info } from './output.mjs';

// publish 只生成「可粘贴的注册片段 + PR 链接」，不建 PR、不写网络：
// 公共仓不引入 GitHub Token，也不想让 CLI 拥有远端写权限。

const UPSTREAM = 'WAHsss/ai-coding-lessons';

function repoFromGit() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    const match = /(?:github\.com[:/])([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(url);
    return match ? `${match[1]}/${match[2]}` : null;
  } catch {
    return null;
  }
}

export async function run({ flags = {} }) {
  const strictCode = await runValidate({ flags: { ...flags, strict: true } });
  if (strictCode !== 0) {
    err('strict 校验未通过，先补齐条目再发布。');
    return 1;
  }

  const repo = flags.repo ?? repoFromGit();
  if (!repo) {
    err('无法从 git remote 推导仓库名，请显式传 --repo <owner/name>');
    return 1;
  }

  const ref = flags.ref ?? 'main';
  const lessonPath = flags.path ?? 'lessons';
  const card = { repo, ref, path: lessonPath };

  json({
    sources_entry: card,
    snippet: { sources: [card] },
    pr_url: `https://github.com/${UPSTREAM}/edit/main/sources.json`,
    self_host: {
      run: 'lessons serve --print-config',
      note: '不想公开贡献？直接在本仓运行 serve 即可自托管，无需注册到公共 sources.json。',
    },
  });

  ok(`已生成 ${repo} 的注册片段；PR 入口：https://github.com/${UPSTREAM}/edit/main/sources.json`);
  info('把 snippet 追加到 sources.json 的 sources 数组后提交 PR。');
  return 0;
}
