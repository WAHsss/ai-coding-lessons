import path from 'node:path';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { ok, err, info } from './output.mjs';

const README = `# lessons/

每条经验一个 Markdown 文件，目录名必须与 front-matter 的 \`domain\` 一致。

## 目录约定

\`\`\`
lessons/
  build/               domain: build
  deploy/              domain: deploy
  frontend/rn/         domain: frontend/rn
  frontend/h5/         domain: frontend/h5
\`\`\`

## 新增一条

\`\`\`bash
lessons new --domain build --title "一句话标题" --tags metro,cache
lessons validate --strict
\`\`\`

## ID 规则

\`GEN-<域代码>-<4 位序号>\`，例如 \`GEN-BUILD-0007\`。
域代码：\`ai-coding→AI\`、\`testing→TEST\`、\`tooling→TOOL\`、\`build→BUILD\`、\`deploy→DEPLOY\`，
其余取路径末段大写（\`frontend/rn→RN\`、\`frontend/h5→H5\`）。

## 结构

front-matter 必填：\`id\`、\`title\`、\`domain\`、\`tags\`、\`status\`、\`scope\`、
\`applies_to\`、\`summary\`、\`first_seen\`、\`last_verified\`。

正文必须包含五段：\`## 现象\`、\`## 根因\`、\`## 处置\`、\`## 证据\`、\`## 教训\`。
`;

async function exists(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

export async function run({ flags = {}, positionals = [] }) {
  const target = path.resolve(positionals[0] ? positionals[0] : flags.root ?? '.');
  const lessonsDir = path.join(target, 'lessons');

  if (await exists(lessonsDir)) {
    info(`${path.relative(process.cwd(), lessonsDir) || lessonsDir} 已存在，未做改动。`);
    return 0;
  }

  try {
    await mkdir(lessonsDir, { recursive: true });
    await writeFile(path.join(lessonsDir, 'README.md'), README, 'utf8');
  } catch (error) {
    err(`初始化失败：${error.message}`);
    return 1;
  }

  ok(`已初始化 ${path.relative(process.cwd(), lessonsDir) || lessonsDir}`);
  info('下一步：lessons new --domain build --title "一句话标题"');
  return 0;
}
