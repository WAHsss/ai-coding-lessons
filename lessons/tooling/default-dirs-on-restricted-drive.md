---
id: GEN-TOOL-0005
title: 工具的默认目录落在受限盘（HOME/TEMP），需重定向到可写盘
domain: tooling
tags: [sandbox, temp, home, cache, junction, windows]
status: verified
scope: generic
applies_to: "Windows 受限沙箱；默认写 ~ 或 %TEMP% 的 CLI 工具"
summary: 配置写用户目录、缓存写临时目录的工具在受限环境会 EPERM，需 Junction 或环境变量重定向。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-TOOL-0004]
---

## 现象

迁移到新盘后首次启动 dev server，打印版本号后立即崩溃：

```
Error: EPERM: operation not permitted, mkdir 'C:\Users\<user>\.taro4.0'
```

预建该目录后错误变为 `EPERM: open 'C:\Users\<user>\.taro4.0\index.json'`。同时 `pnpm -v` 报 `cannot be loaded because running scripts is disabled`。

## 根因

两个默认路径同时踩坑：

- 配置目录：工具用 `os.homedir()` + 固定子目录，落在 C 盘用户目录顶层。
- 缓存目录：metro 用 `os.tmpdir()` + `metro-cache`，同样落在 C 盘。

沙箱**拒绝在用户目录顶层新建目录/文件**，于是 `mkdir` 与 `open` 均 EPERM。这与磁盘剩余空间无关，是权限边界。

## 处置

1. **目录迁移 + Junction**：把配置目录移到可写盘，原路径改为软链接：

   ```powershell
   New-Item -ItemType Junction -Path 'C:\Users\<user>\.taro4.0' -Target '<writable-dir>\.taro4.0'
   ```

2. **重定向临时目录**：启动前设 `TMP` / `TEMP` 到可写盘，缓存随之迁移。
3. **缓存类变量显式设置**：如 `GRADLE_USER_HOME`，否则 Gradle 缓存回落 C 盘且可能不读镜像。
4. **下载工具换实现**：`Invoke-WebRequest -OutFile` 写受限路径会被拒，改用 `curl.exe -s -o NUL`。

## 证据

- 修复后 `/status` 返回 `packager-status:running`；预热请求返回 `200` 且大小约 `13.9MB`。
- 新盘上的 `metro-cache` 实测约 `46MB`，C 盘对应缓存目录不再生成。
- 真机加载验证通过，构建在 Node 24 下可完成。

## 教训

- 换盘 / 换机后先确认工具链「默认写哪里」，而不是先怀疑版本或依赖。
- 配置写 `~`、缓存写 `%TEMP%` 的工具，都必须在受限环境里显式重定向。
- Junction 适合「工具硬编码路径」的情况，环境变量适合「工具支持配置」的情况，按工具选手段。

## 适用边界

- 适用：受限沙箱、C 盘空间紧张、多盘环境下的本地开发。
- 不适用：CI 的干净容器（临时目录可写且可丢弃）；已提供 `--cache-dir` 一类参数的工具可优先用参数。
