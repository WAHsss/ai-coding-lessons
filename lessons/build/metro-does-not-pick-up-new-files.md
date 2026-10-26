---
id: GEN-BUILD-0006
title: 运行中的 metro 不拾取新增文件/新增目录，HTTP 200 不等于产物是新的
domain: build
tags: [metro, watch, dev-server, bundle, verification]
status: verified
scope: generic
applies_to: "React Native 0.7x + metro dev server；Taro RN watch 模式"
summary: 改完代码不重启 dev server 就拉包会拿到旧产物，验收必须 grep 本次新增符号。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0001, GEN-BUILD-0003]
---

## 现象

改动保存后拉 `/index.bundle`，返回 **200**、**体积也正常**，但新代码完全不在包里：

- 新建组件目录后，`grep PullRefreshScrollView` / `grep SafeAreaTop` 命中 **0**，而同一 bundle 里能看到更早批次的改动。
- 改完平台兼容层文件后，bundle 字节数与改码前**完全一致**（`13,517,216`），容易被误判为「改动没落盘」。
- 新增 `.rn.tsx` 平台文件后，模块解析缓存不失效，首轮 bundle 仍是旧实现。

## 根因

运行中的 metro 依赖文件监听来更新依赖图：

- 对**新增目录**，本机（或沙箱环境）的 watch 未感知，依赖图仍是启动时的快照。
- 对**被编辑的已有文件**，本轮实测不会重新 transform，缓存里的旧结果被继续发出。

于是「HTTP 200 + 体积正常」只能证明服务在响应，**不能证明产物是新的**。

## 处置

1. 修改引导层 / 平台层代码、新增文件或目录后，**重启 dev server** 再拉包。
2. 重启仍拿旧产物时，清 `%TEMP%\\metro-cache`（或等价缓存目录）后再启动。
3. 验收固定为「grep 本次新增的符号 / 模块路径」，例如：

   ```bash
   curl -s http://127.0.0.1:8081/index.bundle -o /tmp/index.bundle
   grep -c 'src/components/PullRefreshScrollView/index.rn.tsx' /tmp/index.bundle
   ```

4. 非 watch 构建在受限环境报 `spawn ENOMEM` 时，不要反复重试，直接改用 dev server 产物取证。

## 证据

- 改动前 bundle `size` = `13,517,216`；重启 dev server 后 `size` = `13,518,584`，且 `grep __compat_probe__`、`grep 'probe instanceof Error'` 命中，旧判定表达式命中数归零。
- 新增目录场景：重启后 bundle 内命中 `src/components/PullRefreshScrollView/index.rn.tsx`，真机 `force-stop` 重启后功能正常。

## 教训

- **HTTP 200 + 体积正常 ≠ 产物是新的**。体积只差几百字节时尤其危险。
- 「改了没生效」优先怀疑缓存与监听，而不是怀疑手误；判据永远是产物内容检索。
- 把「重启 dev server → 拉包 → grep 本次符号」固化成验证脚本，比每次临时判断可靠。

## 适用边界

- 适用：metro 系 dev server（Taro RN、react-native start），尤其是沙箱 / 容器内文件监听不可靠的环境。
- 不适用：纯静态构建且产物由 CI 从干净工作区生成；此时不存在监听问题，但仍建议保留产物断言。
