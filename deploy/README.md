# 部署 ai-coding-lessons MCP 服务

目标：腾讯云 Ubuntu 24.04（已有 yzy-nginx Docker 容器在跑），子域名 `lessons.e-top.online` 反代到本机 Node 服务。通配符证书已覆盖，无需重签。

架构：GitHub main → 服务器 cron 每分钟 `git pull` → 重建 `dist/content.json` → MCP 进程按 mtime 热加载。纯内容更新零重启；`server/` 变更时自动重装依赖并重启服务。

## 一次性部署

### 1. DNS

DNSPod 给 `e-top.online` 加 A 记录：主机记录 `lessons`，记录值 `49.233.65.244`。

### 2. 拉代码 + 构建

```bash
sudo -u gh-runner -H git clone https://github.com/WAHsss/ai-coding-lessons.git /data/app/ai-coding-lessons
cd /data/app/ai-coding-lessons
sudo -u gh-runner -H node scripts/build-content.mjs
sudo -u gh-runner -H corepack enable
sudo -u gh-runner -H corepack pnpm --dir server install --frozen-lockfile
sudo -u gh-runner -H corepack pnpm --dir server run build
```

### 3. systemd 服务

```bash
which node   # 核实路径，默认 /usr/bin/node；不一致则改 unit 里的 ExecStart
sudo cp deploy/systemd/ai-coding-lessons-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ai-coding-lessons-mcp
systemctl status ai-coding-lessons-mcp
curl -s http://127.0.0.1:8321/healthz   # 期望 {"ok":true,...}
```

### 4. nginx 反代

yzy-nginx 容器访问宿主机服务，先在 yzy 仓库 docker-compose 的 nginx 服务中加：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

把 [nginx/40-lessons-mcp.conf](./nginx/40-lessons-mcp.conf) 复制为 yzy 仓库的 `yzy-h5/conf.d/40-lessons-mcp.conf`，按 yzy 发布流程提交部署，然后：

```bash
docker exec yzy-nginx nginx -t
docker exec yzy-nginx nginx -s reload
```

### 5. 分钟级自动更新

允许 gh-runner 免密重启本服务（`sudo visudo -f /etc/sudoers.d/ai-coding-lessons`）：

```
gh-runner ALL=(root) NOPASSWD: /usr/bin/systemctl restart ai-coding-lessons-mcp
```

加到 gh-runner 的 crontab（`sudo -u gh-runner crontab -e`）：

```
* * * * * /data/app/ai-coding-lessons/deploy/update-content.sh >> /tmp/ai-coding-lessons-update.log 2>&1
```

### 6. 验证

```bash
# 端到端（本地 hosts 强制走服务器，验证 nginx + 证书 + 反代全链路）
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

## 红线

- **MUST NOT** 重签证书——通配符已覆盖。
- **MUST NOT** 手动 `chown /data/app`——属主必须是 gh-runner；手动操作用 `sudo -u gh-runner -H`。
- **MUST NOT** 把 8321 端口对公网开放——只对 nginx 容器经 host-gateway 暴露，防火墙无需放通。
- 服务监听 127.0.0.1 是刻意设计；改 0.0.0.0 前必须先确认腾讯云防火墙未放通 8321。

## 故障排查

- `healthz` 503 → content.json 未生成：`sudo -u gh-runner -H node scripts/build-content.mjs`
- 外网不通但 `curl http://127.0.0.1:8321/healthz` 正常 → 查 nginx conf 是否生效、DNS A 记录、腾讯云防火墙 443。
- 内容没更新 → 看 `/tmp/ai-coding-lessons-update.log`；手动跑 `sudo -u gh-runner -H /data/app/ai-coding-lessons/deploy/update-content.sh`。
