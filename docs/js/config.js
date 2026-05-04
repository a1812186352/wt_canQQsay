// ===================================================================
//  config.js — 联系人、Agent提示词、Mock数据、默认画像模板
//  修改此文件即可调整所有数据配置
// ===================================================================
window.QQAgent = window.QQAgent || {};

(function (ns) {

// ---- 联系人定义 ----
ns.CONTACTS = [
  {
    id: 'xiaoq', name: '小Q', avatar: 'Q', avatarBg: '#7c5cfc', type: 'agent',
    opening: '你好，我是小Q — 你的QQ智能助手。我会记住你在QQ上的一切操作，在需要时主动提醒你。',
    autoReplies: [],
  },
  {
    id: 'xiaoming', name: '小明', avatar: '明', avatarBg: '#12b7f5', type: 'friend',
    opening: '周末有空吗？好久没聚了，一起出来吃个饭怎么样？🌶️',
    autoReplies: ['哈哈好呀，那去哪吃？', '我都可以，你定吧！', '行，那就周六晚上吧，我订个位', 'OK，到时候见！'],
  },
  {
    id: 'xiaohong', name: '小红', avatar: '红', avatarBg: '#f759ab', type: 'friend',
    opening: '最近项目压力好大😮‍💨 天天加班，感觉快撑不住了... 你那边怎么样？',
    autoReplies: ['唉，老板又加了新需求，这周估计又得加班', '羡慕你那边轻松... 我都想跳槽了', '嗯你说得对，我得和老板谈谈', '谢谢你的建议！心情好多了~'],
  },
  {
    id: 'project_group', name: '项目讨论群', avatar: '群', avatarBg: '#52c41a', type: 'group',
    groupMembers: ['张三', '李四', '王五'], opening: null, autoReplies: [],
  },
];

// ---- 从 JSON 文件加载画像模板 ----
ns.loadDefaultProfiles = async function () {
  const profileIds = (ns.CONTACTS || []).map(c => c.id);
  const profiles = {};
  for (const id of profileIds) {
    try {
      const res = await fetch(`profiles/${id}.json`);
      if (res.ok) { profiles[id] = await res.json(); continue; }
    } catch (e) { /* fetch 失败，用硬编码兜底 */ }
    if (ns.DEFAULT_PROFILES[id]) {
      profiles[id] = JSON.parse(JSON.stringify(ns.DEFAULT_PROFILES[id]));
    }
  }
  return profiles;
};

ns.loadAgentRules = async function () {
  try {
    const res = await fetch('config/agent-rules.json');
    if (res.ok) return await res.json();
  } catch (e) { /* fetch 失败，用硬编码兜底 */ }
  return null;
};

// ---- 硬编码画像模板（fallback：file:// 协议或 fetch 失败时使用） ----
ns.DEFAULT_PROFILES = {
  xiaoq: {
    contact_id: 'xiaoq', contact_name: '小Q', contact_type: 'agent',
    created_at: '2026-05-02', last_updated: new Date().toISOString(),
    basic_info: { avatar_color: '#7c5cfc', relationship: 'assistant', tags: ['AI助手', '记忆管家'] },
    communication_style: { tone: 'professional', emoji_usage: 'low', preferred_topics: ['提醒', '总结', '建议'], avoided_topics: [] },
    interaction_history: { total_messages: 0, last_active_date: null, frequent_times: [], recent_topics: [] },
    preferences: { notification_priority: 'high', auto_reply_style: 'helpful' },
    agent_insights: { personality_summary: '你的QQ智能管家，记住你在QQ上的一切，在需要时主动提醒', communication_tips: '它会静默观察所有操作，只在需要时出现', last_recommendation: null },
  },
  xiaoming: {
    contact_id: 'xiaoming', contact_name: '小明', contact_type: 'friend',
    created_at: '2026-05-02', last_updated: new Date().toISOString(),
    basic_info: { avatar_color: '#12b7f5', relationship: 'close_friend', tags: ['同事', '吃货'] },
    communication_style: { tone: 'casual', emoji_usage: 'high', preferred_topics: ['美食', '旅游'], avoided_topics: [] },
    interaction_history: { total_messages: 0, last_active_date: null, frequent_times: [], recent_topics: [] },
    preferences: { notification_priority: 'high', auto_reply_style: 'enthusiastic' },
    agent_insights: { personality_summary: '开朗外向，喜欢美食和游戏，工作日晚上活跃', communication_tips: '可以用轻松幽默的语气，适当使用表情包', last_recommendation: null },
  },
  xiaohong: {
    contact_id: 'xiaohong', contact_name: '小红', contact_type: 'friend',
    created_at: '2026-05-02', last_updated: new Date().toISOString(),
    basic_info: { avatar_color: '#f759ab', relationship: 'friend', tags: ['同事', '加班党'] },
    communication_style: { tone: 'venting', emoji_usage: 'medium', preferred_topics: ['工作', '吐槽', '生活'], avoided_topics: ['薪资'] },
    interaction_history: { total_messages: 0, last_active_date: null, frequent_times: [], recent_topics: [] },
    preferences: { notification_priority: 'normal', auto_reply_style: 'empathetic' },
    agent_insights: { personality_summary: '工作压力较大，喜欢吐槽和寻求建议', communication_tips: '多倾听，给予支持和建设性建议', last_recommendation: null },
  },
  project_group: {
    contact_id: 'project_group', contact_name: '项目讨论群', contact_type: 'group',
    created_at: '2026-05-02', last_updated: new Date().toISOString(),
    basic_info: { avatar_color: '#52c41a', relationship: 'group', tags: ['工作群', '技术'], members: ['张三', '李四', '王五'] },
    communication_style: { tone: 'mixed', preferred_topics: ['项目', '聚餐', '团建'], avoided_topics: [] },
    interaction_history: { total_messages: 0, last_active_date: null, frequent_times: [], recent_topics: [] },
    preferences: { notification_priority: 'low', auto_reply_style: 'neutral' },
    agent_insights: { personality_summary: '群聊，包含三人讨论，话题覆盖项目和生活', communication_tips: '关注多人观点，提炼共识和分歧', last_recommendation: null },
  },
};

// ---- Agent 提示词 (优化为更口语化的输出) ----
ns.AGENT_PROMPTS = {
  text_optimize: '你是一个话术优化助手。把用户输入的话用更委婉得体的方式表达出来，保持原意，但听起来更舒服。直接说人话，别用AI腔。用JSON格式回复：{"optimized":"优化后文本","note":"一句话解释改了哪里"}',
  summary: '你帮用户看聊天记录，提取重点。像朋友聊天一样说清楚：聊了啥、要做什么、决定了什么。别用markdown、别用列表符号，就是自然的句子。用JSON格式：{"topics":["话题1","话题2"],"todos":["待办1"],"decisions":["决定1"],"brief":"一两句话概括"}',
};

// ---- 动态 Prompt 构建函数 ----
ns.buildSmartReplyPrompt = function (profileSummary) {
  return `你正在帮一个QQ用户回复好友消息。

${profileSummary.personality ? '对方是什么样的人：' + profileSummary.personality : ''}
你们的关系：${profileSummary.relationship}
对方说话风格：${profileSummary.tone}
常聊的话题：${profileSummary.topics}
沟通建议：${profileSummary.tips}

先一句话说清楚对方想表达的意思，然后给3个不同风格的回复（简洁、热情、幽默），要像真人QQ聊天一样自然，不要有AI痕迹。

用JSON回复：{"summary":"对方想说...","replies":[{"style":"简洁","text":"回复内容"},{"style":"热情","text":"回复内容"},{"style":"幽默","text":"回复内容"}]}`;
};

ns.buildFriendAnalysisPrompt = function (profile, stats, messages) {
  return `你是好友关系分析助手。

【好友画像】${JSON.stringify({ name: profile.contact_name, relationship: profile.basic_info.relationship, tone: profile.communication_style.tone, topics: profile.communication_style.preferred_topics })}

【今日统计】消息:${stats.message_count}条 Agent使用:${stats.agent_calls}次

【最近消息】${messages.slice(-4).map(m => `[${m.type === 'self' ? '我' : (m.sender || '对方')}]: ${m.text}`).join('\n')}

决定是否推送。条件：对方消息待回复→reply_suggest; 有未完成约定→reminder; 长时间未聊有共同话题→reconnect; 否则不推送。
输出JSON：{"should_push":true/false,"push_type":"类型","content":"推送文案","priority":"low/medium/high"}`;
};

ns.buildProfileUpdatePrompt = function (profile, messages) {
  return `你是用户画像分析助手。

【当前画像】${JSON.stringify(profile, null, 2)}
【最近对话】${messages.slice(-6).map(m => `[${m.type === 'self' ? '我' : (m.sender || '对方')}]: ${m.text}`).join('\n')}

分析：说话风格、常聊话题、沟通建议、个性特征。
输出JSON：{"updates": {"communication_style": {"tone":"xxx","preferred_topics":["话题"]}, "agent_insights": {"personality_summary":"xxx","communication_tips":"xxx"}}}`;
};

// ---- Mock 数据 (模拟真人QQ聊天风格) ----
ns.getMockResponse = function (agentType, context, currentContact) {
  switch (agentType) {
    case 'smart_reply': {
      const lastOther = context.otherMsgs.slice(-1)[0] || '你好';
      return { summary: `对方想约你${lastOther.includes('周末') ? '周末出来聚聚' : '聊聊'}`, replies: [
        { style: '简洁', text: '好呀，有空，你说个时间' },
        { style: '热情', text: '终于等到你！当然有空，好久没见了，去上次那家店？' },
        { style: '幽默', text: '有饭吃我跑得比谁都快，地址发我！' },
      ]};
    }
    case 'text_optimize': {
      const text = context.selfMsgs[0] || '好的';
      return { optimized: '嗯嗯了解了，不过我感觉还可以再想想别的方案，一起看看？', note: '把直接拒绝变成了商量口吻' };
    }
    case 'summary': {
      const isGroup = currentContact === 'project_group';
      return {
        topics: isGroup ? ['周末去哪吃', '项目进度', '团建时间'] : ['周末聚聚', '近况聊聊'],
        todos: isGroup ? ['让张三定人数', '李四周五前交方案'] : ['定个具体时间'],
        decisions: isGroup ? ['周六晚6点海底捞', '团建挪到周三'] : ['大概周末见'],
        brief: isGroup ? '大家商量了周六去吃海底捞，团建改周三，李四要交方案了' : '你们在约周末见面，还没定下来具体时间地点',
      };
    }
    default: return { raw: '收到，请选择需要使用的 Agent 功能。' };
  }
};

// ---- 小Q 记忆系统 ----
ns.XiaoQMemory = {
  PERM_KEY: 'xiaoq_contact_perms',
  MEM_KEY: 'xiaoq_memory',
  BUF_PREFIX: 'xiaoq_buf_',
  REMINDER_KEY: 'xiaoq_reminder_state',

  // ── 按联系人权限 ──
  _allPerms() {
    try { return JSON.parse(localStorage.getItem(this.PERM_KEY)) || {}; }
    catch (e) { return {}; }
  },
  _savePerms(p) { try { localStorage.setItem(this.PERM_KEY, JSON.stringify(p)); } catch (e) {} },

  getPerms(contactId) {
    var p = this._allPerms();
    return p[contactId] || { observe: true, auto_summarize: true, context_length: 15, reminder_enabled: false, reminder_minutes: 30 };
  },
  setPerms(contactId, perms) {
    var p = this._allPerms();
    p[contactId] = perms;
    this._savePerms(p);
  },
  isObserving(contactId) { return this.getPerms(contactId).observe !== false; },

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

  // ── 主记忆 ──
  load() {
    try {
      var m = JSON.parse(localStorage.getItem(this.MEM_KEY));
      if (!m) return this._empty();
      if (!m.contact_memories || typeof m.contact_memories !== 'object' || Array.isArray(m.contact_memories)) {
        m.contact_memories = {};
      }
      if (!m.stats || typeof m.stats !== 'object') {
        m.stats = { total_messages: 0, total_summaries: 0 };
      }
      // 修复损坏的联系人条目
      var cms2 = m.contact_memories;
      Object.keys(cms2).forEach(function(k) {
        var entry = cms2[k];
        if (!entry || typeof entry !== "object") { cms2[k] = { summaries: [], total_messages: 0, last_msg_ts: null }; }
        else {
          if (!Array.isArray(entry.summaries)) entry.summaries = [];
          if (typeof entry.total_messages !== "number") entry.total_messages = 0;
        }
      });
      // 迁移旧版数据
      if (!m.version || m.version < 2) {
        var migrated = this._empty();
        if (m.observations) migrated.stats.total_messages = m.observations.length;
        if (m.stats && m.stats.total_pushes) migrated.stats._old_pushes = m.stats.total_pushes;
        this.save(migrated);
        return migrated;
      }
      return m;
    } catch (e) { return this._empty(); }
  },
  save(m) {
    m.last_updated = new Date().toISOString();
    try { localStorage.setItem(this.MEM_KEY, JSON.stringify(m)); } catch (e) {}
  },
  _empty() {
    return { version: 2, created_at: new Date().toISOString(), last_updated: null,
      contact_memories: {}, stats: { total_messages: 0, total_summaries: 0 } };
  },

  // ── 消息缓冲 & 自动总结 ──
  _bufKey(contactId) { return this.BUF_PREFIX + contactId; },
  _loadBuf(contactId) {
    try { return JSON.parse(localStorage.getItem(this._bufKey(contactId))) || []; }
    catch (e) { return []; }
  },
  _saveBuf(contactId, buf) {
    try { localStorage.setItem(this._bufKey(contactId), JSON.stringify(buf)); } catch (e) {}
  },

  // 记录一条消息到缓冲，返回是否触发了自动总结
  bufferMessage(contactId, msg) {
    if (!this.isObserving(contactId)) return false;
    var buf = this._loadBuf(contactId);
    buf.push({ role: msg.role, sender: msg.sender || '', text: msg.text, ts: Date.now() });
    this._saveBuf(contactId, buf);

    var m = this.load();
    if (!m.contact_memories) m.contact_memories = {};
    if (!m.contact_memories[contactId]) {
      m.contact_memories[contactId] = { summaries: [], total_messages: 0, last_msg_ts: null };
    }
    m.contact_memories[contactId].total_messages++;
    m.contact_memories[contactId].last_msg_ts = Date.now();
    m.stats.total_messages++;
    this.save(m);

    var perms = this.getPerms(contactId);
    if (perms.auto_summarize !== false && buf.length >= perms.context_length) {
      this._autoSummarize(contactId, buf, perms.context_length);
      return true;
    }
    return false;
  },

  // 自动生成内容总结
  _autoSummarize(contactId, buf, threshold) {
    var m = this.load();
    var contact = (ns.CONTACTS || []).find(function (c) { return c.id === contactId; }) || {};
    var contactName = contact.name || contactId;

    // 规则引擎总结（有 API 时可替换）
    var allText = buf.map(function (b) { return (b.role === 'self' ? '我' : b.sender || contactName) + '：' + b.text; }).join('\n');
    var topics = [];
    var kw = ['周末', '聚餐', '项目', '加班', '吃饭', '旅游', '运动', '电影', '游戏', '工作', '学习', '跳槽', '薪资', '团建', '开会', '方案', '需求'];
    kw.forEach(function (w) { if (allText.indexOf(w) !== -1) topics.push(w); });

    var selfCount = buf.filter(function (b) { return b.role === 'self'; }).length;
    var otherCount = buf.length - selfCount;
    var lastMsgs = buf.slice(-3).map(function (b) { return (b.role === 'self' ? '我' : b.sender || contactName) + '说' + (b.text.length > 20 ? b.text.slice(0, 20) + '...' : b.text); });

    var summary = '最近和' + contactName + '聊了' + buf.length + '条消息' +
      '（我说' + selfCount + '条，对方' + otherCount + '条）' +
      (topics.length ? '，涉及' + topics.slice(0, 5).join('、') : '') +
      '。末尾话题：' + lastMsgs.join('；') + '。';

    if (!m.contact_memories) m.contact_memories = {};
    if (!m.contact_memories[contactId]) {
      m.contact_memories[contactId] = { summaries: [], total_messages: buf.length, last_msg_ts: Date.now() };
    }
    m.contact_memories[contactId].summaries.push({
      content: summary,
      msg_count: buf.length,
      threshold: threshold,
      ts: Date.now()
    });
    m.stats.total_summaries++;
    this.save(m);

    // 保留最后 5 条作为上下文衔接
    var keep = buf.slice(-5);
    this._saveBuf(contactId, keep);
  },

  // 手动触发总结
  forceSummarize(contactId) {
    var buf = this._loadBuf(contactId);
    if (buf.length < 2) return null;
    var perms = this.getPerms(contactId);
    this._autoSummarize(contactId, buf, Math.max(2, perms.context_length));
    return this.getContactMemory(contactId);
  },

  // 获取某联系人的记忆
  getContactMemory(contactId) {
    var m = this.load();
    return m.contact_memories[contactId] || { summaries: [], total_messages: 0, last_msg_ts: null };
  },

  // 总览
  getSummary() {
    var m = this.load();
    var contacts = {};
    var cms = m.contact_memories || {};
    Object.keys(cms).forEach(function (cid) {
      if (cid === "_pushes") return;
      var cm = m.contact_memories[cid];
      if (!cm || typeof cm !== "object") return;
      var c = (ns.CONTACTS || []).find(function (x) { return x.id === cid; });
      contacts[cid] = {
        name: c ? c.name : cid,
        total_messages: cm.total_messages || 0,
        summaries: (cm.summaries || []).length,
        last_active: cm.last_msg_ts || null
      };
    });
    return {
      total_messages: m.stats.total_messages,
      total_summaries: m.stats.total_summaries,
      contacts: contacts,
      last_updated: m.last_updated
    };
  },

  // ── 推送记忆（保留） ──
  logPush(push, contactName) {
    var m = this.load();
    if (!m.contact_memories._pushes) m.contact_memories._pushes = [];
    m.contact_memories._pushes.push({ push_type: push.type, contact: contactName,
      content: push.content, ts: Date.now(), feedback: null });
    if (m.contact_memories._pushes.length > 200) m.contact_memories._pushes.splice(0, m.contact_memories._pushes.length - 200);
    this.save(m);
  },

  logPushFeedback(pushId, feedback) {
    var m = this.load();
    var arr = m.contact_memories._pushes || [];
    var entry = arr.reverse().find(function (p) { return (Date.now() - p.ts < 3600000 && !p.feedback); });
    if (entry) { entry.feedback = feedback; arr.reverse(); this.save(m); }
  },

  isPushEnabled() {
    var p = this._allPerms();
    return Object.keys(p).some(function (k) { return p[k].reminder_enabled === true; });
  },
};

})(window.QQAgent);
