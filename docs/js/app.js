// ===================================================================
//  app.js — QQ Agent Demo 主应用
// ===================================================================
(function () {
const ns = window.QQAgent;
const C = ns.CONTACTS;
const PM = ns.AGENT_PROMPTS;
const XM = ns.XiaoQMemory;

// ---- State ----
let currentContact = 'xiaoq';
let messages = [];
let isWaiting = false;
let floatMenuOpen = false;
let autoReplyIndex = {};
let chatOpenTime = 0;
let currentPushToastId = null;

// ---- Instances (created in init after JSON loaded) ----
let profileManager;
let behaviorLogger;
let friendAgent;
let profileUpdater;

// ---- Helpers ----
const $ = (id) => document.getElementById(id);
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function formatTime(ts) { const d = new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function showToast(t) {
  const el = $('agentToast'); if (el) { el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
}
function hideToast() { const el = $('agentToast'); if (el) el.classList.remove('show'); }
function isAgentContact() { const c = C.find(x => x.id === currentContact); return c && c.type === 'agent'; }

// ---- Contacts UI ----
function renderContacts() {
  const list = $('contactList'); if (!list) return;
  list.innerHTML = C.map(c => {
    const pending = c.type !== 'agent' ? friendAgent.getPending(c.id).length : 0;
    const lastMsg = c.type === 'agent' ? '你的QQ智能管家' :
      c.id === 'project_group' ? '张三: 周末聚餐去哪？' : (c.opening || '').slice(0, 30) + '...';
    return `
    <div class="contact-item${c.id === currentContact ? ' active' : ''}" onclick="QQAgent.switchContact('${c.id}')">
      <div class="contact-avatar" style="background:${c.avatarBg};">${c.avatar}${pending > 0 ? '<span class="notify-dot"></span>' : ''}</div>
      <div class="contact-info">
        <div class="contact-name">${c.name}${pending > 0 ? ` <span style="color:#ff4d4f;font-size:11px;">${pending}条</span>` : ''}</div>
        <div class="contact-preview">${lastMsg}</div>
      </div>
    </div>`;
  }).join('');
}

function updateChatHeaderHint() {
  if (isAgentContact()) { $('chatHeaderHint').textContent = 'QQ智能助手 · 记忆管家'; return; }
  const ps = profileManager.getProfileSummary(currentContact);
  const el = $('chatHeaderHint'); if (el) el.textContent = ps.personality ? ps.personality.slice(0, 35) : '';
}

function switchContact(id) {
  if (isWaiting) return;
  if (currentContact !== id) {
    saveMessages();
    saveDraft(currentContact);
    if (chatOpenTime && !isAgentContact()) {
      behaviorLogger.log('chat_close', { contact: currentContact, duration_seconds: Math.round((Date.now() - chatOpenTime) / 1000) });
    }
  }
  currentContact = id;
  const contact = C.find(c => c.id === id);
  $('chatTitle').textContent = contact.name;
  const av = $('chatHeaderAvatar'); av.textContent = contact.avatar; av.style.background = contact.avatarBg;
  updateChatHeaderHint();
  renderContacts();

  messages = [];
  loadMessages();
  if (!messages.length) showOpening();

  autoReplyIndex[id] = autoReplyIndex[id] || 0;
  chatOpenTime = Date.now();
  restoreDraft(id);

  // 小Q 显示记忆面板，其他联系人显示聊天
  if (contact.type === 'agent') {
    renderXiaoQDashboard();
    $('msgInput').style.display = 'none';
    $('sendBtn').style.display = 'none';
  } else {
    renderMessages();
    $('msgInput').style.display = '';
    $('sendBtn').style.display = '';
  }

  if (floatMenuOpen) toggleFloatMenu(false);
  if (contact.type !== 'agent') {
    behaviorLogger.log('chat_open', { contact: id });
    profileUpdater.tryUpdate(id);
    const pending = friendAgent.getPending(id);
    if (pending.length > 0) showPushToast(pending[0]);
  }
  updateProfilePreviewIfOpen();
}

function showOpening() {
  if (currentContact === 'xiaoq') return;
  if (currentContact === 'project_group') {
    messages.push({ type: 'other', sender: '张三', text: '周末有空吗？好久没聚了，大家出来吃个饭？🌶️', time: Date.now() - 120000, contact: currentContact });
    messages.push({ type: 'other', sender: '李四', text: '我都可以！这周项目终于交差了，正好庆祝一下', time: Date.now() - 90000, contact: currentContact });
    messages.push({ type: 'other', sender: '王五', text: '周六晚上我不行，周日可以吗？', time: Date.now() - 60000, contact: currentContact });
  } else {
    const contact = C.find(c => c.id === currentContact);
    if (contact && contact.opening) {
      messages.push({ type: 'other', sender: contact.name, text: contact.opening, time: Date.now(), contact: currentContact });
    }
  }
}

// ---- 小Q 记忆面板 ----
function renderXiaoQDashboard() {
  const container = $('messages'); if (!container) return;
  const summary = XM.getSummary();
  const mem = XM.load();
  const pushes = (mem.contact_memories._pushes || []).slice(-10).reverse();

  var contactCards = '';
  var contactEntries = Object.entries(summary.contacts);
  if (contactEntries.length === 0) {
    contactCards = '<div class="xq-empty">暂无授权联系人，请先在设置中为好友开启监测授权</div>';
  } else {
    contactCards = contactEntries.map(function (e) {
      var cid = e[0], cd = e[1];
      var cm = mem.contact_memories[cid] || {};
      var lastSummary = cm.summaries ? cm.summaries[cm.summaries.length - 1] : null;
      var contact = C.find(function (c) { return c.id === cid; });
      return '<div class="xq-contact-card" onclick="QQAgent.switchContact(\'' + cid + '\')" style="cursor:pointer;">' +
        '<div class="xq-card-header">' +
          '<div class="xq-card-avatar" style="background:' + (contact ? contact.avatarBg : '#ccc') + ';">' + (contact ? contact.avatar : '?') + '</div>' +
          '<div class="xq-card-info">' +
            '<span class="xq-card-name">' + cd.name + '</span>' +
            '<span class="xq-card-meta">' + cd.total_messages + ' 条消息 · ' + cd.summaries + ' 次总结</span>' +
          '</div>' +
        '</div>' +
        (lastSummary ? '<div class="xq-card-summary">📝 ' + escapeHtml(lastSummary.content) + '</div>' : '') +
        '<div class="xq-card-time">最近更新：' + (cd.last_active ? formatTime(cd.last_active) : '暂无') + '</div>' +
      '</div>';
    }).join('');
  }

  var pushHtml = '';
  if (pushes.length === 0) {
    pushHtml = '<div class="xq-empty">暂无推送记录</div>';
  } else {
    pushHtml = pushes.map(function (p) {
      var fbIcon = p.feedback === 'good' ? '👍' : p.feedback === 'bad' ? '👎' : '';
      return '<div class="xq-log-item">' +
        '<span>' + (({ reply_suggest: '💬', reminder: '⏰', reconnect: '🔗', topic_suggest: '💡', general: '🤖' })[p.push_type] || '🤖') + '</span>' +
        '<span class="xq-log-text">' + escapeHtml(p.content) + '</span>' +
        (fbIcon ? '<span>' + fbIcon + '</span>' : '') +
        '<span class="xq-log-time">' + formatTime(p.ts) + '</span>' +
      '</div>';
    }).join('');
  }

  container.innerHTML =
    '<div class="xq-dashboard">' +
      '<div class="xq-welcome">' +
        '<div class="xq-avatar" style="background:#7c5cfc;">Q</div>' +
        '<div class="xq-intro">' +
          '<h3>你好，我是小Q</h3>' +
          '<p>你的QQ智能管家。我会记住授权好友的所有对话，并在消息积累到阈值时自动生成内容总结。</p>' +
        '</div>' +
      '</div>' +
      '<div class="xq-stats">' +
        '<div class="xq-stat"><span class="xq-stat-num">' + summary.total_summaries + '</span><span class="xq-stat-label">内容总结</span></div>' +
        '<div class="xq-stat"><span class="xq-stat-num">' + contactEntries.length + '</span><span class="xq-stat-label">授权联系人</span></div>' +
        '<div class="xq-stat"><span class="xq-stat-num">' + pushes.length + '</span><span class="xq-stat-label">近期推送</span></div>' +
      '</div>' +
      '<div class="xq-section">' +
        '<h4>👥 联系人记忆</h4>' +
        contactCards +
      '</div>' +
      '<div class="xq-section">' +
        '<h4>📋 近期推送</h4>' +
        pushHtml +
      '</div>' +
    '</div>';
  container.scrollTop = container.scrollHeight;
}

// ---- Messages ----
function renderMessages() {
  const container = $('messages'); if (!container) return;
  if (isAgentContact()) { renderXiaoQDashboard(); return; }
  const contact = C.find(c => c.id === currentContact) || { avatarBg: '#12b7f5', avatar: '?', name: '?' };
  let html = '', lastTime = 0;

  messages.forEach((m, i) => {
    if (i === 0 || m.time - lastTime > 300000) html += `<div class="msg-time">${formatTime(m.time)}</div>`;
    lastTime = m.time;

    if (m.type === 'push') {
      html += `<div class="msg-row push"><span>${({ reply_suggest:'💬',reminder:'⏰',reconnect:'🔗',topic_suggest:'💡',general:'🤖' })[m.pushType] || '🤖'}</span><span class="push-content">${escapeHtml(m.text)}</span><span class="push-actions"><button class="msg-action-btn fb-good" onclick="QQAgent.feedbackPush('${m.pushId}','good')">👍</button><button class="msg-action-btn fb-bad" onclick="QQAgent.feedbackPush('${m.pushId}','bad')">👎</button></span></div>`;
    } else if (m.type === 'agent') {
      html += `<div class="msg-row agent"><div class="msg-avatar">AI</div><div><div class="msg-sender">QQ Agent</div><div class="msg-bubble">${escapeHtml(m.text)}</div>${m.actions || ''}</div></div>`;
    } else if (m.type === 'self') {
      html += `<div class="msg-row self"><div class="msg-avatar">我</div><div><div class="msg-bubble">${escapeHtml(m.text)}</div></div></div>`;
    } else if (m.type === 'other') {
      html += `<div class="msg-row other"><div class="msg-avatar" style="background:${contact.avatarBg};">${m.sender ? m.sender[0] : contact.avatar}</div><div>${currentContact === 'project_group' ? `<div class="msg-sender">${m.sender || contact.name}</div>` : ''}<div class="msg-bubble">${escapeHtml(m.text)}</div></div></div>`;
    } else if (m.type === 'typing') {
      html += `<div class="msg-row agent"><div class="msg-avatar">AI</div><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    }
  });
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

// ---- Push Toast ----
function showPushToast(push) {
  currentPushToastId = push.id;
  const iconEl = $('pushIcon'); if (iconEl) iconEl.textContent = push.type === 'reply_suggest' ? '💬' : push.type === 'reminder' ? '⏰' : '💡';
  const textEl = $('pushText'); if (textEl) textEl.textContent = push.content;
  $('pushToast').classList.add('show');
  clearTimeout(window._pushTimer);
  window._pushTimer = setTimeout(() => { $('pushToast').classList.remove('show'); currentPushToastId = null; }, friendAgent.toastDuration || 8000);
}

function dismissCurrentPush() {
  if (currentPushToastId) friendAgent.recordFeedback(currentPushToastId, 'dismissed');
  $('pushToast').classList.remove('show');
  currentPushToastId = null;
}

function showPushPanel() {
  const allPending = C.filter(c => c.type !== 'agent').flatMap(c => friendAgent.getPending(c.id));
  if (!allPending.length) { showToast('暂无推送通知'); return; }
  switchContact(allPending[0].contact);
  setTimeout(() => showPushToast(allPending[0]), 300);
}

function updateNotifyBadge() {
  const total = C.filter(c => c.type !== 'agent').reduce((s, c) => s + friendAgent.getPending(c.id).length, 0);
  const badge = $('notifyBadge'); if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'flex' : 'none'; }
  const ball = $('floatBall'); if (ball) { ball.classList.toggle('has-push', total > 0); ball.classList.toggle('magic', total === 0); }
}

function updateFAStatus(status) {
  const dot = $('faStatusDot'), txt = $('faStatus');
  if (!dot || !txt) return;
  dot.className = 'fa-dot';
  if (status === 'checking') { dot.classList.add('active'); txt.textContent = '小Q 分析中...'; }
  else if (status === 'has_push') { dot.classList.add('active'); txt.textContent = `小Q 有${C.filter(c => c.type !== 'agent').reduce((s, c) => s + friendAgent.getPending(c.id).length, 0)}条推送`; }
  else { dot.classList.add('idle'); txt.textContent = '小Q 待命中'; }
}

function feedbackPush(pushId, fb) {
  friendAgent.recordFeedback(pushId, fb);
  XM.logPushFeedback(pushId, fb);
  messages = messages.filter(m => m.pushId !== pushId);
  renderMessages(); saveMessages(); updateNotifyBadge();
  if (currentPushToastId === pushId) { $('pushToast').classList.remove('show'); currentPushToastId = null; }
  showToast(`反馈已记录：${fb === 'good' ? '已采纳' : '已忽略'}`);
}

// ---- Floating Ball ----
function toggleFloatMenu(show) {
  floatMenuOpen = show;
  const menu = $('floatMenu'), ball = $('floatBall');
  if (show) { menu.classList.add('open'); ball.textContent = '✕'; ball.classList.remove('magic', 'has-push'); }
  else {
    menu.classList.remove('open'); ball.textContent = 'AI';
    const t = C.filter(c => c.type !== 'agent').reduce((s, c) => s + friendAgent.getPending(c.id).length, 0);
    ball.classList.toggle('has-push', t > 0); ball.classList.toggle('magic', t === 0);
  }
}

// ---- Agent Execution ----
async function runAgent(agentType) {
  toggleFloatMenu(false);
  if (isWaiting) return;
  if (isAgentContact()) {
    if (agentType === 'summary') {
      // 小Q面板上：对所有授权联系人手动触发总结
      var cids = Object.keys(XM.getSummary().contacts);
      if (!cids.length) { showToast('暂无授权联系人'); return; }
      cids.forEach(function(cid) { XM.forceSummarize(cid); });
      renderXiaoQDashboard();
      showToast('已对所有授权联系人进行内容总结');
    } else {
      showToast('请先选择一个联系人');
    }
    return;
  }
  showToast(`正在执行：${{ smart_reply:'智能回复建议',text_optimize:'话术优化',summary:'精华提炼' }[agentType]}...`);

  let context;
  if (agentType === 'text_optimize') {
    const txt = $('msgInput').value.trim();
    if (!txt) { showToast('请先在输入框输入要优化的内容'); return; }
    context = { otherMsgs: [], selfMsgs: [txt], all: [] };
  } else {
    const nonAgent = messages.filter(m => m.type !== 'agent' && m.type !== 'push' && m.type !== 'typing');
    context = { otherMsgs: nonAgent.filter(m => m.type === 'other').map(m => m.text), selfMsgs: nonAgent.filter(m => m.type === 'self').map(m => m.text), all: nonAgent };
  }

  messages.push({ type: 'typing', time: Date.now() });
  renderMessages(); isWaiting = true;

  try {
    const resp = await callAgent(agentType, context);
    messages = messages.filter(m => m.type !== 'typing');
    const { replyText, actions } = formatAgentResponse(agentType, resp);
    messages.push({ type: 'agent', text: replyText, time: Date.now(), actions });
    renderMessages(); saveMessages(); hideToast();
    behaviorLogger.log('agent_call', { agent: agentType, contact: currentContact });
  } catch (err) {
    messages = messages.filter(m => m.type !== 'typing');
    messages.push({ type: 'agent', text: `请求失败: ${err.message}\n请检查 API 地址和 Key。`, time: Date.now() });
    renderMessages(); saveMessages(); hideToast();
  } finally { isWaiting = false; }
}

async function callAgent(agentType, context) {
  const apiUrl = localStorage.getItem('qqagent_api_url') || '';
  const apiKey = localStorage.getItem('qqagent_api_key') || '';
  if (!apiUrl) { await sleep(800 + Math.random() * 1200); return ns.getMockResponse(agentType, context, currentContact); }

  let userContent;
  if (agentType === 'text_optimize') { userContent = context.selfMsgs[0] || ''; }
  else { userContent = context.all.map(m => `[${m.type === 'self' ? '我' : (m.sender || '对方')}]: ${m.text}`).join('\n'); }

  let sysPrompt;
  if (agentType === 'smart_reply') { sysPrompt = ns.buildSmartReplyPrompt(profileManager.getProfileSummary(currentContact)); }
  else { sysPrompt = PM[agentType] || ''; }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ model: localStorage.getItem('qqagent_model') || 'deepseek-chat', messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userContent }], temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  let c = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.content || data.reply || data.message || JSON.stringify(data);
  c = c.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/, '');
  try { return JSON.parse(c); } catch (e) { return { raw: c }; }
}

function formatAgentResponse(agentType, data) {
  if (data.raw) return { replyText: data.raw, actions: null };
  switch (agentType) {
    case 'smart_reply': {
      const text = data.summary ? `对方应该是想说：${data.summary}\n\n你可以这样回：` : '回复建议：';
      const actions = `<div class="msg-actions">${(data.replies || []).map(r => `<button class="msg-action-btn" onclick="QQAgent.useReply('${escapeHtml(r.text)}')">${r.text.slice(0, 18)}${r.text.length > 18 ? '…' : ''}</button>`).join('')}</div>`;
      return { replyText: text, actions };
    }
    case 'text_optimize': {
      const actions = data.optimized ? `<div class="msg-actions"><button class="msg-action-btn" onclick="QQAgent.useReply('${escapeHtml(data.optimized)}')">📝 用这个</button></div>` : '';
      const note = data.note ? `（${data.note}）` : '';
      return { replyText: `改成这样会不会更好：\n${data.optimized || ''}\n${note}`, actions };
    }
    case 'summary': {
      const topics = (data.topics || []).join('、');
      const todos = (data.todos || []).join('；');
      const decisions = (data.decisions || []).join('；');
      let text = `聊了这些：${topics || '闲聊'}`;
      if (todos) text += `\n要做的：${todos}`;
      if (decisions) text += `\n定下来的：${decisions}`;
      if (data.brief) text = data.brief + '\n\n' + text;
      return { replyText: text, actions: null };
    }
    default: return { replyText: JSON.stringify(data, null, 2), actions: null };
  }
}

function useReply(t) { $('msgInput').value = t; $('msgInput').focus(); }

// ---- QQ 草稿保留 ----
function saveDraft(contactId) {
  const text = $('msgInput').value;
  if (text.trim()) localStorage.setItem('draft_' + contactId, text);
  else localStorage.removeItem('draft_' + contactId);
}
function restoreDraft(contactId) {
  const draft = localStorage.getItem('draft_' + contactId) || '';
  $('msgInput').value = draft;
}

// ---- Send Message ----
async function sendMessage() {
  if (isWaiting || isAgentContact()) return;
  const text = $('msgInput').value.trim(); if (!text) return;
  const contact = C.find(c => c.id === currentContact);

  messages.push({ type: 'self', text, time: Date.now(), contact: currentContact });
  $('msgInput').value = '';
  localStorage.removeItem('draft_' + currentContact);
  renderMessages(); saveMessages();
  behaviorLogger.log('message_send', { contact: currentContact, length: text.length });
  XM.bufferMessage(currentContact, { role: 'self', text: text });

  if (contact.type === 'friend') {
    await sleep(600 + Math.random() * 800);
    const idx = autoReplyIndex[currentContact] || 0;
    const reply = contact.autoReplies[idx % contact.autoReplies.length];
    autoReplyIndex[currentContact] = idx + 1;
    messages.push({ type: 'other', sender: contact.name, text: reply, time: Date.now(), contact: currentContact });
    renderMessages(); saveMessages();
    XM.bufferMessage(currentContact, { role: 'other', sender: contact.name, text: reply });
    profileManager.updateProfile(currentContact, {
      interaction_history: { total_messages: (profileManager.getProfile(currentContact).interaction_history.total_messages || 0) + 2, last_active_date: new Date().toISOString().slice(0, 10) },
    });
  }
}

function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }

// ---- Settings ----
function openSettings() {
  const hasApi = localStorage.getItem('qqagent_api_url');
  const mockEl = $('mockNote'); if (mockEl) mockEl.style.display = hasApi ? 'none' : 'block';
  $('settingsModal').classList.add('show');
  $('apiUrl').value = localStorage.getItem('qqagent_api_url') || '';
  $('apiKey').value = localStorage.getItem('qqagent_api_key') || '';
  $('modelName').value = localStorage.getItem('qqagent_model') || '';
  renderProfileNatural();
  renderPermSection();
  updateFAInfo();
}

function closeSettings() { $('settingsModal').classList.remove('show'); }

function saveSettings() {
  localStorage.setItem('qqagent_api_url', $('apiUrl').value.trim());
  localStorage.setItem('qqagent_api_key', $('apiKey').value.trim());
  localStorage.setItem('qqagent_model', $('modelName').value.trim());
  const mockEl = $('mockNote'); if (mockEl) mockEl.style.display = $('apiUrl').value.trim() ? 'none' : 'block';
  // 保存上下文长度
  if (!isAgentContact()) {
    var el = $('xqContextLen');
    if (el) {
      var p = XM.getPerms(currentContact);
      p.context_length = parseInt(el.value) || 15;
      XM.setPerms(currentContact, p);
    }
  }
  closeSettings();
}

function renderProfileNatural() {
  var el = $('profileNatural'); if (!el) return;
  var titleEl = $('settingsProfileTitle');
  if (isAgentContact()) {
    if (titleEl) titleEl.innerHTML = '小Q 总览';
    var s = XM.getSummary();
    var contactList = Object.values(s.contacts).map(function(c){return c.name + '(' + c.total_messages + '条消息·' + c.summaries + '次总结)';}).join('、') || '暂无';
    el.innerHTML = '<p style="font-size:13px;color:#333;line-height:1.7;">小Q已记录 <b>' + s.total_messages + '</b> 条消息，生成 <b>' + s.total_summaries + '</b> 次内容总结。</p>' +
      '<p style="font-size:12px;color:#888;margin-top:4px;">覆盖联系人：' + contactList + '</p>';
    return;
  }
  if (titleEl) titleEl.innerHTML = '联系人画像 <button class="btn btn-default" style="font-size:11px;padding:2px 8px;margin-left:8px;" onclick="QQAgent.resetProfile()">重置画像</button>';
  var ps = profileManager.getProfileSummary(currentContact);
  var contact = C.find(function(c) { return c.id === currentContact; });
  var rel = { close_friend: '密友', friend: '朋友', group: '群聊', assistant: '助手' };
  var parts = [
    (contact ? contact.name : currentContact) + '是你的' + (rel[ps.relationship] || ps.relationship || '联系人'),
    ps.personality ? '。' + ps.personality : '',
    ps.topics && ps.topics !== '日常' ? '。常聊话题包括' + ps.topics : '',
    ps.tips ? '。沟通建议：' + ps.tips : ''
  ];
  el.innerHTML = '<p style="font-size:13px;color:#333;line-height:1.7;">' + parts.join('') + '</p>';
}

function renderPermSection() {
  var el = $('permSection'); if (!el) return;
  if (isAgentContact()) { el.innerHTML = '<div class="hint">小Q 自身不需要授权</div>'; return; }
  var perms = XM.getPerms(currentContact);
  el.innerHTML =
    '<div class="perm-row">' +
      '<div class="perm-info">' +
        '<span class="perm-label">记录聊天消息</span>' +
        '<span class="perm-desc">开启后小Q会记住你与' + ((C.find(function(c){return c.id===currentContact;})||{}).name||'该联系人') + '的所有对话</span>' +
      '</div>' +
      '<label class="toggle">' +
        '<input type="checkbox" id="permObserve" ' + (perms.observe !== false ? 'checked' : '') + ' onchange="QQAgent.toggleContactPerm(\'observe\')">' +
        '<span class="toggle-slider"></span>' +
      '</label>' +
    '</div>' +
    '<div class="perm-row">' +
      '<div class="perm-info">' +
        '<span class="perm-label">自动内容总结</span>' +
        '<span class="perm-desc">消息达到阈值后自动生成对话总结</span>' +
      '</div>' +
      '<label class="toggle">' +
        '<input type="checkbox" id="permSummarize" ' + (perms.auto_summarize !== false ? 'checked' : '') + ' onchange="QQAgent.toggleContactPerm(\'auto_summarize\')">' +
        '<span class="toggle-slider"></span>' +
      '</label>' +
    '</div>' +
    '<div class="perm-row" style="border:none;">' +
      '<div class="perm-info">' +
        '<span class="perm-label">上下文长度</span>' +
        '<span class="perm-desc">累计多少条消息后触发自动总结</span>' +
      '</div>' +
      '<input type="number" id="xqContextLen" value="' + (perms.context_length || 15) + '" min="5" max="100" style="width:60px;text-align:center;border:1px solid #ddd;border-radius:6px;padding:4px 8px;font-size:14px;">' +
    '</div>';
}

function toggleContactPerm(type) {
  var perms = XM.getPerms(currentContact);
  if (type === 'observe') {
    perms.observe = !perms.observe;
    if ($('permObserve')) $('permObserve').checked = perms.observe;
    if (!perms.observe) perms.auto_summarize = false;
    showToast(perms.observe ? '已授权小Q记录' + ((C.find(function(c){return c.id===currentContact;})||{}).name||'') + '的消息' : '已停止记录');
  } else if (type === 'auto_summarize') {
    perms.auto_summarize = !perms.auto_summarize;
    if (perms.auto_summarize) perms.observe = true;
    if ($('permSummarize')) $('permSummarize').checked = perms.auto_summarize;
    if ($('permObserve')) $('permObserve').checked = perms.observe;
    showToast(perms.auto_summarize ? '已开启自动内容总结' : '已关闭自动内容总结');
  }
  XM.setPerms(currentContact, perms);
  renderPermSection();
}

function updateFAInfo() {
  var el = $('faSettingsInfo'); if (!el) return;
  if (isAgentContact()) {
    var s = XM.getSummary();
    el.textContent = '已记录 ' + s.total_messages + ' 条消息 · 生成 ' + s.total_summaries + ' 次总结';
    return;
  }
  var mem = XM.getContactMemory(currentContact);
  var buf = (function() {
    try { return JSON.parse(localStorage.getItem('xiaoq_buf_' + currentContact) || '[]'); }
    catch(e) { return []; }
  })();
  el.textContent = '已记录 ' + mem.total_messages + ' 条消息 · 缓冲 ' + buf.length + ' 条 · 总结 ' + mem.summaries.length + ' 次';
}

function updateProfilePreviewIfOpen() {
  if ($('settingsModal').classList.contains('show')) {
    renderProfileNatural();
    renderPermSection();
    updateFAInfo();
  }
}

function resetProfile() {
  if (isAgentContact()) { showToast('小Q记忆无法重置'); return; }
  profileManager.updateProfile(currentContact, profileManager.createDefault(currentContact));
  renderProfileNatural(); updateChatHeaderHint(); showToast('画像已重置');
}

function resetAllData() {
  if (!confirm('确定清除全部数据？包括画像、日志、对话历史、推送队列。')) return;
  var keys = ['qqagent_api_url', 'qqagent_api_key', 'qqagent_model'];
  var vals = keys.map(function(k) { return localStorage.getItem(k); });
  localStorage.clear();
  keys.forEach(function(k, i) { if (vals[i]) localStorage.setItem(k, vals[i]); });
  location.reload();
}

// ---- Persistence ----
function saveMessages() {
  if (isAgentContact()) return;
  try { localStorage.setItem('qqagent_msgs_' + currentContact, JSON.stringify(messages.filter(m => m.type !== 'typing' && m.type !== 'push').slice(-80))); } catch (e) {}
}
function loadMessages() {
  if (isAgentContact()) return;
  try { const r = localStorage.getItem('qqagent_msgs_' + currentContact); if (r) messages = JSON.parse(r); } catch (e) {}
}
function clearChat() {
  if (isAgentContact()) return;
  messages = []; autoReplyIndex[currentContact] = 0; showOpening(); renderMessages(); saveMessages();
}

// ---- Export to global ----
Object.assign(ns, {
  switchContact, sendMessage, runAgent, handleKey, useReply,
  dismissCurrentPush, showPushPanel, feedbackPush,
  openSettings, closeSettings, saveSettings, resetProfile, resetAllData, clearChat,
  toggleContactPerm,
});
window.switchContact = switchContact;
window.sendMessage = sendMessage;
window.runAgent = runAgent;
window.handleKey = handleKey;
window.useReply = useReply;
window.dismissCurrentPush = dismissCurrentPush;
window.showPushPanel = showPushPanel;
window.feedbackPush = feedbackPush;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.resetProfile = resetProfile;
window.resetAllData = resetAllData;
window.clearChat = clearChat;

// ---- Init ----
async function init() {
  const [defaultProfiles, agentRules] = await Promise.all([
    ns.loadDefaultProfiles(),
    ns.loadAgentRules()
  ]);

  profileManager = new ns.ProfileManager(defaultProfiles);
  behaviorLogger = new ns.BehaviorLogger();
  friendAgent = new ns.FriendAgent(profileManager, behaviorLogger, agentRules);
  profileUpdater = new ns.ProfileUpdater(profileManager);

  // Wire callbacks — MUST be after instance creation
  friendAgent.onStatusChange = (status) => updateFAStatus(status);
  friendAgent.onPushEnqueued = (push, contactId) => {
    if (!XM.isPushEnabled()) return;
    if (contactId === currentContact) showPushToast(push);
    updateNotifyBadge(); renderContacts();
    var c = C.find(function(x) { return x.id === contactId; });
    XM.logPush(push, c ? c.name : contactId);
  };
  friendAgent.onQueueChanged = () => { updateNotifyBadge(); renderContacts(); };

  C.forEach(c => profileManager.getProfile(c.id));
  renderContacts(); loadMessages();
  if (!messages.length) showOpening();

  // 默认显示小Q面板，隐藏输入框
  if (isAgentContact()) {
    renderXiaoQDashboard();
    $('msgInput').style.display = 'none';
    $('sendBtn').style.display = 'none';
  } else { renderMessages(); }

  updateNotifyBadge();
  friendAgent.start(); updateFAStatus('idle');

  $('msgInput').addEventListener('input', function () {
    const text = this.value;
    if (text.trim()) localStorage.setItem('draft_' + currentContact, text);
    else localStorage.removeItem('draft_' + currentContact);
  });

  document.addEventListener('click', function (e) {
    if (floatMenuOpen && !e.target.closest('.float-ball-wrap')) toggleFloatMenu(false);
  });
  $('floatBall').addEventListener('click', function (e) { e.stopPropagation(); toggleFloatMenu(!floatMenuOpen); });
  $('settingsModal').addEventListener('click', function (e) { if (e.target === this) closeSettings(); });

  const ha = $('chatHeaderAvatar');
  if (ha) ha.addEventListener('mouseenter', () => {
    if (isAgentContact()) { $('profileTip').textContent = '小Q · 你的QQ智能管家 | 记住一切，适时提醒'; return; }
    const ps = profileManager.getProfileSummary(currentContact);
    const tip = $('profileTip'); if (tip) tip.textContent = `风格：${ps.tone} | 话题：${ps.topics || '待发现'} | ${ps.personality}`;
  });
}

init().catch(function (e) { console.error('QQ Agent init failed:', e); });
})();
