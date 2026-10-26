---
id: GEN-RN-0001
title: Hermes 不保留函数源码：Function.prototype.toString 识别实现恒为 false
domain: frontend/rn
tags: [hermes, runtime, polyfill, function-tostring, probe]
status: verified
scope: generic
applies_to: "React Native 0.7x + Hermes 引擎"
summary: 任何靠函数源码特征识别实现/桩的判定在 Hermes 上恒为 false，改用运行时探针。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-RN-0005]
---

## 现象

为覆盖上游「暂不支持」的错误桩，代码用函数源码做特征识别：

```js
String(fn).indexOf('暂不支持') !== -1
```

bundle 里代码确实存在且已执行（两种目标覆盖都在），真机上功能**照旧走错误桩**，日志仍输出 `RN 端暂不支持 API getStorageSync`。没有任何报错，覆盖分支被静默跳过。

对照组的判定正常生效：同文件里用 `typeof fn === 'function'` 判断存在性的补齐项全部工作。**只有依赖源码内省的那一项失效**——这个差异就是定位线索。

## 根因

Hermes 是预编译字节码引擎，**不保留函数源码**。`Function.prototype.toString()` 只返回：

```
function () { [bytecode] }
```

于是 `String(fn).indexOf(...)` 永远不命中，判定恒为 false。这条规律与具体 API 无关：任何「用源码特征识别实现、版本、桩」的手法在 Hermes 上都不可靠。

## 处置

改用**运行时探针**：调用候选函数，观察返回值形态，而不是读它的源码。

- 错误桩通常返回固定文案的 `Error` 实例，可用实现返回真实值 → 用 `instanceof Error` + 返回值类型区分。
- 探针只调用**读**接口，避免副作用。
- 调用期间临时静音 `console.error`，避免探测本身污染日志。

```js
function isUnsupported(fn) {
  const original = console.error;
  console.error = () => {};
  try {
    const value = fn();
    return value instanceof Error;
  } catch {
    return true;
  } finally {
    console.error = original;
  }
}
```

## 证据

- 真机日志：修复前持续输出 `RN 端暂不支持 API getStorageSync`；修复后该行消失，存储读写走真实实现。
- 产物校验：重启 dev server 后 bundle 内 `grep __compat_probe__`、`grep 'probe instanceof Error'` 命中，原 `String(value).indexOf(UNSUPPORTED_MARK)` 命中数为 0。
- bundle 尺寸由 `13,517,216` 变为 `13,518,584`，证明产物确实更新。

## 教训

- 在 RN 上做「实现探测」时，先问引擎是否保留源码。Hermes 下答案是否，一切源码特征判定都不成立。
- 静默失效最难查。用「同文件里已知能工作的判定」做对照，能快速把范围收敛到源码内省这一项。
- 探测要有边界：只调读接口、临时静音日志，避免为了识别而引入副作用。

## 适用边界

- 适用：Hermes 引擎（RN 默认）、字节码预编译环境、任何不保证 `toString()` 返回源码的运行环境。
- 不适用：JSC / V8 且保留源码的开发态；在那些环境下源码特征判定可用，但为了双端一致，仍建议统一改用运行时探针。
