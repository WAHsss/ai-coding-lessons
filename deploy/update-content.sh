#!/usr/bin/env bash
# ai-coding-lessons 内容更新（宿主无需安装 Node，内容构建走一次性容器）
#   1. git pull
#   2. 用 node:22-alpine 一次性容器重建 dist/content.json
#   3. 仅当 server/ 变更时重建镜像并重启容器；纯内容更新靠 mtime 热加载，不重启
#
# 由 gh-runner 的 crontab 每分钟触发：
#   * * * * * /data/app/ai-coding-lessons/deploy/update-content.sh >> /tmp/ai-coding-lessons-update.log 2>&1
# 前置：gh-runner 已在 docker 组（yzy 部署时已配置）。
set -euo pipefail

REPO=/data/app/ai-coding-lessons
COMPOSE="$REPO/deploy/docker-compose.yml"
LOCK=/tmp/ai-coding-lessons-update.lock

exec 9>"$LOCK"
flock -n 9 || exit 0

cd "$REPO"
git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

git pull --ff-only origin main

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$REPO":/repo -w /repo \
  --entrypoint node node:22-alpine scripts/build-content.mjs

if git diff --name-only "$LOCAL" "$REMOTE" | grep -q '^server/'; then
  docker compose -f "$COMPOSE" build mcp
  docker compose -f "$COMPOSE" up -d mcp
fi

echo "[$(date -Is)] updated $LOCAL -> $REMOTE"
