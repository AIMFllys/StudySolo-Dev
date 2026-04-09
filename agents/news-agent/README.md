# News Agent

> 状态：⚠️ 待迁移
> 负责人：主系统
> 端口：8003
> 来源：迁移自 `D:\project\Agents\newsAgents\NewsAgents`

---

## 用途

新闻抓取与分析 Agent，多源聚合（Reddit、X/Twitter、YouTube、HackerNews、小红书、Brave Search 等），返回结构化新闻报告。

## 技术栈

- Python 3.11+ / FastAPI / uvicorn
- 协议：OpenAI Chat Completions 兼容 + OpenAI Responses API

## 迁移计划

详见 [MIGRATION.md](MIGRATION.md)

## 参考

- [Agent 开发指南](../README.md)
- [接口协议规范](../../docs/team/refactor/final-plan/agent-architecture.md)
