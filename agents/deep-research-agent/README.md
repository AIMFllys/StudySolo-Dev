# Deep Research Agent

> 状态：已迁移并可运行  
> 端口：`8005`  
> 来源：`D:/project/Agents/ResearchAgents`

## 功能边界

- 提供 OpenAI 兼容端点：`/health`、`/health/ready`、`/v1/models`、`/v1/chat/completions`。
- 当前实现以可验证研究流程骨架为主，返回结构化研究摘要。
- 额外提供 `GET /v1/files/{file_id}` 占位接口（固定 404）。

## 本地启动

```bash
pip install -r requirements.txt
python -m src.main
```

## 环境变量

- `AGENT_API_KEY`：鉴权密钥（Bearer）。
- `AGENT_MODEL_ID`：模型 ID（默认 `research-agent`）。
- `AGENT_PORT`：监听端口（默认 `8005`）。

## 测试

```bash
pytest tests -q
```

当前契约测试：`8 passed`。

## 网关注册

主后端注册文件：`backend/config/agents.yaml`  
注册键：`deep-research`  
模型：`research-agent`
