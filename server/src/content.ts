import { readFile, stat } from 'node:fs/promises';
import type { ContentSnapshot, LessonEntry } from './types.js';

export interface ContentStoreOptions {
  /** mtime 轮询间隔，默认 10s。内容更新由 cron 分钟级 git pull + 重建驱动。 */
  pollMs?: number;
}

function parseSnapshot(raw: string, file: string): ContentSnapshot {
  const data = JSON.parse(raw) as ContentSnapshot;
  if (data.schema_version !== 1 || !Array.isArray(data.lessons)) {
    throw new Error(`${file}: content.json 结构不符合 schema_version 1`);
  }
  return data;
}

/**
 * content.json 的只读持有者。启动时必须加载成功；运行中加载失败保留旧快照。
 * 轮询 mtime，变化时整体换快照，查询侧无锁。
 */
export class ContentStore {
  private snapshot: ContentSnapshot | null = null;
  private mtimeMs = -1;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly file: string,
    options: ContentStoreOptions = {},
  ) {
    this.pollMs = options.pollMs ?? 10_000;
  }

  private readonly pollMs: number;

  async start(): Promise<void> {
    await this.reload();
    this.timer = setInterval(() => {
      void this.reloadIfChanged().catch(() => {
        // 保留旧快照，下个周期再试
      });
    }, this.pollMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async reloadIfChanged(): Promise<boolean> {
    const info = await stat(this.file);
    if (info.mtimeMs === this.mtimeMs) return false;
    await this.reload(info.mtimeMs);
    return true;
  }

  async reload(mtimeMs?: number): Promise<void> {
    const raw = await readFile(this.file, 'utf8');
    const snapshot = parseSnapshot(raw, this.file);
    this.snapshot = snapshot;
    this.mtimeMs = mtimeMs ?? (await stat(this.file)).mtimeMs;
  }

  getSnapshot(): ContentSnapshot {
    if (!this.snapshot) {
      throw new Error(`内容未加载：${this.file}（先执行 node scripts/build-content.mjs）`);
    }
    return this.snapshot;
  }

  getLesson(id: string): LessonEntry | null {
    const normalized = id.trim().toUpperCase();
    return this.getSnapshot().lessons.find((l) => l.id.toUpperCase() === normalized) ?? null;
  }
}
