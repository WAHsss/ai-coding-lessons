---
id: GEN-RN-0004
title: position: fixed 在 RN（Yoga）中是无效值，全屏浮层要用 Modal 或根级容器
domain: frontend/rn
tags: [rn, yoga, position-fixed, modal, overlay]
status: verified
scope: generic
applies_to: "React Native 0.7x（Yoga）；Taro RN 页面"
summary: RN 只支持 absolute/relative，fixed 会被原样编译进 bundle 后被原生侧忽略，全屏浮层改用 Modal。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-RN-0002]
---

## 现象

二次确认弹窗没有居中悬浮，而是**贴在页面末尾**；遮罩只覆盖页面下半部分——按钮条以下的区域被压暗，页面主体没有被 dim。

样式写法：

```css
.confirm-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); }
```

## 根因

Yoga 只支持 `absolute` 与 `relative`。`position: fixed` 是**无效值，不是降级值**：

- 该值被原样编译进 bundle（实测产物内为 `"confirm-mask": {"position": "fixed", ...}`）。
- 原生侧忽略后，元素退回**文档流普通块**，不脱离布局。
- 叠加 Taro RN 页面默认被 `ScrollView` 包裹（`@tarojs/runtime-rn` 的 `createScrollPage`），遮罩既盖不满视口，也会随内容滚动。

## 处置

按平台分文件，RN 用原生 `Modal`：

```tsx
// index.rn.tsx
<Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
  <View className="confirm-mask-rn">
    {/* 复用 confirm-card / title / content / actions 样式 */}
  </View>
</Modal>
```

```css
.confirm-mask-rn { flex: 1; background: rgba(0,0,0,.45); justify-content: center; align-items: center; }
```

`Modal` 是独立窗口层级，天然全屏，不受祖先裁剪与页面滚动影响。H5 / 小程序继续走 `index.tsx`。

若不能用 `Modal`（如需与页面共享手势），退而挂到**页面根级容器**，并确保该容器不滚动、不被裁剪。

## 证据

- 重启 dev server 后从 bundle 拉取，命中 `index.rn.tsx`，含 `_reactNative.Modal` 与 `"confirm-mask-rn": {"flexGrow":1,"flexShrink":1,"flexBasis":0,...}`。
- 使用该组件的 4 个页面共 `47` 例用例通过。
- 真机复验：弹窗居中、遮罩覆盖全屏（用户确认）。

## 教训

- `position: fixed` 不要出现在任何跨端样式里；它在 RN 上不会有任何警告，只会安静地错位。
- 全屏浮层的正确解法只有两个：`Modal` 独立窗口，或不裁剪不滚动的根级容器。
- 新增 `.rn.tsx` 平台文件后 metro 模块解析缓存不失效，**必须重启 dev server** 再从产物确认命中（首轮 bundle 仍是旧实现）。

## 适用边界

- 适用：RN / Taro RN 全屏遮罩、确认弹窗、抽屉类浮层。
- 不适用：H5 / 小程序（`position: fixed` 正常）；RN 中需要参与页面滚动排版的元素也不应改 Modal，应走文档流方案（见 GEN-RN-0002）。
