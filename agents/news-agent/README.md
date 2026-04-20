# News Agent

> 状态：已迁移并可运行  
> 端口：`8004`  
> 来源：`D:/project/Agents/newsAgents/NewsAgents`

## 功能边界

- 提供 OpenAI 兼容端点：`/health`、`/health/ready`、`/v1/models`、`/v1/chat/completions`。
- 保留 `Responses API`：`POST /v1/responses`、`GET/DELETE /v1/responses/{id}`。
- 保留 `lib` 多源研究能力模块，并接入 SSE 与后台任务管理链路。

## 本地启动

```bash
pip install -r requirements.txt
python -m src.main
```

## 环境变量

- `AGENT_API_KEY`：鉴权密钥（Bearer），兼容 `NEWSAGENTS_API_KEY`。
- `AGENT_MODEL_ID`：主模型前缀（默认 `last30days`）。
- `AGENT_PORT`：监听端口（默认 `8004`）。

## 测试

```bash
pytest tests -q
```

当前契约测试：`9 passed`。

## 网关注册

主后端注册文件：`backend/config/agents.yaml`  
注册键：`news`  
模型：`last30days-quick`、`last30days`、`last30days-deep`
