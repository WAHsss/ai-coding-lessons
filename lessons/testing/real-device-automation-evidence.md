---
id: GEN-TEST-0001
title: 真机自动化验收取证：坐标每步现取、语义树判定、输入逐字符
domain: testing
tags: [adb, uiautomator, real-device, verification, automation]
status: verified
scope: generic
applies_to: "Android 真机 + adb + uiautomator；RN / 混合应用的自动化验收"
summary: 真机验收不要用静态坐标、截图体积和整串输入，改用实时 bounds、UI 语义树与逐字符输入。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: [GEN-TOOL-0001, GEN-RN-0001]
---

## 现象

三类互不相同但都表现为「脚本跑通、功能没通」的假成功：

1. `adb devices` 忽有忽无；`adb start-server` 报 `could not read ok from ADB Server` / `failed to start daemon`。
2. 点了「发送」但消息没发出去：页面仍停在欢迎态，输入框里还留着 `hello\n`。
3. 登录页整串输入密码（`adb shell input text <password>`）后，密文长度异常（首次约 17 位，清空重输仅 8 位），提交后提示「手机号或密码错误」。同一口令逐字符输入即成功。

## 根因

1. **沙箱会回收 adb server**，且受限沙箱内连 daemon 都起不来，必须在关闭沙箱的环境执行。
2. **软键盘会顶起布局**：输入框聚焦后，输入框与发送按钮的 bounds 整体上移（实测 y 由 `2518` 移到 `1069`）。按静态坐标点「发送」会点到键盘上。
3. **整串注入被合并或丢弃**：连续字符事件在部分输入框（尤其密码框）中被 InputConnection 合并，机制未完全取证，但「逐字符输入可成功」已确认与口令本身无关。
4. **停留在输入框的换行或残留文本**会让人误判「已发送」。

## 处置

1. adb 相关命令一律在**关闭沙箱**的环境执行；沙箱内 `devices` 结果不可信。
2. 点击前先收起软键盘，再取**实时** bounds 的中点：

   ```bash
   adb shell input keyevent 4
   adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml
   # 从 XML 解析目标节点的 bounds，计算中点后点击
   ```

3. 敏感输入**逐字符**注入，间隔约 250ms，输入完等 1~2 秒再提交。
4. 判定成功用 **UI 语义树**（文本节点、光标符号、按钮是否存在），不要用截图体积或「看起来像」。

## 证据

- `keyevent 4` 后按钮 bounds 回到 `[1287,2547][1410,2670]`，点击中点 `(1348,2608)` 后 dump 立刻出现用户气泡与流式光标 `▋`。
- 逐字符输入后密文为 9 位，点击登录 2 秒内进入目标页面；整串输入 3 次均停留在登录页。
- `uiautomator dump` 还能给出倒置 bounds（`y1 > y2`），用于判定元素被祖先裁剪。

## 教训

- 真机自动化的坐标**必须每步现取**，任何硬编码坐标在软键盘出现后都会失效。
- 判定成功要落到语义节点，而不是「点了按钮」或「截图像对的」。
- 密码类输入不要整串灌入；这类失败会伪装成「账号错误」，浪费大量排查时间。
- 沙箱环境与真机自动化天生冲突，先确认 adb 可用性再谈脚本逻辑。

## 适用边界

- 适用：Android 真机 / 模拟器的自动化和验收取证，尤其涉及输入框、软键盘、列表滚动。
- 不适用：单元测试与静态检查（不涉及 UI 布局）；纯 Web 端自动化（无 adb 与软键盘顶起问题）。
