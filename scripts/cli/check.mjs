import { run as runValidate } from './validate.mjs';
import { run as runBuild } from './build.mjs';

// 等价 npm run check：硬校验 → 索引新鲜度。strict 质量规则不进门禁。
export async function run({ flags = {} }) {
  const code = await runValidate({ flags: { ...flags, strict: false } });
  if (code !== 0) return code;
  return runBuild({ flags: { ...flags, check: true, 'index-only': false, 'content-only': false } });
}
