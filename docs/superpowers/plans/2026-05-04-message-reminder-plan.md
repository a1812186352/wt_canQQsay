# 消息未回复提醒 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在"小Q 监测授权"中新增消息未回复提醒功能，用户可为每个联系人独立设置提醒时长，已读超时未回复时小Q主动推送提醒。

**Architecture:** 在 XiaoQMemory 权限模型中加入 `reminder_enabled` 和 `reminder_minutes` 字段，新增 `last_read_ts` / `last_self_msg_ts` 状态追踪；UI 沿用现有 perm-row 模式；推送复用 FriendAgent 定时检查的规则引擎分支。

**Tech Stack:** 纯前端，localStorage 持久化，无外部依赖

---

## 文件结构

| 文件 | 改动 |
|------|------|
| `docs/js/config.js` | XiaoQMemory: 扩展 getPerms 默认值、新增 reminder 状态追踪方法 |
| `docs/js/app.js` | renderPermSection 加两行 UI、switchContact/sendMessage 加追踪钩子、新增 toggleReminderPerm/setReminderMinutes 处理函数 |
| `docs/js/friend-agent.js` | _analyzeContact 规则引擎分支加未回复提醒判断 |

---

### Task 1: 扩展 XiaoQMemory 权限模型和状态追踪

**文件:**
- 修改: `docs/js/config.js:181-190` (getPerms/setPerms)

- [ ] **Step 1: getPerms 默认值加入 reminder 字段**

在 `docs/js/config.js` 第 183 行，修改 `getPerms` 的默认返回值：

```js
return p[contactId] || { observe: true, auto_summarize: true, context_length: 15, reminder_enabled: false, reminder_minutes: 30 };
```

- [ ] **Step 2: 新增 REMINDER_KEY 和状态读写方法**

在 `docs/js/config.js` 第 172 行 `BUF_PREFIX` 下方插入：

```js
REMINDER_KEY: 'xiaoq_reminder_state',

_reminderState() {
  try { return JSON.parse(localStorage.getItem(this.REMINDER_KEY)) || {}; }
  catch (e) { return {}; }
},
_saveReminderState(s) { try { localStorage.setItem(this.REMINDER_KEY, JSON.stringify(s)); } catch (e) {} },

markRead(contactId) {
  var s = this._reminderState();
  if (!s[contactId]) s[contactId] = {};
  s[contactId].last_read_ts = Date.now();
  this._saveReminderState(s);
},

markReplied(contactId) {
  var s = this._reminderState();
  if (!s[contactId]) s[contactId] = {};
  s[contactId].last_self_msg_ts = Date.now();
  this._saveReminderState(s);
},

getReminderState(contactId) {
  var s = this._reminderState();
  return s[contactId] || { last_read_ts: null, last_self_msg_ts: null };
},
```

- [ ] **Step 3: 提交**

```bash
git add docs/js/config.js
git commit -m "feat: add reminder_enabled, reminder_minutes permissions and read/reply tracking to XiaoQMemory"
```

---

### Task 2: 新增设置 UI（未回复提醒开关 + 时长选择）

**文件:**
- 修改: `docs/js/app.js:473-505` (renderPermSection)

- [ ] **Step 1: 在 renderPermSection 中追加两行 UI**

将 `docs/js/app.js` 的 `renderPermSection` 函数中，第 503 行的 `</div>'` 替换为：

```js
    '</div>' +
    '<div class="perm-row">' +
      '<div class="perm-info">' +
        '<span class="perm-label">未回复消息提醒</span>' +
        '<span class="perm-desc">开启后小Q会在你已读但超时未回复时主动提醒</span>' +
      '</div>' +
      '<label class="toggle">' +
        '<input type="checkbox" id="permReminder" ' + (perms.reminder_enabled ? 'checked' : '') + ' onchange="QQAgent.toggleReminderPerm()">' +
        '<span class="toggle-slider"></span>' +
      '</label>' +
    '</div>' +
    '<div class="perm-row" id="reminderMinutesRow" style="display:' + (perms.reminder_enabled ? '' : 'none') + ';">' +
      '<div class="perm-info">' +
        '<span class="perm-label">提醒时长</span>' +
        '<span class="perm-desc">已读消息后超过此时间未回复即提醒</span>' +
      '</div>' +
      '<select id="reminderMinutes" onchange="QQAgent.setReminderMinutes()" style="border:1px solid #ddd;border-radius:6px;padding:4px 8px;font-size:14px;">' +
        '<option value="10"' + (perms.reminder_minutes === 10 ? ' selected' : '') + '>10 分钟</option>' +
        '<option value="15"' + (perms.reminder_minutes === 15 ? ' selected' : '') + '>15 分钟</option>' +
        '<option value="30"' + (perms.reminder_minutes === 30 ? ' selected' : '') + '>30 分钟</option>' +
        '<option value="60"' + (perms.reminder_minutes === 60 ? ' selected' : '') + '>60 分钟</option>' +
      '</select>' +
    '</div>';
```

- [ ] **Step 2: 新增 toggleReminderPerm 处理函数**

在 `docs/js/app.js` 的 `toggleContactPerm` 函数后面（约 523 行），插入：

