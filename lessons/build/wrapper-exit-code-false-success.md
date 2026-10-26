---
id: GEN-BUILD-0001
title: 构建退出码 0 不代表成功：包装器只 spawn 不检查子进程
domain: build
tags: [build, exit-code, wrapper, artifact, bundle]
status: verified
scope: generic
applies_to: "Taro RN 构建链；任何 spawn 子进程后立即返回的构建包装器"
summary: 包装器不检查子进程退出码时退出码恒为 0，验收必须落到产物 mtime/尺寸/语法校验。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0003, GEN-BUILD-0006]
---

## 现象

`pnpm build:rn:prod` 打印完整流程日志后**正常结束、退出码 0**，但产物毫无变化：

- `android/app/src/main/assets/index.android.bundle` 的 mtime 与尺寸完全没变（实测 mtime `13:15:11`、size `3,769,511`）。
- 同一次构建的子进程日志里其实有错误：`error index.js: Unexpected token: punc (:)`。
- 实测同一命令同时得到 `TARO_EXIT=0` 与 `BUNDLE_UNCHANGED`。

## 根因

`@tarojs/rn-runner` 的非 watch 分支实现是：

```js
spawn(npx, ['react-native', 'bundle', ...], { stdio: 'inherit', shell: true })
// 随后立即
onFinish(null)
```

它**从不检查子进程退出码**，也**从不确认产物是否写出**。于是子进程失败被完全吞掉，包装器自己返回 0。凡是「只 spawn 不 await」的封装都会复现同一形态。

## 处置

把成功判据从「退出码」换成「产物级证据」，三选二即可定论：

1. **产物 mtime / 尺寸变化**（同一命令连跑两次应能区分）。
2. **内容命中数**：在产物里检索本次应注入的常量，如

   ```bash
   grep -c '<expected-api-base>' index.android.bundle
   ```

3. **语法校验**：`node --check index.android.bundle`，退出码非 0 即产物损坏。

CI 中同样应以产物断言替代退出码断言，否则流水线是绿的、包是坏的。

## 证据

- 同一命令：`TARO_EXIT=0`，`BUNDLE_UNCHANGED`，子进程日志含 `minifyCode ... Unexpected token`。
- 修复代码后：bundle 尺寸变化且 `node --check` 退出码 0，产物内目标常量命中数由 0 变为预期值。

## 教训

- 任何「包装器 + 子进程」的构建链都要先问一句：它检查子进程的退出码吗？不检查就等于没有退出码。
- 验收一律落到产物，日志和退出码只是线索。
- 反过来，把产物断言写进常规流程后，这类假成功不会再被误判为「构建成功、只是页面不对」。

## 适用边界

- 适用：Taro / RN / 自研 CLI 等 spawn 子进程后立即返回的封装层。
- 不适用：直接运行、退出码可信的原生构建命令（如直接调用 `react-native bundle`）；此时退出码仍是有效判据，但仍建议加产物断言。
