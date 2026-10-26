# 部署 ai-coding-lessons MCP 服务

目标：腾讯云 Ubuntu 24.04（已有 yzy 的 Docker Compose 栈），子域名 `lessons.e-top.online` 经 yzy-nginx 反代到本服务的容器。通配符证书已覆盖，无需重签。

架构：GitHub main → 宿主 cron 每分钟 `git pull` → 一次性容器重建 `dist/content.json` → 服务容器按 mtime 热加载。纯内容更新零重启；`server/` 变更时自动重建镜像并重启容器。宿主不需要安装 Node。

```
浏览器/Agent → yzy-nginx(容器) --yzy-net--> ai-coding-lessons-mcp(容器) --只读挂载--> dist/content.json
                                                                        ↑
                                                       宿主 cron: git pull + 一次性 node 容器构建
```

## 一次性部署

### 1. DNS

DNSPod 给 `e-top.online` 加 A 记录：主机记录 `lessons`，记录值 `49.233.65.244`。

### 2. 拉代码 + 建内容

仓库属主是 `gh-runner`，**所有写仓库目录的操作都必须以 gh-runner 身份执行**（否则容器内 `mkdir /repo/dist` 会 EACCES）。

```bash
sudo -u gh-runner -H git clone https://github.com/WAHsss/ai-coding-lessons.git /data/app/ai-coding-lessons
sudo -u gh-runner -H /data/app/ai-coding-lessons/deploy/update-content.sh --force
```

`--force` 表示「即使没有新提交也重建一次内容」，首次部署必用。

### 3. 启动容器

```bash
cd /data/app/ai-coding-lessons/deploy
sudo -u gh-runner -H docker compose up -d --build
docker compose ps                # 状态应为 running/healthy
docker compose logs -f mcp       # 预期输出 "ai-coding-lessons MCP（http）… 条经验"
```

网络名已确认是 `deploy_yzy-net`，与 `docker-compose.yml` 默认值一致，无需改配置。

### 4. nginx 反代

把 [nginx/40-lessons-mcp.conf](./nginx/40-lessons-mcp.conf) 复制为 yzy 仓库的 `yzy-h5/conf.d/40-lessons-mcp.conf`，按 yzy 发布流程提交（`git pull` 后 reload）：

```bash
docker exec yzy-nginx nginx -t
docker exec yzy-nginx nginx -s reload
```

不需要改 yzy 的 `docker-compose.yml`（两个容器同在 yzy-net，按容器名互通，也不占用宿主端口）。

### 5. 分钟级自动更新

加到 gh-runner 的 crontab（`sudo -u gh-runner crontab -e`）：

```
* * * * * /data/app/ai-coding-lessons/deploy/update-content.sh >> /tmp/ai-coding-lessons-update.log 2>&1
```

### 6. 验证

```bash
# 容器内健康检查
docker exec ai-coding-lessons-mcp node -e "fetch('http://127.0.0.1:8321/healthz').then(r=>r.text()).then(console.log)"

# 端到端：强制解析走服务器，验证 nginx + 证书 + 反代全链路
curl -sS --resolve lessons.e-top.online:443:49.233.65.244 https://lessons.e-top.online/healthz

# MCP 协议
curl -sS https://lessons.e-top.online/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_content_version","arguments":{}}}'
```

客户端 MCP 配置（Claude Code 等）：

```json
{ "mcpServers": { "ai-coding-lessons": { "type": "http", "url": "https://lessons.e-top.online/mcp" } } }
```

## 日常操作

| 场景 | 命令 |
|---|---|
| 看日志 | `cd /data/app/ai-coding-lessons/deploy && docker compose logs -f mcp` |
| 立即更新内容 | `sudo -u gh-runner -H /data/app/ai-coding-lessons/deploy/update-content.sh` |
| 强制重建内容（无新提交也重建） | `sudo -u gh-runner -H /data/app/ai-coding-lessons/deploy/update-content.sh --force` |
| 手动重建镜像 | `sudo -u gh-runner -H docker compose -f /data/app/ai-coding-lessons/deploy/docker-compose.yml build mcp` |
| 回滚到旧版本 | `sudo -u gh-runner -H git -C /data/app/ai-coding-lessons reset --hard <sha>`，再执行上一条并 `up -d mcp` |

## 红线

- **MUST NOT** 给 mcp 容器发布宿主端口（`ports:`）——它只需在 yzy-net 内被 nginx 访问；发布到公网等于绕过 nginx。
- **MUST NOT** 重签证书——通配符已覆盖。
- **MUST NOT** 手动 `chown /data/app`——属主必须是 gh-runner；一切写仓库目录的操作（clone/pull/建内容/compose build）都用 `sudo -u gh-runner -H`。
- **MUST NOT** 以其他账号跑 `update-content.sh`——脚本按仓库属主 uid/gid 启动构建容器，身份不符会 EACCES。
- 容器内 `HOST=0.0.0.0` 只作用于容器网络，不是公网暴露；改 `deploy/docker-compose.yml` 前先理解这点。

## 故障排查

- `EACCES: permission denied, mkdir '/repo/dist'` → 不是以 gh-runner 跑的，见步骤 2 的身份要求。
- `Cannot find module '/app/dist/src/index.js'` → 内容挂载覆盖了编译产物：内容必须挂到 `/app/content`，不能挂 `/app/dist`。
- 容器反复重启 / `healthz` 503 → `dist/content.json` 缺失：`update-content.sh --force`。
- `docker compose` 报 network not found → 网络名不是 `deploy_yzy-net`，用 `YZY_NETWORK=...` 覆盖。
- 外网 502 但 `docker exec ... healthz` 正常 → nginx conf 未生效或容器不在 yzy-net：`docker network inspect deploy_yzy-net | grep ai-coding-lessons`。
- 内容没更新 → 看 `/tmp/ai-coding-lessons-update.log`。
