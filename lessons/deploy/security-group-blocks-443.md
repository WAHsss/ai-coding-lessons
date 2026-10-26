---
id: GEN-DEPLOY-0001
title: 外网访问不通但本机 127.0.0.1 正常：先查云防火墙/安全组
domain: deploy
tags: [deploy, firewall, security-group, https, tls, troubleshooting]
status: verified
scope: generic
applies_to: "云服务器（腾讯云/阿里云等）+ Nginx + HTTPS"
summary: 域名或 IP 访问不通、本机回环却 200 时，先查云控制台安全组是否放通 443，别先改 Nginx。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: []
---

## 现象

浏览器访问 `https://<your-domain>` 报 `ERR_CONNECTION_RESET`；后来连裸 IP 也打不开。而服务器本机：

```bash
curl https://127.0.0.1/health -H 'Host: <your-domain>'
# 200，TLS 正常
```

Nginx `error.log` 里大量：

```
unexpected eof while reading ... while SSL handshaking
```

## 根因

Nginx 配置、证书、本机防火墙规则**均正常**。问题在云厂商控制台的**安全组 / 防火墙未放通 443 入站**：外部连接在 TLS 握手阶段被重置，根本到不了 Nginx。

本机回环流量不经过安全组，所以 `127.0.0.1` 测试全绿——这一点极具迷惑性，容易把人锁死在 Nginx 和证书里排查。

## 处置

1. 云控制台 → 该实例 → 防火墙/安全组 → 添加规则放通 `TCP 443`（按需同时放通 `80`）。
2. 放通后立即从**外部**验证，而不是再次只测回环：

   ```bash
   curl --noproxy '*' -vk https://<your-domain>/health
   ```

3. 验证时要显式绕开本机代理（`--noproxy '*'`），否则本机代理会伪装成「服务端问题」。

## 证据

- 放通前：本机 `curl --noproxy '*' -vk https://<your-domain>/health` TLS 握手失败/被 reset；`127.0.0.1` 带 Host 头返回 200。
- 放通后：同一地址返回 200，且输出含 `SSL certificate verify ok`。

## 教训

- 「外网不通 + 本机回环正常」几乎就是安全组特征，**先查控制台放行**，10 秒能定性。
- 分层验证顺序固定为：回环 → 本机公网 IP → 外部域名。跳层会浪费大量时间。
- `error.log` 里的 `while SSL handshaking` 是「握手被上游打断」的信号，指向网络层而非应用层。

## 适用边界

- 适用：云服务器（含轻量应用服务器）承载的 HTTP/HTTPS 服务；容器化部署同样适用（安全组在宿主机之外）。
- 不适用：本机开发环境、内网直连环境；这些场景没有云安全组这一层。
