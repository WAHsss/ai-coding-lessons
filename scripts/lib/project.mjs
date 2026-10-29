import { stat } from 'node:fs/promises';
import path from 'node:path';

// 项目根解析：CLI 的每个命令都先解析一次，再逐层向下传，避免依赖进程 cwd。

async function isDir(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function toProject(root) {
  return {
    root,
    lessonsDir: path.join(root, 'lessons'),
    indexFile: path.join(root, 'index.json'),
    contentFile: path.join(root, 'dist', 'content.json'),
    sourcesFile: path.join(root, 'sources.json'),
    serverDir: path.join(root, 'server'),
  };
}

/**
 * 查找顺序：显式 --root → 从 cwd 向上找含 lessons/ 的目录 → 回退 cwd。
 * 显式 root 不存在时直接报错，不做静默回退——否则产物会写到意料之外的目录。
 */
export async function resolveProject({ root, cwd = process.cwd() } = {}) {
  if (root) {
    const abs = path.resolve(cwd, root);
    if (!(await isDir(abs))) {
      throw new Error(`--root 指向的目录不存在：${abs}`);
    }
    return toProject(abs);
  }

  let dir = path.resolve(cwd);
  for (;;) {
    if (await isDir(path.join(dir, 'lessons'))) return toProject(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return toProject(path.resolve(cwd));
}
