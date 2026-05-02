// ===================================================================
//  ProfileUpdater — 画像自动更新
// ===================================================================
window.QQAgent = window.QQAgent || {};

(function (ns) {

ns.ProfileUpdater = class {
  constructor(profileMgr) {
    this.profiles = profileMgr;
    this.cooldownMs = 3600000; // 1 hour
  }

  async tryUpdate(contactId) {
    const profile = this.profiles.getProfile(contactId);
    const lastUpdate = profile.last_updated ? new Date(profile.last_updated).getTime() : 0;
    if (Date.now() - lastUpdate < this.cooldownMs) return;

    const messages = JSON.parse(localStorage.getItem('qqagent_msgs_' + contactId) || '[]');
    if (messages.length < 2) return;

    const apiUrl = localStorage.getItem('qqagent_api_url');
    if (!apiUrl) { this._localUpdate(contactId, profile, messages); return; }

    try {
      const prompt = ns.buildProfileUpdatePrompt(profile, messages);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('qqagent_api_key') || ''}` },
        body: JSON.stringify({ model: localStorage.getItem('qqagent_model') || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
      });
      if (res.ok) {
        const data = await res.json();
        let c = data.choices?.[0]?.message?.content || '';
        c = c.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/, '');
        const result = JSON.parse(c);
        if (result.updates) { this.profiles.updateProfile(contactId, result.updates); }
      }
    } catch (e) { /* ignore */ }
  }

  _localUpdate(contactId, profile, messages) {
    const topics = new Set();
    const words = messages.map(m => m.text).join(' ');
    ['美食', '游戏', '工作', '学习', '旅行', '音乐', '电影', '运动', '周末', '聚餐', '项目', '加班', '跳槽', '压力', '心情'].forEach(t => {
      if (words.includes(t)) topics.add(t);
    });

    this.profiles.updateProfile(contactId, {
      interaction_history: { total_messages: messages.length, last_active_date: new Date().toISOString().slice(0, 10), recent_topics: [...topics].slice(0, 5) },
      communication_style: { preferred_topics: [...new Set([...(profile.communication_style.preferred_topics || []), ...topics])].slice(0, 8) },
      agent_insights: { personality_summary: `活跃话题：${[...topics].slice(0, 3).join('、') || '待发现'}` },
    });
  }
};

})(window.QQAgent);
