import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// stdio 启动器：保证 content.json 比 lessons/ 新，再交给 MCP 服务端。
// 所有构建输出都重定向到 stderr —— stdout 是 JSON-RPC 通道，混入日志会直接让客户端解析失败。

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const CONTENT = process.env.CONTENT_PATH ?? path.join(REPO, 'dist', 'content.json');
const ENTRY = path.join(REPO, 'server', 'dist', 'src', 'index.js');

function newestMtime(dir) {
  let newest = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = statSync(current);
    } catch {
      continue;
    }
    if (entries.isFile()) {
      newest = Math.max(newest, entries.mtimeMs);
      continue;
    }
    for (const name of readdirSync(current)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      stack.push(path.join(current, name));
    }
  }
  return newest;
}

function run(file, args) {
  const result = spawnSync(file, args, {
    cwd: REPO,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (output) process.stderr.write(`${output}\n`);
  if (result.status !== 0) {
    process.stderr.write(`[lessons] 构建失败：${file} ${args.join(' ')}\n`);
    process.exit(1);
  }
}

function ensureContent() {
  const lessonsDir = path.join(REPO, 'lessons');
  const contentMtime = existsSync(CONTENT) ? statSync(CONTENT).mtimeMs : 0;
  const lessonsMtime = newestMtime(lessonsDir);
  if (contentMtime > 0 && contentMtime >= lessonsMtime) return;

  process.stderr.write('[lessons] 内容过期或缺失，正在重建…\n');
  run(process.execPath, [path.join(REPO, 'scripts', 'build-index.mjs')]);
  run(process.execPath, [path.join(REPO, 'scripts', 'build-content.mjs')]);
}

ensureContent();

if (!existsSync(ENTRY)) {
  process.stderr.write(
    '[lessons] 服务端未编译。请先执行：cd server && pnpm install && pnpm build\n',
  );
  process.exit(1);
}

await import(pathToFileURL(ENTRY).href);
