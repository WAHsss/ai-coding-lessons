---
id: GEN-BUILD-0008
title: 冷构建与首次 bundle 下发长达数分钟，先预热再启动真机
domain: build
tags: [rn, metro, cold-build, prewarm, timeout]
status: verified
scope: generic
applies_to: "React Native 0.7x metro dev server；首次构建 / 冷缓存场景"
summary: 冷构建耗时以分钟计，先用 PC 侧请求预热 bundle，再把长任务当后台任务处理。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0006]
---

## 现象

App 启动后长时间白屏或超时，看起来像「连不上 dev server」。反复重启 App 也不改善，容易误判成隧道或网络问题。

实测耗时（冷缓存）：

| 任务 | 耗时 |
|---|---|
| dev bundle 构建 | 563s |
| prd bundle 构建 | 633s |
| metro 首次向设备下发 bundle | 687s |
| APK `assembleDebug` | 9m2s |

## 根因

这不是连接问题，是**首次构建本身要几分钟**：依赖图建立、transform、序列化都在冷缓存下首次执行。设备侧等待有超时限制，超时后表现为「连不上」。

因此「白屏」和「连不上」在冷启动阶段是同一个现象。

## 处置

1. **先预热**：由 PC 侧直接请求一次 bundle，触发完整构建并把结果留在内存缓存：

   ```powershell
   Invoke-WebRequest -Uri 'http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false' -OutFile $env:TEMP\warm.bundle
   ```

   预热完成后再启动 App，设备侧基本是秒级拿到产物。

2. **长任务当后台任务**：构建、出包不要中途反复重启；用后台执行并等待完成通知。

3. 需要确认服务是否真的就绪时，查 `curl http://127.0.0.1:8081/status` 返回 `packager-status:running`。

## 证据

- 预热后设备侧加载 `13,502,042` 字节（dev bundle）在秒级完成。
- 预热请求本身在构建完成后返回，后续重复请求为秒级（命中内存缓存）。
- 同样的包在未预热时多次表现为白屏/超时。

## 教训

- 冷启动阶段的「白屏」先量一次构建耗时，再判断是不是网络问题。
- 预热是把「设备等待」换成「PC 等待」，成本一样但可控，且能提前暴露构建错误。
- 长任务被中途打断会丢掉已完成的缓存，恢复成本更高。

## 适用边界

- 适用：metro / Taro RN 冷缓存首次构建；CI 中首次产物生成。
- 不适用：热缓存下的增量构建（通常秒级，不需要预热）；已改为预构建产物的发布流程。
