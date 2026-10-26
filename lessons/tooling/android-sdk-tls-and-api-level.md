---
id: GEN-TOOL-0007
title: Android SDK 下载被 TLS 中断，且目录名不等于 API 级别
domain: tooling
tags: [android, sdkmanager, tls, mirror, api-level]
status: verified
scope: generic
applies_to: "Android SDK 命令行安装；受限网络环境"
summary: sdkmanager 走 Google 源会 TLS 中断需换镜像；平台目录名是代号，要按 API 号安装。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0009]
---

## 现象

两类问题经常同时出现：

1. `sdkmanager --list` 直接失败，退出码 1，日志含 `SSLHandshakeException` / TLS 中断。
2. 安装后 `platforms` 目录里出现 `android-UpsideDownCake`，但项目要求 API 34，仍报找不到平台。

## 根因

**问题一**：`sdkmanager` 默认访问 Google 源，受限网络下 TLS 握手被中断，列表与下载均失败。

**问题二**：Android 平台目录名是**版本代号**（如 `UpsideDownCake`），不是 API 级别。项目按 `compileSdk 34` 查找平台，目录名对不上就会报缺失。

## 处置

1. 通过镜像配置代理或替换 repository 地址，让 `sdkmanager` 走镜像。
2. 安装时**显式指定 API 号**，不要按目录名猜：

   ```bash
   sdkmanager "platforms;android-34" "build-tools;34.0.0"
   ```

3. 安装后核对目录与 `source.properties` 里的 `AndroidVersion.ApiLevel`。

## 证据

- 修复前：`sdkmanager --list` 退出码 1，日志为 TLS 握手失败。
- 走镜像后列表正常输出，`platforms;android-34` 安装成功。
- 目录名与 API 级别不一致曾导致构建报平台缺失，按 API 号安装后消失。

## 教训

- 「TLS 中断」先换源，再谈代理与证书；不要在受限网络下反复重试官方源。
- 平台目录名是代号，构建看的是 API 号，两者不能互相替代。
- 安装后用 `source.properties` 核对实际 API 级别，比看目录名可靠。

## 适用边界

- 适用：命令行安装 Android SDK、CI 中预装平台组件、受限网络环境。
- 不适用：Android Studio 图形化安装（内部已处理源与组件映射）；网络可直连官方源的环境。
