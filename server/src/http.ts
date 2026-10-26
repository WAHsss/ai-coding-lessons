import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ContentStore } from './content.js';
import { createMcpServer } from './server.js';

const MAX_BODY_BYTES = 1_000_000;

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('request body too large');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

export interface HttpOptions {
  host: string;
  port: number;
  version: string;
}

/**
 * 无状态 Streamable HTTP：每个 POST 独立建 server/transport，响应完即销毁。
 * 适合只读公开服务，无会话维持成本；横向扩容也无需粘性会话。
 */
export function startHttpServer(store: ContentStore, options: HttpOptions): Server {
  const server = createServer((req, res) => {
    void handle(req, res).catch((error) => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
      } else {
        res.end();
      }
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === '/healthz') {
      try {
        const { built_at, commit, count } = store.getSnapshot();
        sendJson(res, 200, { ok: true, content: { built_at, commit, count } });
      } catch {
        sendJson(res, 503, { ok: false, error: 'content not loaded' });
      }
      return;
    }

    if (url.pathname !== '/mcp') {
      sendJson(res, 404, { error: 'not found' });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method not allowed: 无状态模式只支持 POST /mcp' });
      return;
    }

    const body = await readJsonBody(req);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const mcpServer = createMcpServer(store, options.version);
    res.on('close', () => {
      void transport.close().catch(() => {});
      void mcpServer.close().catch(() => {});
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  server.listen(options.port, options.host);
  return server;
}
