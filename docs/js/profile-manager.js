// ===================================================================
//  ProfileManager — 画像存储与读写
//  运行时持久化到 localStorage，初始化从 config 读取默认模板
// ===================================================================
window.QQAgent = window.QQAgent || {};

(function (ns) {

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

ns.ProfileManager = class {
  constructor(defaultProfiles) {
    this.defaultProfiles = defaultProfiles || ns.DEFAULT_PROFILES;
  }

  getProfile(contactId) {
    try {
      const raw = localStorage.getItem('profile_' + contactId);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return this.createDefault(contactId);
  }

  updateProfile(contactId, updates) {
    const profile = this.getProfile(contactId);
    const merged = deepMerge(profile, updates);
    merged.last_updated = new Date().toISOString();
    localStorage.setItem('profile_' + contactId, JSON.stringify(merged));
    return merged;
  }

  createDefault(contactId) {
    const template = this.defaultProfiles[contactId];
    if (template) return { ...template, last_updated: new Date().toISOString() };

    const contact = (ns.CONTACTS || []).find(c => c.id === contactId) || {};
    return {
      contact_id: contactId, contact_name: contact.name || contactId, contact_type: contact.type || 'friend',
      created_at: new Date().toISOString().slice(0, 10), last_updated: new Date().toISOString(),
      basic_info: { avatar_color: contact.avatarBg || '#12b7f5', relationship: 'friend', tags: [] },
      communication_style: { tone: 'casual', emoji_usage: 'medium', preferred_topics: [], avoided_topics: [] },
      interaction_history: { total_messages: 0, last_active_date: null, frequent_times: [], recent_topics: [] },
      preferences: { notification_priority: 'normal', auto_reply_style: 'friendly' },
      agent_insights: { personality_summary: 'QQ好友，等待进一步了解', communication_tips: '保持友好自然的语气', last_recommendation: null },
    };
  }

  getProfileSummary(contactId) {
    const p = this.getProfile(contactId);
    return {
      relationship: p.basic_info.relationship || '朋友',
      tone: p.communication_style.tone || '随意',
      topics: (p.communication_style.preferred_topics || []).join('、') || '日常',
      tips: p.agent_insights.communication_tips || '',
      personality: p.agent_insights.personality_summary || '',
    };
  }
};

})(window.QQAgent);
