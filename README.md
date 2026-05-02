# QQ Agent — 多智能体聊天助手 Demo

基于 QQ 聊天场景的多 Agent 演示项目。在模拟 QQ 界面上实现**画像记忆、行为感知、主动推送**三大能力，支持接入 DeepSeek 等 LLM API 驱动智能回复。

## 功能概览

| 功能 | 说明 |
|------|------|
| 小Q 智能管家 | 常驻好友栏，记住你在QQ上的所有操作和主动提醒，汇总为记忆面板 |
| 聊天 Agent | 智能回复建议、话术优化、聊天精华提炼（悬浮球一键触发） |
| 好友 Agent | 后台定时分析行为 → 主动推送提醒（待回复消息、话题建议等） |
| 画像系统 | 自动学习联系人偏好、沟通风格、常聊话题，注入回复 prompt |
| 行为日志 | 记录聊天打开/消息/AI调用事件，驱动画像更新和推送决策 |
| 自优化 | 推送反馈 👍/👎 → 自动调整推送频率和策略 |
| QQ 草稿保留 | 切换联系人时输入框内容自动保留 |

## 快速开始

```bash
# 1. 进入 demo 目录
cd demo

# 2. 启动本地服务（任选一种）
python -m http.server 8080
# 或者：npx serve . -p 8080
```

```bash
# 3. 浏览器打开
# 地址：http://localhost:8080
```

> **注意：必须在 demo 目录下启动服务器，否则 CSS 和 JS 会 404。**  
> 无需构建、无需后端，纯静态 HTML/CSS/JS。未接入 API 时使用内置 Mock 数据即可体验全部功能。

### 启动遇到 localhost 拒绝连接？

按以下顺序排查：

1. **确认已进入 demo 目录** — 必须在 `demo/` 下启动，不是在项目根目录
2. **Python 命令不对** — Windows 上 `python` 可能跳转 Microsoft Store，试试 `python3` 或 `py -3`
3. **端口被占用** — 换一个端口：`python -m http.server 9090`
4. **没有 Python** — 安装 [Python](https://www.python.org/downloads/) 或装 [Node.js](https://nodejs.org) 后执行 `npx serve . -p 8080`
5. **杀毒软件/防火墙拦截** — 临时关闭防火墙试试

## 部署到 GitHub Pages

1. 打开 `https://github.com/a1812186352/wt_canQQsay/settings/pages`
2. **Source**: 选 `Deploy from a branch`
3. **Branch**: 选 `main`，文件夹选 `/demo`
4. 点 **Save**，等 1-2 分钟
5. 访问 `https://a1812186352.github.io/wt_canQQsay/`

## 配置说明

所有可修改的配置都以 JSON 文件形式存放在 `demo/` 下，**运行时直接加载，修改后刷新浏览器即可生效**：

| 配置项 | 文件 | 说明 |
|--------|------|------|
| 联系人画像 | `profiles/*.json` | 沟通风格、偏好话题、个性总结，运行时 `fetch` 加载 |
| 推送规则 | `config/agent-rules.json` | 推送频率、自优化参数、推送类型模板 |
| 联系人列表 & Prompt | `js/config.js` | 新增联系人需同时在这里加 CONTACTS 条目和对应 JSON 画像 |

> 如果 JSON 文件加载失败（如双击打开 HTML），自动 fallback 到 `config.js` 中的硬编码数据，页面仍可正常运行。

## 接入 LLM API

点击左侧齿轮 ⚙ → 填入 API 地址即可。未配置时使用内置 Mock 数据。

| 平台 | API 地址 | 模型名 |
|------|----------|--------|
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-plus` |
| Ollama 本地 | `http://localhost:11434/v1/chat/completions` | `qwen2.5:7b` |
| 其他 OpenAI 兼容 | 你自己的地址 | 对应模型名 |

## 项目结构

```
demo/
├── index.html               # 页面壳
├── styles.css               # 样式
├── js/
│   ├── config.js             # 联系人、提示词、Mock数据、画像模板（修改配置看这里）
│   ├── app.js                # 主应用逻辑
│   ├── profile-manager.js    # 画像存储与读写
│   ├── behavior-logger.js    # 行为事件日志
│   ├── friend-agent.js       # 好友Agent（定时分析+主动推送）
│   └── profile-updater.js    # 画像自动更新
├── profiles/                 # 联系人画像（运行时 fetch 加载，修改即生效）
│   ├── xiaoq.json            # 小Q 智能管家
│   ├── xiaoming.json
│   ├── xiaohong.json
│   └── project_group.json
└── config/
    └── agent-rules.json      # 推送规则配置
```

## 修改配置

- **改联系人/提示词/默认画像** → 编辑 `js/config.js`
- **改推送频率/规则** → 编辑 `config/agent-rules.json`
- **改画像模板** → 编辑 `profiles/*.json`（运行时从 `config.js` 的 `DEFAULT_PROFILES` 初始化）
- **改样式** → 编辑 `styles.css`

## 核心设计

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  聊天 Agent  │     │   好友 Agent      │     │  LLM API    │
│  悬浮球触发   │────▶│   60s 定时分析    │────▶│  DeepSeek   │
│  回复/优化/  │     │   推送决策/反馈  │     │  等兼容接口  │
│  精华提炼    │     └──────────────────┘     └─────────────┘
└─────────────┘            │                        ▲
       │                   ▼                        │
       │          ┌──────────────────┐              │
       └─────────▶│   localStorage   │◀─────────────┘
                  │  画像/日志/历史   │
                  └──────────────────┘
```

全部数据本地存储，不上传服务器。仅 LLM 调用走外部 API。

## License

MIT
