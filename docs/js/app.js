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
    if (XM.isObserveEnabled()) XM.logObservation('chat_open', { contact: id, contact_name: contact.name });
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
  const recentPushes = mem.proactive.slice(-10).reverse();
  const recentObs = mem.observations.slice(-10).reverse();

  let pushHtml = '';
  if (recentPushes.length === 0) {
    pushHtml = '<div class="xq-empty">暂无主动提醒记录</div>';
  } else {
    pushHtml = recentPushes.map(p => {
      const fbIcon = p.feedback === 'good' ? '👍' : p.feedback === 'bad' ? '👎' : '';
      const fbColor = p.feedback === 'good' ? '#52c41a' : p.feedback === 'bad' ? '#ff4d4f' : '';
      return `<div class="xq-log-item">
        <span>${({ reply_suggest:'💬',reminder:'⏰',reconnect:'🔗',topic_suggest:'💡',general:'🤖' })[p.push_type] || '🤖'}</span>
        <span class="xq-log-text">${escapeHtml(p.content)}</span>
        ${fbIcon ? `<span style="color:${fbColor}">${fbIcon}</span>` : ''}
        <span class="xq-log-time">${formatTime(p.ts)}</span>
      </div>`;
    }).join('');
  }

  let obsHtml = '';
  if (recentObs.length === 0) {
    obsHtml = '<div class="xq-empty">暂无操作记录</div>';
  } else {
    obsHtml = recentObs.map(o => {
      const icons = { chat_open: '📂', chat_close: '📁', message_send: '💬', agent_call: '🤖' };
      const labels = { chat_open: '打开了聊天', chat_close: '关闭了聊天', message_send: '发送了消息', agent_call: '使用了Agent' };
      return `<div class="xq-log-item">
        <span>${icons[o.event] || '📌'}</span>
        <span class="xq-log-text">${labels[o.event] || o.event} — ${o.contact_name || o.contact || ''}</span>
        <span class="xq-log-time">${formatTime(o.ts)}</span>
      </div>`;
    }).join('');
  }

  container.innerHTML = `
    <div class="xq-dashboard">
      <div class="xq-welcome">
        <div class="xq-avatar" style="background:#7c5cfc;">Q</div>
        <div class="xq-intro">
          <h3>你好，我是小Q</h3>
          <p>你的QQ智能管家。我会记住你在QQ上的所有操作，在需要时主动提醒你。</p>
        </div>
      </div>
      <div class="xq-stats">
        <div class="xq-stat"><span class="xq-stat-num">${summary.total_observations}</span><span class="xq-stat-label">总操作记录</span></div>
        <div class="xq-stat"><span class="xq-stat-num">${summary.total_pushes}</span><span class="xq-stat-label">主动提醒</span></div>
        <div class="xq-stat"><span class="xq-stat-num">${summary.pushes_24h.good_feedback}</span><span class="xq-stat-label">采纳建议</span></div>
        <div class="xq-stat"><span class="xq-stat-num">${summary.most_active_contact || '—'}</span><span class="xq-stat-label">最常联系</span></div>
      </div>
      <div class="xq-section">
        <h4>📋 主动提醒记录</h4>
        ${pushHtml}
      </div>
      <div class="xq-section">
        <h4>👁 操作记忆</h4>
        ${obsHtml}
      </div>
    </div>
  `;
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
  if (isAgentContact()) return;
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
    if (XM.isObserveEnabled()) XM.logObservation('agent_call', { agent: agentType, contact: currentContact, contact_name: (C.find(c => c.id === currentContact) || {}).name });
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
  if (XM.isObserveEnabled()) XM.logObservation('message_send', { contact: currentContact, contact_name: contact.name, length: text.length });

  if (contact.type === 'friend') {
    await sleep(600 + Math.random() * 800);
    const idx = autoReplyIndex[currentContact] || 0;
    const reply = contact.autoReplies[idx % contact.autoReplies.length];
    autoReplyIndex[currentContact] = idx + 1;
    messages.push({ type: 'other', sender: contact.name, text: reply, time: Date.now(), contact: currentContact });
    renderMessages(); saveMessages();
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
  var p = XM.getPerms();
  if ($('permObserve')) $('permObserve').checked = p.observe !== false;
  if ($('permPush')) $('permPush').checked = p.push !== false;
  updateProfilePreview();
  const infoEl = $('faSettingsInfo');
  if (infoEl) infoEl.textContent = `检查间隔：${friendAgent.checkInterval / 1000}秒 | 推送队列：${friendAgent.queue.filter(p => !p.dismissed).length}条 | 今日限额：${friendAgent.maxDailyPushes}条`;
}

function closeSettings() { $('settingsModal').classList.remove('show'); }

function saveSettings() {
  localStorage.setItem('qqagent_api_url', $('apiUrl').value.trim());
  localStorage.setItem('qqagent_api_key', $('apiKey').value.trim());
  localStorage.setItem('qqagent_model', $('modelName').value.trim());
  const mockEl = $('mockNote'); if (mockEl) mockEl.style.display = $('apiUrl').value.trim() ? 'none' : 'block';
  closeSettings();
}

function updateProfilePreview() {
  if (isAgentContact()) { $('profilePreview').textContent = JSON.stringify(XM.getSummary(), null, 2); return; }
  const p = profileManager.getProfile(currentContact);
  const el = $('profilePreview'); if (el) el.textContent = JSON.stringify(p, null, 2);
}
function updateProfilePreviewIfOpen() {
  if ($('settingsModal').classList.contains('show')) updateProfilePreview();
}

function resetProfile() {
  if (isAgentContact()) { showToast('小Q记忆无法重置'); return; }
  profileManager.updateProfile(currentContact, profileManager.createDefault(currentContact));
  updateProfilePreview(); updateChatHeaderHint(); showToast('画像已重置');
}

function resetAllData() {
  if (!confirm('确定清除全部数据？包括画像、日志、对话历史、推送队列。')) return;
  const keys = ['qqagent_api_url', 'qqagent_api_key', 'qqagent_model'];
  const vals = keys.map(k => localStorage.getItem(k));
  localStorage.clear();
  keys.forEach((k, i) => { if (vals[i]) localStorage.setItem(k, vals[i]); });
  location.reload();
}

// ---- 小Q 权限 ----
function togglePerm(type) {
  const perms = XM.getPerms();
  if (type === 'observe') {
    perms.observe = !perms.observe;
    $('permObserve').checked = perms.observe;
    showToast(perms.observe ? '已开启行为监测' : '已关闭行为监测');
  } else {
    perms.push = !perms.push;
    $('permPush').checked = perms.push;
    if (!perms.push) { friendAgent.stop(); } else { friendAgent.start(); }
    showToast(perms.push ? '已开启主动推送' : '已关闭主动推送');
  }
  XM.setPerms(perms);
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
  togglePerm,
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
    const c = C.find(x => x.id === contactId);
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
