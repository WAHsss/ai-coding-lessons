---
id: GEN-TOOL-0008
title: 磁盘迁移后 venv 失效：改 pyvenv.cfg 的 home 即可，不必重建
domain: tooling
tags: [python, venv, pyvenv.cfg, migration, windows]
status: verified
scope: generic
applies_to: "Python 3.x venv（Windows / POSIX）；目录或磁盘迁移后"
summary: venv 启动器按 pyvenv.cfg 的 home 找基础解释器，迁移后改这一行胜过重建。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: []
---

## 现象

项目整体迁移到新盘后，虚拟环境完全不可用：

```
Fatal error in launcher: Unable to create process using 'E:\Env\python\python.exe ...'
```

或

```
python.exe did not find executable at 'E:\Env\python\...'
```

现有依赖、包都还在，但任何 `python -m` 调用都失败。

## 根因

`.venv\pyvenv.cfg` 里的 `home` 字段记录着**创建时**基础解释器的绝对路径。venv 启动器按该路径去找解释器；迁移后旧盘路径不存在，启动即失败。

依赖与包内容本身没问题，坏的只是一个路径字符串。

## 处置

改 `pyvenv.cfg` 的 `home` 指向新盘的真实 Python 目录：

```ini
home = <new-drive>\Env\python\cpython-<version>-windows-x86_64-none
```

改完直接使用，不需要重建 venv、不需要重装依赖。

## 证据

- 修复前：`Unable to create process using '<old-drive>\...'`，所有 python 调用失败。
- 修复后：`.venv\Scripts\python.exe -m pytest -q` 正常执行。
- 全量测试 `936 passed`，依赖版本未变。

## 教训

- 迁移后先查每个 venv 的 `pyvenv.cfg`；`did not find executable` 先看路径是否指向旧盘。
- 重建 venv 是最贵的做法，改一行 `home` 通常就够了。
- 多个 venv 要逐个检查，容易只修了主项目、漏了子目录里的环境。

## 适用边界

- 适用：Python venv（`pyvenv.cfg` 机制）在路径变化后的修复。
- 不适用：conda 环境（用 `conda env config vars` / 重建更稳）；跨操作系统迁移（二进制不兼容，需重建）。
