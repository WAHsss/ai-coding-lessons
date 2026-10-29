// 输出约定：stdout 只放机读结果（--json / --print-config 的 JSON），
// 一切面向人的叙述、进度、警告、错误都走 stderr，保证管道与重定向可用。

let colorOverride = null;

function colorEnabled(stream) {
  if (colorOverride !== null) return colorOverride;
  if (process.env.NO_COLOR) return false;
  return Boolean(stream.isTTY);
}

export function setColor(enabled) {
  colorOverride = enabled;
}

function paint(stream, code, text) {
  return colorEnabled(stream) ? `\u001b[${code}m${text}\u001b[0m` : text;
}

/** 成功信息（stderr） */
export function ok(message) {
  process.stderr.write(`${paint(process.stderr, '32', '✓')} ${message}\n`);
}

/** 警告（stderr） */
export function warn(message) {
  process.stderr.write(`${paint(process.stderr, '33', '⚠')} ${message}\n`);
}

/** 错误（stderr） */
export function err(message) {
  process.stderr.write(`${paint(process.stderr, '31', '✗')} ${message}\n`);
}

/** 普通叙述（stderr） */
export function info(message) {
  process.stderr.write(`${message}\n`);
}

/** 列表项（stderr） */
export function item(message) {
  process.stderr.write(`  - ${message}\n`);
}

/** 机读结果（stdout） */
export function out(text) {
  process.stdout.write(`${text}\n`);
}

/** JSON 结果（stdout） */
export function json(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
