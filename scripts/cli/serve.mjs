import path from 'node:path';
import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolveProject } from '../lib/project.mjs';
import { buildContentJson, writeContentJson } from '../lib/build.mjs';
import { json, ok, err, warn, info } from './output.mjs';

// serve 只做编排：编译校验 → 内容新鲜度 → 交给 server/ 启动器或编译产物。
// 不自带服务端实现，也不静默降级（缺产物时给出可直接复制的修复命令）。

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function fileExists(target) {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

async function dirExists(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function newestMtime(dir) {
  let newest = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') stack.push(full);
        continue;
      }
      try {
        newest = Math.max(newest, (await stat(full)).mtimeMs);
      } catch {
        // 忽略瞬时消失的文件
      }
    }
  }
  return newest;
}

async function ensureContent(project) {
  const missing = !(await fileExists(project.contentFile));
  const contentMtime = missing ? 0 : (await stat(project.contentFile)).mtimeMs;
  const lessonsMtime = await newestMtime(project.lessonsDir);
  if (contentMtime > 0 && contentMtime >= lessonsMtime) return;

  info('[lessons] 内容缺失或已过期，正在重建 dist/content.json…');
  const content = await buildContentJson(project.root, {
    onEvent: ({ level, message }) => (level === 'warn' ? warn(message) : info(message)),
  });
  await writeContentJson(project.root, content);
}

function serverPaths() {
  const serverDir = path.join(PACKAGE_ROOT, 'server');
  return {
    serverDir,
    entry: path.join(serverDir, 'dist', 'src', 'index.js'),
    localLauncher: path.join(serverDir, 'bin', 'mcp-local.mjs'),
    nodeModules: path.join(serverDir, 'node_modules'),
  };
}

function printConfig(launcher, contentFile) {
  json({
    mcpServers: {
      'ai-coding-lessons': {
        command: 'node',
        args: [launcher, '--stdio'],
        env: { CONTENT_PATH: contentFile },
      },
    },
  });
}

export async function run({ flags = {} }) {
  const project = await resolveProject({ root: flags.root });
  const paths = serverPaths();
  const compiled = (await fileExists(paths.entry)) && (await dirExists(paths.nodeModules));

  if (flags['print-config']) {
    if (!compiled) warn('服务端尚未编译，配置在编译后才会生效');
    printConfig(paths.localLauncher, project.contentFile);
    return 0;
  }

  if (!compiled) {
    err('服务端尚未编译，缺少 server/dist/src/index.js 或 server/node_modules');
    info(`修复：cd "${paths.serverDir}" && pnpm install && pnpm build`);
    return 1;
  }

  try {
    await ensureContent(project);
  } catch (error) {
    err(`内容构建失败：${error.message}`);
    return 1;
  }

  const args = flags.http
    ? [paths.entry, '--http', '--content', project.contentFile]
    : [paths.localLauncher, '--stdio'];
  if (flags.http && flags.port) args.push('--port', String(flags.port));

  const child = spawn(process.execPath, args, {
    cwd: project.root,
    stdio: 'inherit',
    env: { ...process.env, CONTENT_PATH: project.contentFile },
  });

  if (flags.http) ok(`HTTP 模式启动：http://127.0.0.1:${flags.port ?? 8321}`);

  return await new Promise((resolve) => {
    child.on('error', (error) => {
      err(`启动失败：${error.message}`);
      resolve(1);
    });
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}
