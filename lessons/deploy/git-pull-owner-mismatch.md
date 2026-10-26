---
id: GEN-DEPLOY-0003
title: git pull 报属主不匹配：用仓库属主身份拉取，不要 chown
domain: deploy
tags: [git, ownership, runner, ci, permissions]
status: verified
scope: generic
applies_to: "Linux 服务器上由其他用户部署的仓库；CI runner 与仓库属主不同"
summary: 拉取命令以仓库属主身份执行即可；改属主会让后续部署链路权限更乱。
first_seen: 2026-10-18
last_verified: 2026-10-26
related: []
---

## 现象

CI runner 升级或迁移后，部署步骤批量失败：

```
fatal: detected dubious ownership in repository at '<repo>'
```

或直接 `Permission denied` / `EACCES`，无法写入。

## 根因

仓库目录由**部署用户**（如 `deploy` / `www-data`）创建并拥有，而当前执行拉取的是**另一个用户**（runner / 登录用户）。git 出于安全会拒绝操作「属主不是自己」的仓库，文件写入同样受限。

## 处置

以仓库属主身份执行拉取：

```bash
sudo -u <owner> -H git -C <repo> pull origin main
```

- `-H` 保证使用目标用户 HOME，避免 git 配置错位。
- 需要写文件的操作（构建产物、内容生成）也用同一身份执行。

**不要** `chown -R` 改属主：这会破坏原有部署链路的权限假设，后续服务或定时任务可能反而失去写权限。

## 证据

- 修复前：runner 执行 pull 报 `dubious ownership`，写产物 `EACCES`。
- 修复后：同一命令以属主身份执行，pull 与产物写入均成功，服务正常读取。
- 定时任务中同样以属主身份执行，未再出现权限错误。

## 教训

- 「权限不足」先分清是**谁**在操作、目录**属于谁**；多半是身份不匹配而不是权限位缺失。
- 改属主只是把问题转移给下一条链路；以正确身份执行才是收敛解法。
- 自动化脚本里凡涉及仓库读写，都要显式声明执行身份。

## 适用边界

- 适用：多用户 Linux 服务器、CI runner 与部署用户不同的仓库。
- 不适用：单用户环境；仓库确实需要转移所有权（此时应连带调整所有依赖方）。
