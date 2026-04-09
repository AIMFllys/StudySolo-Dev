# Visual Site Agent

> 状态：📋 规划中
> 负责人：待定
> 端口：8005
> 来源：新建

---

## 用途

可视化网站生成 Agent，根据用户描述或学习内容，自动生成可交互的网站/页面/信息图。

## 核心能力

- 从文本/思维导图生成静态网页
- 学习报告可视化
- 知识图谱可视化
- 导出为 HTML/PDF

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
