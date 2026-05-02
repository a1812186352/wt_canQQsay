// ===================================================================
//  BehaviorLogger — 行为日志
//  事件埋点 + 时间范围查询 + 统计
// ===================================================================
window.QQAgent = window.QQAgent || {};

(function (ns) {

ns.BehaviorLogger = class {
  log(event, data = {}) {
    const record = { ts: Date.now(), event, ...data };
    try {
      const logs = this._load();
      logs.push(record);
      if (logs.length > 500) logs.splice(0, logs.length - 500);
      localStorage.setItem('behavior_logs', JSON.stringify(logs));
    } catch (e) { /* ignore */ }
    return record;
  }

  getRecent(hours = 24) {
    const cutoff = Date.now() - hours * 3600000;
    return this._load().filter(r => r.ts > cutoff);
  }

  getStats(contactId, hours = 24) {
    const logs = this.getRecent(hours).filter(r => r.contact === contactId);
    return {
      message_count: logs.filter(r => r.event === 'message_send').length,
      agent_calls: logs.filter(r => r.event === 'agent_call').length,
      chat_opens: logs.filter(r => r.event === 'chat_open').length,
      chat_duration: logs.filter(r => r.event === 'chat_close').reduce((s, r) => s + (r.duration_seconds || 0), 0),
    };
  }

  _load() {
    try { return JSON.parse(localStorage.getItem('behavior_logs') || '[]'); } catch (e) { return []; }
  }
};

})(window.QQAgent);
