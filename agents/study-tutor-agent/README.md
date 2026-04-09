# Study Tutor Agent

> 状态：📋 规划中
> 负责人：待定
> 端口：8004
> 来源：新建

---

## 用途

学习专家辅导 Agent，根据用户的学习内容和进度，提供个性化学习建议、知识点解析、学习计划制定。

## 核心能力

- 知识点深度解析（结合 StudySolo 工作流结果）
- 学习路径推荐
- 薄弱环节诊断
- 互动式 Q&A 辅导

## 技术栈

- Python 3.11+ / FastAPI / uvicorn
- 协议：OpenAI Chat Completions 兼容

## 快速开始

```bash
# 从模板创建（待启动时执行）
cp -r ../agents/_template/ .
# 然后实现 src/core/agent.py
```

## 参考

- [Agent 开发指南](../README.md)
- [接口协议规范](../../docs/team/refactor/final-plan/agent-architecture.md)
