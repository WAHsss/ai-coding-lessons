---
id: GEN-DEPLOY-0002
title: 服务器本机 curl 访问 HTTPS 失败，先排除机器级代理
domain: deploy
tags: [curl, proxy, https, ssl, troubleshooting]
status: verified
scope: generic
applies_to: "Linux 服务器自检；配置了全局 HTTP(S)_PROXY 的主机"
summary: 本机代理会拦截回环请求并破坏证书校验，用 --noproxy 隔离验证。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-DEPLOY-0001]
---

## 现象

在服务器本机执行：

```bash
curl -I https://<domain>/
```

失败，典型两种报错：

```
curl: (60) SSL certificate problem: unable to get local issuer certificate
curl: (56) CONNECT tunnel failed, response 403
```

但外部访问同一域名是正常的。

## 根因

主机配置了机器级代理（`HTTP_PROXY` / `HTTPS_PROXY` 环境变量或系统级设置）。访问**本机回环**的请求也被转发给代理：

- 代理对回环地址返回 403（拒绝隧道）；
- 或代理做了中间人，返回它自己的证书链，本机用域名证书校验自然失败。

所以「本机能访问外网」与「本机能自检自己的 HTTPS 服务」是两件事。

## 处置

用 `--noproxy` 隔离验证，直连回环：

```bash
curl -sS --noproxy '*' -I https://<domain>/
```

对有证书覆盖的域名，可再显式指定解析：

```bash
curl -sS --noproxy '*' --resolve <domain>:443:127.0.0.1 https://<domain>/
```

拿到结果后，再把代理变量从服务进程环境中清理或加 `NO_PROXY=127.0.0.1,localhost,<domain>`。

## 证据

- 修复前：本机 curl 报证书错误 / 403，外网访问正常。
- `--noproxy '*'` 后返回 `200`，证书链校验通过。
- 检查环境变量可见 `HTTPS_PROXY` 指向内网代理。

## 教训

- 「本机不通、外面通」先怀疑代理，而不是证书或 Nginx 配置。
- 自检命令要显式绕过代理，否则测的是代理而不是服务。
- `NO_PROXY` 是长期解，`--noproxy` 是临时诊断手段，两者都要用。

## 适用边界

- 适用：配置了全局代理的服务器、容器、CI 环境做本机自检。
- 不适用：无代理环境（此时应查 DNS、证书、安全组，见 GEN-DEPLOY-0001）。
