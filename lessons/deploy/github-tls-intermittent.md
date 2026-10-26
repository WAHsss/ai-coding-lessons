---
id: GEN-DEPLOY-0005
title: 服务器拉 GitHub 间歇性 TLS 中断，需重试加替代通道
domain: deploy
tags: [github, git, tls, network, retry]
status: verified
scope: generic
applies_to: "境外 Git 托管服务；网络质量波动的服务器"
summary: 同一命令时而成功时而 TLS 中断，属链路质量问题，用重试与 443 通道兜底。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-DEPLOY-0004]
---

## 现象

`git clone` / `git pull` 失败，报错形态不固定：

```
fatal: unable to access '...': gnutls_handshake() failed: The TLS connection was non-properly terminated.
fatal: unable to access '...': Failed to connect to github.com port 443: Connection timed out
```

**同一命令重跑有时就成功**，这是与「配置错误」最关键的区分点。

## 根因

链路质量导致 TLS 握手被中途重置或连接超时。既不是凭据问题，也不是仓库地址错误——否则重试不会成功。

## 处置

1. **带退避的重试**：3 次，间隔递增，作为部署脚本的默认行为。

   ```bash
   for i in 1 2 3; do
     git pull origin main && break
     sleep $((i * 5))
   done
   ```

2. **改走 443 端口的 SSH**：网络对 22 端口限制较严时更稳。

   ```bash
   # ~/.ssh/config
   Host github.com
     HostName ssh.github.com
     Port 443
     User git
   ```

3. **镜像或缓存层**：高频部署可加一层只读镜像，减少直连次数。

## 证据

- 失败与成功在同一主机、同一命令上交替出现，排除配置问题。
- 加入重试后部署成功率显著提升；改 443 通道后长时间稳定。
- 失败时的报错集中在握手阶段，无认证相关提示。

## 教训

- 「时好时坏」优先归因链路，不要反复检查密钥与权限。
- 部署脚本默认带重试；单次失败不应判定为配置错误。
- 长期方案用 443 通道或镜像，重试只是兜底。

## 适用边界

- 适用：网络质量波动环境拉取境外 Git 仓库。
- 不适用：稳定报 `Permission denied (publickey)`（属凭据问题，重试无效）；仓库地址 404（属配置问题）。
