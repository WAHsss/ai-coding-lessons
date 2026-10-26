#!/usr/bin/env bash
# ai-coding-lessons 内容更新：git pull → 重建 dist/content.json → server/ 变更时重装依赖并重启。
# MCP 进程按 mtime 轮询（10s）自动热加载 content.json，纯内容更新无需重启服务。
#
# 由 gh-runner 的 crontab 每分钟触发：
#   * * * * * /data/app/ai-coding-lessons/deploy/update-content.sh >> /tmp/ai-coding-lessons-update.log 2>&1
#
# 前置（一次性配置）：
#   sudoers 允许 gh-runner 免密重启服务：
#     gh-runner ALL=(root) NOPASSWD: /usr/bin/systemctl restart ai-coding-lessons-mcp
set -euo pipefail

REPO=/data/app/ai-coding-lessons
LOCK=/tmp/ai-coding-lessons-update.lock

exec 9>"$LOCK"
flock -n 9 || exit 0

cd "$REPO"
git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

git pull --ff-only origin main
node scripts/build-content.mjs

if git diff --name-only "$LOCAL" "$REMOTE" | grep -q '^server/'; then
  corepack pnpm --dir server install --frozen-lockfile
  corepack pnpm --dir server run build
  sudo -n systemctl restart ai-coding-lessons-mcp
fi

echo "[$(date -Is)] updated $LOCAL -> $REMOTE"
