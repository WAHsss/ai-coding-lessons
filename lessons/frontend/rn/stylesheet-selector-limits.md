---
id: GEN-RN-0022
title: RN StyleSheet 只认独立单类选择器，属性 / 复合多类 / 后代选择器全静默丢弃
domain: frontend/rn
tags: [rn, stylesheet, selector, c2rn, yoga, css-to-react-native]
status: verified
scope: generic
applies_to: "React Native Yoga StyleSheet；Taro RN / 任何用 css-to-react-native 的跨端样式管线"
summary: RN StyleSheet 仅接受 `.class-name` 单类选择器，[disabled] 属性选择器、.a.b 复合多类、.a .b 后代选择器均被静默丢弃，导致禁用态等样式在 RN 端不生效。
first_seen: 2026-10-29
last_verified: 2026-10-29
related: [GEN-RN-0003, GEN-RN-0006]
---

## 现象

跨端项目的按钮禁用态（`disabled` 时应显示灰底灰字）在 H5 / 小程序端正常，
但 RN 真机**始终显示正常态**（红底白字）。重启 metro、确认 `disabled=true` 已下发、
className 里已追加禁用修饰类，但禁用样式完全不生效——**无编译期报错、无运行期警告**。

## 根因

RN Yoga StyleSheet 只接受**独立单类选择器**（`.class-name`）。
`css-to-react-native`（以及 Taro 封装层 `taro-css-to-react-native`）在转换时，
以下三种 Web CSS 选择器会被**静默丢弃**：

1. **属性选择器** `.btn[disabled]` / `.btn[data-x]`
   - Yoga StyleSheet 无 DOM 属性概念，转换器无法解析 attribute selector token。

2. **复合多类选择器** `.btn.yzy-btn--disabled`
   - 转换器只取**第一个类名**生成样式键，后续类名静默丢弃。
   - 结果：`.btn.yzy-btn--disabled { background: #f5f5f5 }` 只命中 `.btn` 的基础样式，
     禁用态规则从未注册到 StyleSheet。

3. **后代/嵌套选择器** `.btn--disabled .yzy-btn-text` / `.a .b .c`
   - 转换器只取**最左侧选择器**。
   - 且 RN StyleSheet 用模块级注册（见 GEN-RN-0003 联动的 E-1 子组件 scss import），
     跨模块类名本就查不到，后代选择器在 RN 端彻底无效。

**三种组合使用（双轨制）也全踩雷**：
```scss
/* 以下三条在 RN 端全部静默丢弃 */
.btn[disabled] { background: #ccc }               /* ① 属性选择器不认 */
.btn.yzy-btn--disabled { background: #ccc }        /* ② 复合多类只取 .btn */
.btn--disabled .yzy-btn-text { color: #bbb }       /* ③ 后代选择器只取 .btn--disabled */
```

## 处置

**唯一安全方案**：tsx 手动追加独立修饰类 + scss 写独立单类选择器。

```tsx
// tsx：手动追加修饰类（不依赖 disabled 属性选择器）
<Button
  className={`my-btn${disabled ? ' my-btn--disabled' : ''}`}
  disabled={disabled}
>
  删除
</Button>
```

```scss
/* ✅ RN 唯一能识别的选择器类型：独立单类 */
.my-btn--disabled {
  background: #f5f5f5;
  border-color: #e5e5e5;
}

/* ❌ 属性选择器、复合、后代全不认 */
/* .my-btn[disabled] { ... }               */
/* .my-btn.yzy-btn--disabled { ... }       */
/* .my-btn--disabled .yzy-btn-text { ... } */
```

**文字色**：Button / Text 组件可以在 disabled 时自动切换文字色类（`.yzy-btn-text` →
`.yzy-btn-text-disabled`），彻底绕开"Text 不继承容器 color + 后代选择器不生效"的
双重打击（见 GEN-RN-0003）。

## 证据

- **项目内已生效参照**：ChatInputBar 发送按钮禁用态（`.chat-input-bar-send--disabled`）、
  lesson-plan 导出图标禁用态（`.lesson-plan-icon-btn--disabled`）均为独立单类选择器，
  RN 真机禁用视觉正常。
- **故障复现与修复对比**：
  - 修复前：class-detail 删除按钮禁用态 `.teacher-class-detail-plan-btn[disabled], .teacher-class-detail-plan-btn.yzy-btn--disabled { background: #f5f5f5 }`
    → RN 真机始终红底白字。
  - 修复后：改为 `.teacher-class-detail-plan-btn--danger-disabled { background: #f5f5f5 }` + tsx 手动追加
    → RN 真机灰底灰字正常。
- **通用化**：Button 组件 `disabled=true` 时自动追加 `yzy-btn--disabled` 通用类，
  同时自动切文字色类为 `yzy-btn-text-disabled`（color: #bbb）。

## 教训

1. RN StyleSheet **唯一安全的选择器类型**：独立单类 `.class-name`。
2. 跨端项目写 CSS 时，**从 day 1 就不要写**属性选择器、复合选择器、后代选择器——
   换独立单类，省掉"先写 Web 选择器 + 加 RN 兜底"的双重维护成本。
3. disabled 视觉的三件套：tsx 手动加修饰类 + scss 独立单类 + 组件自动切文字色。
4. 通用组件（如 Button）可以在内部**自动注入修饰类**和**切换文字色类**，
   让业务页面只需关心容器背景色，不用管文字色和 disabled 的三端一致性。

## 适用边界

- 适用：React Native Yoga StyleSheet；任何用 `css-to-react-native` / `taro-css-to-react-native` 的
  跨端样式管线（Taro RN、react-native-web 之外的 RN 项目）。
- 不适用：纯 Web / 小程序；手写 RN StyleSheet 对象（不存在 CSS 转译层）。
