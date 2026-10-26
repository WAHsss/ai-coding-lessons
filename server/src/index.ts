import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ContentStore } from './content.js';
import { createMcpServer } from './server.js';
import { startHttpServer } from './http.js';

const DEFAULT_PORT = 8321;

interface CliOptions {
  transport: 'stdio' | 'http';
  host: string;
  port: number;
  contentPath: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    transport: process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio',
    host: process.env.HOST ?? '127.0.0.1',
    port: Number(process.env.PORT ?? DEFAULT_PORT),
    contentPath: process.env.CONTENT_PATH ?? path.resolve('dist/content.json'),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--http') options.transport = 'http';
    else if (arg === '--stdio') options.transport = 'stdio';
    else if (arg === '--host') options.host = argv[++i];
    else if (arg === '--port') options.port = Number(argv[++i]);
    else if (arg === '--content') options.contentPath = path.resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.error(
        '用法: node dist/src/index.js [--stdio|--http] [--host H] [--port N] [--content PATH]\n' +
          '环境变量: MCP_TRANSPORT / HOST / PORT / CONTENT_PATH',
      );
      process.exit(0);
    } else {
      console.error(`未知参数: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

async function packageVersion(): Promise<string> {
  try {
    const raw = await readFile(new URL('../../package.json', import.meta.url), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const version = await packageVersion();

  const store = new ContentStore(options.contentPath);
  await store.start();

  if (options.transport === 'stdio') {
    const server = createMcpServer(store, version);
    await server.connect(new StdioServerTransport());
    console.error(
      `ai-coding-lessons MCP（stdio）：${store.getSnapshot().count} 条经验，来自 ${options.contentPath}`,
    );
    return;
  }

  startHttpServer(store, { host: options.host, port: options.port, version });
  console.error(
    `ai-coding-lessons MCP（http）：http://${options.host}:${options.port}/mcp，` +
      `${store.getSnapshot().count} 条经验，来自 ${options.contentPath}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
