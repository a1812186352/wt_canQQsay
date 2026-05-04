# 消息未回复提醒 — 设计说明

日期：2026-05-04

## 概述

在"小Q 监测授权"中新增"消息未回复提醒"功能。用户可为每个联系人独立开启，设置提醒时长。当用户已读对方消息但在设���时长内未回复时，小Q 主动推送提醒。

## 数据模型

### 权限扩展（XiaoQMemory）

每个联系人的权限对象新增：

- `reminder_enabled` (boolean, 默认 false) — 是否开启未回复提醒
- `reminder_minutes` (number, 默认 30) — 提醒时长（分钟）

### 运行时状态追踪（XiaoQMemory）

- `last_read_ts[contactId]` — 用户最后一次打开该联系人聊天的时间戳
- `last_self_msg_ts[contactId]` — 用户最后一次回复该联系人的时间戳

## UI 变更（renderPermSection）

在现有"上下文长度"下方新增两行：

1. **未回复消息提醒** — toggle 开关，控制 `reminder_enabled`
2. **提醒时长** — 下拉选择（10/15/30/60 分钟），仅在开关开启时显示

## 追踪逻辑（app.js）

| 事件 | 触发位置 | 操作 |
|------|----------|------|
| 用户打开联系人聊天 | `switchContact()` | `XiaoQMemory.markRead(contactId)` |
| 用户发送消息 | `sendMessage()` | `XiaoQMemory.markReplied(contactId)` |

## 推送逻辑（friend-agent.js — _analyzeContact 规则引擎分支）

在现有 `reply_suggest` 判断之后追加判断：

```
reminder_enabled === true
  AND 对方最后一条消息时间 > last_self_msg_ts（有未回复消息）
  AND now() - last_read_ts > reminder_minutes × 60 × 1000（超过提醒时长）
→ push_type: "reminder"
→ content: "你有一条来自{name}的消息还没回复哦"
```

## 边界处理

- 未开启 observe → 不追踪，不提醒
- 用户已回复 → 不提醒
- 同一联系人不重复推送（由 FriendAgent maxPerContact 和每日上限控制）
- 小Q 自身和群聊不受此功能影响

## 涉及文件

- `docs/js/config.js` — XiaoQMemory 权限模型 + 状态追踪
- `docs/js/app.js` — renderPermSection、switchContact、sendMessage
- `docs/js/friend-agent.js` — _analyzeContact 规则引擎分支
- `docs/index.html` — 如需新增 CSS class
- `docs/styles.css` — 如需新增样式
