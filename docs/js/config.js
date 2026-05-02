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
  STORAGE_KEY: 'xiaoq_memory',

  load() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || this._empty(); }
    catch (e) { return this._empty(); }
  },

  save(memory) {
    memory.last_updated = new Date().toISOString();
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memory)); } catch (e) {}
  },

  _empty() {
    return { version: 1, created_at: new Date().toISOString(), last_updated: null,
      proactive: [], observations: [], stats: { total_pushes: 0, total_observations: 0 } };
  },

  logPush(push, contactName) {
    const m = this.load();
    m.proactive.push({ type: 'push', push_type: push.type, contact: contactName,
      content: push.content, priority: push.priority, ts: Date.now(), feedback: null });
    m.stats.total_pushes++;
    if (m.proactive.length > 200) m.proactive.splice(0, m.proactive.length - 200);
    this.save(m);
  },

  logPushFeedback(pushId, feedback) {
    const m = this.load();
    const entry = m.proactive.reverse().find(p => p.push_id === pushId || (Date.now() - p.ts < 3600000 && !p.feedback));
    if (entry) { entry.feedback = feedback; m.proactive.reverse(); this.save(m); }
  },

  logObservation(event, data) {
    const m = this.load();
    m.observations.push({ event, ...data, ts: Date.now() });
    m.stats.total_observations++;
    if (m.observations.length > 500) m.observations.splice(0, m.observations.length - 500);
    this.save(m);
  },

  getSummary() {
    const m = this.load();
    const recentObs = m.observations.slice(-50);
    const chatOpens = recentObs.filter(o => o.event === 'chat_open').length;
    const msgs = recentObs.filter(o => o.event === 'message_send').length;
    const agentCalls = recentObs.filter(o => o.event === 'agent_call').length;
    const recentPushes = m.proactive.filter(p => Date.now() - p.ts < 86400000);
    const goodFb = recentPushes.filter(p => p.feedback === 'good').length;
    const badFb = recentPushes.filter(p => p.feedback === 'bad').length;

    const contactActivity = {};
    recentObs.forEach(o => { const c = o.contact || '未知'; contactActivity[c] = (contactActivity[c] || 0) + 1; });
    const mostActive = Object.entries(contactActivity).sort((a, b) => b[1] - a[1])[0];

    return {
      total_observations: m.stats.total_observations,
      total_pushes: m.stats.total_pushes,
      recent_24h: { chat_opens: chatOpens, messages: msgs, agent_calls: agentCalls },
      pushes_24h: { total: recentPushes.length, good_feedback: goodFb, bad_feedback: badFb },
      most_active_contact: mostActive ? mostActive[0] : null,
      last_updated: m.last_updated,
    };
  },
};

})(window.QQAgent);
