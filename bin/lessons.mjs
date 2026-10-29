#!/usr/bin/env node
import { createRequire } from 'node:module';
import { err, info, setColor } from '../scripts/cli/output.mjs';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const GLOBAL_OPTIONS = { root: 'value', json: 'boolean', help: 'boolean', 'no-color': 'boolean' };

const COMMANDS = {
  init: {
    summary: '初始化 lessons/ 骨架',
    usage: 'lessons init [dir] [--root <path>]',
    options: {},
    load: () => import('../scripts/cli/init.mjs'),
  },
  new: {
    summary: '新建一条经验（交互式或参数直填）',
    usage: 'lessons new --domain <domain> --title <title> [--tags a,b] [--status draft]',
    options: { domain: 'value', title: 'value', tags: 'list', status: 'value' },
    load: () => import('../scripts/cli/new.mjs'),
  },
  validate: {
    summary: '校验条目（--strict 追加质量启发式）',
    usage: 'lessons validate [--strict] [--root <path>]',
    options: { strict: 'boolean' },
    load: () => import('../scripts/cli/validate.mjs'),
  },
  search: {
    summary: '本地全文检索 lessons/',
    usage: 'lessons search <query> [--domain <d>] [--tags a,b] [--status <s>] [--limit <n>] [--json]',
    options: {
      domain: 'value',
      tags: 'list',
      status: 'value',
      limit: 'number',
    },
    load: () => import('../scripts/cli/search.mjs'),
  },
  build: {
    summary: '生成 index.json / dist/content.json',
    usage: 'lessons build [--index-only | --content-only] [--check]',
    options: { 'index-only': 'boolean', 'content-only': 'boolean', check: 'boolean' },
    load: () => import('../scripts/cli/build.mjs'),
  },
  serve: {
    summary: '启动 MCP 服务或打印客户端配置',
    usage: 'lessons serve [--http] [--port <n>] [--print-config]',
    options: { http: 'boolean', port: 'number', 'print-config': 'boolean' },
    load: () => import('../scripts/cli/serve.mjs'),
  },
  publish: {
    summary: '生成 sources.json 注册片段与 PR 链接',
    usage: 'lessons publish [--repo <owner/name>] [--path lessons] [--ref main]',
    options: { repo: 'value', path: 'value', ref: 'value' },
    load: () => import('../scripts/cli/publish.mjs'),
  },
  check: {
    summary: 'validate + build --check（等价 npm run check）',
    usage: 'lessons check [--root <path>]',
    options: {},
    load: () => import('../scripts/cli/check.mjs'),
  },
};

class CliError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

function parseArgs(argv, spec) {
  const flags = {};
  const positionals = [];
  const merged = { ...GLOBAL_OPTIONS, ...spec };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!token.startsWith('-')) {
      positionals.push(token);
      continue;
    }
    if (token === '-h') {
      flags.help = true;
      continue;
    }
    if (!token.startsWith('--')) {
      throw new CliError(`不支持的短选项：${token}`);
    }

    const body = token.slice(2);
    const eq = body.indexOf('=');
    const key = eq === -1 ? body : body.slice(0, eq);
    const inline = eq === -1 ? undefined : body.slice(eq + 1);

    if (key === 'help') {
      flags.help = true;
      continue;
    }

    const kind = merged[key];
    if (!kind) throw new CliError(`未知选项：--${key}`);

    if (kind === 'boolean') {
      flags[key] = inline === undefined ? true : inline !== 'false';
      continue;
    }

    let value = inline;
    if (value === undefined) {
      value = argv[index + 1];
      if (value === undefined) throw new CliError(`选项 --${key} 缺少取值`);
      index += 1;
    }

    if (kind === 'list') {
      flags[key] = value.split(',').map((part) => part.trim()).filter(Boolean);
      continue;
    }
    if (kind === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new CliError(`选项 --${key} 需要数字，收到「${value}」`);
      flags[key] = parsed;
      continue;
    }
    flags[key] = value;
  }

  return { flags, positionals };
}

function printHelp() {
  info('lessons —— ai-coding-lessons 的零依赖 CLI');
  info('');
  info('用法：lessons <command> [options]');
  info('');
  info('命令：');
  for (const [name, command] of Object.entries(COMMANDS)) {
    info(`  ${name.padEnd(9)}${command.summary}`);
  }
  info('');
  info('全局选项：');
  info('  --root <path>   指定项目根（默认从 cwd 向上查找含 lessons/ 的目录）');
  info('  --json          只输出机读 JSON 到 stdout');
  info('  --no-color      关闭颜色');
  info('  --version       打印版本');
  info('  --help          打印帮助');
  info('');
  info('示例：');
  info('  lessons validate --strict');
  info('  lessons search metro --domain build');
  info('  npx github:WAHsss/ai-coding-lessons init my-lessons');
}

async function main(argv) {
  const [first] = argv;

  if (!first || first === '--help' || first === '-h' || first === 'help') {
    printHelp();
    return 0;
  }
  if (first === '--version' || first === '-v') {
    info(pkg.version);
    return 0;
  }

  const command = COMMANDS[first];
  if (!command) {
    err(`未知命令：${first}`);
    info('可用命令：' + Object.keys(COMMANDS).join(' / '));
    return 2;
  }

  const { flags, positionals } = parseArgs(argv.slice(1), command.options);
  if (flags['no-color']) setColor(false);

  if (flags.help) {
    info(`用法：${command.usage}`);
    info('');
    info(command.summary);
    return 0;
  }

  const module = await command.load();
  const code = await module.run({ flags, positionals, command: first });
  return typeof code === 'number' ? code : 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    if (error instanceof CliError) {
      err(error.message);
      process.exitCode = error.exitCode;
      return;
    }
    err(error?.message ?? String(error));
    process.exitCode = 1;
  });