```js
function toggleReminderPerm() {
  var perms = XM.getPerms(currentContact);
  perms.reminder_enabled = !perms.reminder_enabled;
  XM.setPerms(currentContact, perms);
  renderPermSection();
  showToast(perms.reminder_enabled ? '已开启未回复消息提醒（' + (perms.reminder_minutes || 30) + '分钟）' : '已关闭未回复消息提醒');
}

function setReminderMinutes() {
  var el = document.getElementById('reminderMinutes');
  var perms = XM.getPerms(currentContact);
  perms.reminder_minutes = parseInt(el.value) || 30;
  XM.setPerms(currentContact, perms);
  showToast('提醒时长已设为 ' + perms.reminder_minutes + ' 分钟');
}
```

- [ ] **Step 3: 导出新函数**

在 `docs/js/app.js` 的 `Object.assign(ns, {...})` 块中，加入两个新函数名：

```js
Object.assign(ns, {
  switchContact, sendMessage, runAgent, handleKey, useReply,
  dismissCurrentPush, showPushPanel, feedbackPush,
  openSettings, closeSettings, saveSettings, resetProfile, resetAllData, clearChat,
  toggleContactPerm, toggleReminderPerm, setReminderMinutes,
});
```

并在 window 全局绑定后面追加：

```js
window.toggleReminderPerm = toggleReminderPerm;
window.setReminderMinutes = setReminderMinutes;
```

- [ ] **Step 4: 提交**

```bash
git add docs/js/app.js
git commit -m "feat: add reminder toggle and minutes selector UI to perm section"
```

---

### Task 3: 接入已读/回复追踪钩子

**文件:**
- 修改: `docs/js/app.js:62-103` (switchContact), `docs/js/app.js:389-413` (sendMessage)

- [ ] **Step 1: switchContact 中记录已读**

在 `docs/js/app.js` 的 `switchContact` 函数中，`chatOpenTime = Date.now();` 之后（约第 83 行），插入：

```js
if (contact.type !== 'agent') {
  XM.markRead(id);
}
```

- [ ] **Step 2: sendMessage 中记录回复**

在 `docs/js/app.js` 的 `sendMessage` 函数中，`localStorage.removeItem('draft_' + currentContact);` 之后（约第 397 行），插入：

```js
XM.markReplied(currentContact);
```

- [ ] **Step 3: 验证提交**

```bash
git add docs/js/app.js
git commit -m "feat: wire read/reply tracking hooks into switchContact and sendMessage"
```

---

### Task 4: FriendAgent 规则引擎加入未回复提醒判断

**文件:**
- 修改: `docs/js/friend-agent.js:99-109` (_analyzeContact 规则引擎分支)

- [ ] **Step 1: 在规则引擎中追加未回复提醒判断**

将 `docs/js/friend-agent.js` 的 `_analyzeContact` 方法中，规则引擎分支（约第 99-109 行）替换为：

```js
    // Rule-based fallback
    var otherMsgs = messages.filter(function(m) { return m.type === 'other'; });
    var selfMsgs = messages.filter(function(m) { return m.type === 'self'; });

    if (otherMsgs.length > selfMsgs.length && contact.type === 'friend') {
      return {
        should_push: true, push_type: 'reply_suggest', priority: 'medium',
        content: contact.name + ' 给你发了消息，用悬浮球中的智能回复建议来快速回复',
      };
    }

    // 未回复提醒
    var perms = ns.XiaoQMemory.getPerms(contact.id);
    if (perms.reminder_enabled && contact.type === 'friend') {
      var reminderState = ns.XiaoQMemory.getReminderState(contact.id);
      var lastOtherTs = otherMsgs.length > 0 ? otherMsgs[otherMsgs.length - 1].time : 0;
      var lastSelfTs = reminderState.last_self_msg_ts || 0;
      var lastReadTs = reminderState.last_read_ts || 0;
      var reminderMs = (perms.reminder_minutes || 30) * 60 * 1000;

      if (lastOtherTs > lastSelfTs && lastReadTs > 0 && (Date.now() - lastReadTs) > reminderMs) {
        var elapsedMin = Math.round((Date.now() - lastReadTs) / 60000);
        return {
          should_push: true, push_type: 'reminder', priority: 'medium',
          content: '你有一条来自' + contact.name + '的消息还没回复哦，已经' + elapsedMin + '分钟了',
        };
      }
    }

    return { should_push: false };
```

- [ ] **Step 2: 提交**

```bash
git add docs/js/friend-agent.js
git commit -m "feat: add no-reply reminder check to FriendAgent rule engine"
```

---

### Task 5: 手动验证

- [ ] **Step 1: 打开应用测试**

用浏览器打开 `docs/index.html`，验证以下流程：

1. 打开设置 → 选择小明 → 开启"未回复消息提醒"，设时长 10 分钟
2. 切换到小明聊天 → 观察小Q 面板的记忆状态
3. 修改 `docs/config/agent-rules.json` 中 `check_interval_seconds` 为 10 用于快速测试
4. 等待一次定时检查（约 10 秒），确认在没有超时的情况下不会误推
5. 模拟超时：在浏览器控制台执行 `QQAgent.XiaoQMemory.markRead('xiaoming')` 时传入一个过去的时间戳来测试
6. 验证推送类型为 `reminder`，内容包含联系人名称和等待时长
