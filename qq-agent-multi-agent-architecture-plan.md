# QQ Agent 多Agent系统架构方案

> 目标：在现有Demo基础上，实现画像记忆、自优化、自主交互三大能力
> 日期：2026-05-02
> 版本：v1.1

---

## 一、目标能力拆解

| Agent | 核心能力 | 触发方式 | 输出 |
|-------|---------|---------|------|
| **聊天Agent** (已有) | 回复建议、话术优化、精华提炼 | 用户主动 (悬浮球) | 即时建议 |
| **好友Agent** (新增) | 行为感知、画像分析、智能推送 | 后台定时 + 事件驱动 | 推送通知 / 侧边栏提醒 |

---

## 二、核心架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 UI 层 (index.html)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 聊天窗口 │  │  悬浮球  │  │ 推送Toast│  │画像提示  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent 编排层 (JS Classes)                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ ProfileMgr │  │BehaviorLog │  │ FriendAgent│            │
│  │ (画像CRUD) │  │ (事件埋点) │  │ (推送决策) │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│  ┌────────────┐  ┌────────────┐                            │
│  │ProfileUpdt │  │ ChatAgent  │                            │
│  │ (画像更新) │  │ (增强版)   │                            │
│  └────────────┘  └────────────┘                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   存储层 (localStorage)                       │
│  profile_{id} │ behavior_logs │ push_queue │ feedback_logs  │
│  history_{id} │ push_config   │ chat_msgs_{id}              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LLM 服务层                                 │
│  DeepSeek API (chat/completions) — 统一使用一个端点           │
└─────────────────────────────────────────────────────────────┘
```

**关键设计决策**：
- 全部跑在浏览器端，**零后端依赖**，存储用 localStorage
- 定时任务用 `setInterval`（页面存活时运行），无需 Service Worker
- 推送内容优先用 LLM 生成，失败时降级到预定义模板
- 画像注入到聊天 Agent 的 prompt 中，让回复更个性化

---

## 三、画像数据结构

**存储 Key**: `profile_{contact_id}`

```json
{
  "contact_id": "xiaoming",
  "contact_name": "小明",
  "contact_type": "friend",
  "created_at": "2026-05-01",
  "last_updated": "2026-05-02T16:00:00Z",

  "basic_info": {
    "avatar_color": "#12b7f5",
    "relationship": "close_friend",
    "tags": ["同事", "吃货"]
  },

  "communication_style": {
    "tone": "casual",
    "emoji_usage": "high",
    "preferred_topics": ["美食", "技术"],
    "avoided_topics": []
  },

  "interaction_history": {
    "total_messages": 0,
    "last_active_date": null,
    "frequent_times": [],
    "recent_topics": []
  },

  "preferences": {
    "notification_priority": "normal",
    "auto_reply_style": "enthusiastic"
  },

  "agent_insights": {
    "personality_summary": "",
    "communication_tips": "",
    "last_recommendation": null
  }
}
```

---

## 四、好友Agent 设计

### 4.1 核心能力

| 能力 | 描述 | 实现方式 |
|------|------|---------|
| **行为感知** | 记录聊天打开、消息发送、Agent调用等事件 | BehaviorLogger → localStorage |
| **画像分析** | 定期读取日志 + 对话历史，生成推送决策 | LLM 分析 + 规则引擎 |
| **智能推送** | 生成推送内容并通过 Toast + 侧边栏通知用户 | PushQueue → Toast UI |
| **反馈闭环** | 收集用户对推送的 👍/👎 反馈，调整推送策略 | 自优化引擎 |

### 4.2 推送类型

| 类型 | 优先级 | 触发条件 | 模板 |
|------|--------|---------|------|
| `reconnect` | 低 | 超过 7 天未对话 | "好久没和{name}聊天了，ta最近对{topic}很感兴趣" |
| `reminder` | 中 | 对话中有未完成的约定/待办 | "你答应过{name}要{action}" |
| `topic_suggest` | 低 | 对方画像有共同兴趣 | "{name}也喜欢{topic}，可以聊聊" |
| `reply_suggest` | 高 | 对方发了新消息待回复 | "建议回复：{suggested_reply}" |

### 4.3 频率控制

- 同一联系人每天最多 2 条推送
- 所有推送每天总计不超过 5 条
- 用户关闭或踩过某类型推送后，该类频率减半

---

## 五、画像自动更新流程

```
触发条件：用户切换联系人时检查，距上次更新超过 1 小时则触发

  1. 收集会话数据 (最近消息 + 行为日志)
          │
          ▼
  2. 统计活跃信息 (消息数、时间段、话题)
          │
          ▼
  3. LLM 生成更新建议 (旧画像 + 新数据 → 字段更新)
          │
          ▼
  4. 应用更新 + 记录更新日志
```

**LLM Prompt 模板**：

```
你是用户画像分析助手。根据以下信息更新画像。

【当前画像】{profile_json}

【最近对话】
{recent_messages}

【行为统计】
- 消息数：{count}
- 活跃时段：{active_hours}
- Agent使用：{agent_calls}次

输出 JSON：{"updates": {"field": "new_value"}, "insights": "分析说明"}
```

---

## 六、技术实现路径

### Phase 1: 画像系统基础

- `ProfileManager` 类：getProfile / updateProfile / createDefaultProfile
- 三个内置联系人的默认画像
- 聊天 Agent 读取画像数据，注入回复建议 prompt

### Phase 2: 行为日志

- `BehaviorLogger` 类：log(event, data) / getRecentLogs(hours)
- 关键埋点：聊天打开、消息发送、Agent 调用、推送交互
- 日志查询接口，支持时间范围过滤

### Phase 3: 好友Agent

- `FriendAgent` 类：定时检查 + 推送队列管理
- 推送 UI：Toast 通知 (顶部滑入) + 侧边栏红点
- LLM 生成推送内容，失败降级到固定模板
- 用户可一键采纳建议回复

### Phase 4: 画像更新

- `ProfileUpdater` 类：基于对话历史 + LLM 更新画像
- 切换联系人时自动触发（去抖 1 小时）
- 画像变更历史可追溯

### Phase 5: 自优化

- 推送反馈按钮 (👍/👎)
- 反馈数据驱动推送频率调整
- 设置面板可查看/重置画像数据

---

## 七、文件结构

```
demo/
├── index.html              # 单文件包含所有功能
│   ├── CSS: Push Toast / 通知样式
│   ├── HTML: 聊天界面 + 推送层 + 画像面板
│   └── JS: 所有类 + 业务逻辑
├── QQagent_project.md      # 项目计划（已有）
└── qq-agent-multi-agent-architecture-plan.md  # 本文件
```

---

## 八、风险与降级

| 风险 | 缓解 |
|------|------|
| LLM 调用失败 | 降级到预定义模板 + 规则引擎 |
| localStorage 满 | 限制日志长度 (最多 500 条)，画像控制在 5KB 以内 |
| 推送过频 | 严格的频率限制 + 用户反馈闭环 |
| 画像数据不准确 | 默认画像兜底 + 用户可手动重置 |

---

**文档版本**: v1.1
**日期**: 2026-05-02
