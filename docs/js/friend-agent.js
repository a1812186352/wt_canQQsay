// ===================================================================
//  FriendAgent — 好友Agent，定时分析 + 主动推送
// ===================================================================
window.QQAgent = window.QQAgent || {};

(function (ns) {

ns.FriendAgent = class {
  constructor(profileMgr, behaviorLog, rules) {
    this.profiles = profileMgr;
    this.behavior = behaviorLog;
    this.queue = this._loadQueue();
    this.lastCheck = 0;
    this._applyRules(rules);
    this._timer = null;
    this.onStatusChange = null;    // (status)
    this.onPushEnqueued = null;    // (push, contactId)
    this.onQueueChanged = null;    // ()
  }

  _applyRules(rules) {
    const r = (rules && rules.push_rules) ? rules.push_rules : {};
    this.checkInterval = (r.check_interval_seconds || 60) * 1000;
    this.maxDailyPushes = r.max_daily_pushes || 5;
    this.maxPerContact = r.max_per_contact || 2;
    this.toastDuration = (r.toast_duration_seconds || 8) * 1000;
    this.cooldownAfterDismissHours = r.cooldown_after_dismiss_hours || 2;
    if (rules && rules.self_optimize) {
      const so = rules.self_optimize;
      this.optimizeEnabled = so.enabled !== false;
      this.badPenalty = so.bad_feedback_penalty || { reduce_daily_by: 1, reduce_per_contact_by: 1, multiply_interval_by: 2 };
      this.goodBonus = so.good_feedback_bonus || { increase_daily_by: 1 };
      this.minDaily = so.min_daily || 2;
      this.maxInterval = so.max_interval_ms || 300000;
    } else {
      this.optimizeEnabled = true;
      this.badPenalty = { reduce_daily_by: 1, reduce_per_contact_by: 1, multiply_interval_by: 2 };
      this.goodBonus = { increase_daily_by: 1 };
      this.minDaily = 2;
      this.maxInterval = 300000;
    }
  }

  start() {
    this._timer = setInterval(() => this.scheduledCheck(), this.checkInterval);
    setTimeout(() => this.scheduledCheck(), 5000);
  }

  stop() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }

  async scheduledCheck() {
    if (!ns.XiaoQMemory.isPushEnabled()) { if (this.onStatusChange) this.onStatusChange('idle'); return; }
    this.lastCheck = Date.now();
    if (this.onStatusChange) this.onStatusChange('checking');

    const todayCutoff = Date.now() - 86400000;
    const todayPushes = this.queue.filter(p => p.ts > todayCutoff && !p.dismissed).length;
    if (todayPushes >= this.maxDailyPushes) { if (this.onStatusChange) this.onStatusChange('idle'); return; }

    const contacts = ns.CONTACTS || [];
    for (const contact of contacts) {
      const contactPushes = this.queue.filter(p => p.contact === contact.id && p.ts > todayCutoff && !p.dismissed).length;
      if (contactPushes >= this.maxPerContact) continue;

      const decision = await this._analyzeContact(contact);
      if (decision.should_push && this.queue.filter(p => p.ts > todayCutoff).length < this.maxDailyPushes) {
        this._enqueue(contact.id, decision);
      }
    }
    if (this.onStatusChange) this.onStatusChange('idle');
  }

  async _analyzeContact(contact) {
    const profile = this.profiles.getProfile(contact.id);
    const stats = this.behavior.getStats(contact.id, 24);
    const messages = JSON.parse(localStorage.getItem('qqagent_msgs_' + contact.id) || '[]');

    if (contact.type === 'friend' && messages.filter(m => m.type === 'other').length === 0) {
      return { should_push: false };
    }

    const apiUrl = localStorage.getItem('qqagent_api_url');
    if (apiUrl) {
      try {
        const prompt = ns.buildFriendAnalysisPrompt(profile, stats, messages);
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('qqagent_api_key') || ''}` },
          body: JSON.stringify({ model: localStorage.getItem('qqagent_model') || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
        });
        if (res.ok) {
          const data = await res.json();
          let c = data.choices?.[0]?.message?.content || '';
          c = c.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/, '');
          return JSON.parse(c);
        }
      } catch (e) { /* fall through */ }
    }

    // Rule-based fallback
    const otherMsgs = messages.filter(m => m.type === 'other');
    const selfMsgs = messages.filter(m => m.type === 'self');
    if (otherMsgs.length > selfMsgs.length && contact.type === 'friend') {
      return {
        should_push: true, push_type: 'reply_suggest', priority: 'medium',
        content: `${contact.name} 给你发了消息，用悬浮球中的智能回复建议来快速回复`,
      };
    }
    return { should_push: false };
  }

  _enqueue(contactId, decision) {
    const push = {
      id: 'push_' + Date.now(), contact: contactId,
      type: decision.push_type || 'general', content: decision.content,
      priority: decision.priority || 'low', ts: Date.now(), dismissed: false,
    };
    this.queue.push(push);
    this._saveQueue();
    if (this.onPushEnqueued) this.onPushEnqueued(push, contactId);
    if (this.onQueueChanged) this.onQueueChanged();
  }

  getPending(contactId) {
    return this.queue.filter(p => p.contact === contactId && !p.dismissed && p.ts > Date.now() - 3600000);
  }

  dismiss(pushId) {
    const p = this.queue.find(q => q.id === pushId);
    if (p) { p.dismissed = true; this._saveQueue(); }
    if (this.onQueueChanged) this.onQueueChanged();
  }

  recordFeedback(pushId, feedback) {
    try {
      const logs = JSON.parse(localStorage.getItem('feedback_logs') || '[]');
      logs.push({ push_id: pushId, feedback, ts: Date.now() });
      if (logs.length > 200) logs.splice(0, logs.length - 200);
      localStorage.setItem('feedback_logs', JSON.stringify(logs));
    } catch (e) { /* ignore */ }
    this.dismiss(pushId);
    this._adjustStrategy(feedback);
  }

  _adjustStrategy(feedback) {
    if (feedback === 'bad') {
      this.maxDailyPushes = Math.max(this.minDaily, this.maxDailyPushes - this.badPenalty.reduce_daily_by);
      this.maxPerContact = Math.max(1, this.maxPerContact - this.badPenalty.reduce_per_contact_by);
      this.checkInterval = Math.min(this.maxInterval, this.checkInterval * this.badPenalty.multiply_interval_by);
      this.stop(); this.start();
    }
  }

  _loadQueue() { try { return JSON.parse(localStorage.getItem('push_queue') || '[]'); } catch (e) { return []; } }
  _saveQueue() { try { localStorage.setItem('push_queue', JSON.stringify(this.queue.slice(-50))); } catch (e) { /* ignore */ } }
};

})(window.QQAgent);
