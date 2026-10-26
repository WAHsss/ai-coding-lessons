---
id: GEN-DEPLOY-0007
title: 裸 IP 访问返回 444 是 default server 的设计行为，不是故障
domain: deploy
tags: [nginx, default-server, 444, security, vhost]
status: verified
scope: generic
applies_to: "多域名 Nginx 站点；按 Host 头分发的配置"
summary: 444 由兜底 server 主动断连产生，属预期行为；验证必须带正确 Host 头。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-DEPLOY-0006]
---

## 现象

用 IP 直接访问服务器，`curl` 无响应或立即断开；`curl -I http://<ip>/` 返回异常，易被判定为 Nginx 没起来或端口没开。

带正确域名访问则一切正常。

## 根因

配置里存在一个兜底 server：

```nginx
server {
  listen 80 default_server;
  return 444;
}
```

`444` 是 Nginx 特有状态码，表示**不返回任何响应并直接关闭连接**。任何 Host 不匹配已配置域名的请求（含裸 IP）都会命中它。

这是**主动设计的拒答**，用于避免未知域名/扫描器命中默认站点。

## 处置

无需修复。验证时带上正确的 Host：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H 'Host: <domain>' http://127.0.0.1/
```

- 期望：`200`（或站点自身的 `301` 跳转）。
- 裸 IP 返回 444 / 空响应 = 兜底 server 按预期工作。

排查顺序：先确认兜底 server 存在且为 `default_server`，再确认目标域名 server 块监听同一端口。

## 证据

- 裸 IP 请求无响应；带正确 Host 头请求返回 `200`。
- Nginx 配置中 `00-default.conf` 明确包含 `return 444`。
- 删除兜底后，裸 IP 会命中第一个 server 块，反而出现「域名串站」风险。

## 教训

- `444` 不是错误码，是「主动断连」；看到它先想兜底规则，而不是端口或进程。
- 本机自检一律带 Host 头，否则测到的是默认 server 而不是目标站点。
- 兜底 server 应当保留，它承担的是防止默认站点泄露的作用。

## 适用边界

- 适用：多域名虚拟主机、按 Host 分发的 Nginx 部署。
- 不适用：单站点且直接用 IP 访问的服务；期望裸 IP 返回友好提示的场景（此时应换 `444` 为 403/301）。
