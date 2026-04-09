# Code Review Agent

> 状态：📋 待 Phase 4B 实现
> 负责人：队友 B
> 端口：8001
> 来源：新建

---

## 用途

自动化代码审查 Agent，接收代码片段或 diff，返回审查意见和改进建议。

## 技术栈

- Python 3.11+ / FastAPI / uvicorn
- 协议：OpenAI Chat Completions 兼容

## 快速开始

```bash
# 从模板创建（Phase 4B 时执行）
cp -r ../agents/_template/ .
# 然后实现 src/core/agent.py
```

## 参考

- [Agent 开发指南](../README.md)
- [接口协议规范](../../docs/team/refactor/final-plan/agent-architecture.md)
