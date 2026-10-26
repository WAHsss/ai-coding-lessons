---
id: GEN-BUILD-0005
title: 配置顶层硬校验污染其他环境，环境配置要懒加载
domain: build
tags: [config, env, lazy-load, validation, taro]
status: verified
scope: generic
applies_to: "Taro 3.x / 多环境构建配置"
summary: 环境配置用静态 import 会让别的环境也被求值并触发校验，改为按环境懒加载。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-BUILD-0004]
---

## 现象

`TARO_APP_ENV=dev` 时构建，报的却是**生产校验错误**（例如「生产环境必须提供 API 地址」）。开发环境构建被生产规则拦住。

## 根因

`config/prod.ts` 在**模块顶层**对环境变量做硬校验（缺失即 `throw`）。若 `config/index.ts` 用静态 `import` 引入各环境配置，无论当前是什么环境，模块加载时都会求值 `prod.ts`，`throw` 立刻执行。

模块顶层副作用 + 静态导入 = 所有环境都被求值。

## 处置

改为按环境**懒加载**，只加载当前环境需要的模块：

```ts
const ENV_LOADERS: Record<string, () => Promise<any>> = {
  dev: () => import('./dev'),
  prd: () => import('./prod'),
};

const mod = await ENV_LOADERS[process.env.TARO_APP_ENV ?? 'dev']();
```

这样 `prod.ts` 只在 prd 构建时被加载与校验；校验本身保留在模块顶层即可，不需要下移到函数里。

## 证据

- 修复前：`TARO_APP_ENV=dev` 构建即抛生产校验错误。
- 修复后：dev / prd 各自构建成功，prd 缺少必要变量时仍按预期报错。
- 实现位置在配置入口文件的环境加载器段落，附注释说明。

## 教训

- 配置模块**不要有顶层副作用**；必须有的话，用懒加载隔离到对应环境。
- 「校验太严」的表象下，常见真实原因是「不该被求值的模块被求值了」。
- 保留严格校验本身是对的，问题在加载时机，不要因此削弱校验。

## 适用边界

- 适用：多环境构建配置（Taro / Vite / Webpack 的 env 分支）。
- 不适用：单环境项目；或所有环境共享且无副作用的常量配置（直接 import 即可）。
