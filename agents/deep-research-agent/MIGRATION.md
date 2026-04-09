# Deep Research Agent 迁移计划

> 源项目：`D:\project\Agents\ResearchAgents`
> 目标位置：`StudySolo/agents/deep-research-agent/`
> 预计耗时：~2 小时
> 前置依赖：Phase 4B（`_template` 模板就绪）

---

## 源项目兼容性分析

| 维度 | 兼容性 | 说明 |
|------|--------|------|
| 框架 | ✅ FastAPI | 完全匹配 |
| 目录结构 | ✅ `app/api/routes/` + `schemas/` + `middleware/` | 几乎 1:1 对应 `_template` 五层结构 |
| 三端点 | ⚠️ 缺 `GET /health` | 需补充 `agent` + `version` 字段 |
| Schema | ✅ Pydantic V2 OpenAI 兼容 | `ChatCompletionRequest/Response/Chunk` 直接可用 |
| SSE 格式 | ✅ `data: {json}\n\n` + `data: [DONE]\n\n` | 完全合规 |
| Auth | ✅ API Key 中间件 `verify_api_key` | 匹配 |
| Config | ✅ pydantic-settings | 匹配 |
| **功能完成度** | ⚠️ **10%** | Chat 端点是 mock，核心研究管线未实现 |

---

## 源项目目录结构

```
ResearchAgents/
├── app/
│   ├── __init__.py
│   ├── main.py                     ← FastAPI 入口
│   ├── config.py                   ← pydantic-settings
│   ├── api/
│   │   ├── routes/
│   │   │   ├── chat.py             ← POST /v1/chat/completions (mock)
│   │   │   ├── models.py           ← GET /v1/models
│   │   │   └── files.py            ← 文件上传（可选保留）
│   │   ├── schemas/
│   │   │   └── openai_compat.py    ← Pydantic V2 请求/响应模型
│   │   └── middleware/
│   │       └── auth.py             ← API Key 验证
│   └── utils/
│       └── logger.py               ← 结构化日志
├── tests/
├── .env.example
├── pyproject.toml
├── Dockerfile                      ← 无（需新建）
└── README.md
```

---

## 迁移步骤

### Step 1：复制并重命名（5 分钟）

```bash
# 复制源项目
cp -r D:\project\Agents\ResearchAgents\app agents\deep-research-agent\src
cp -r D:\project\Agents\ResearchAgents\tests agents\deep-research-agent\tests
cp D:\project\Agents\ResearchAgents\.env.example agents\deep-research-agent\.env.example
cp D:\project\Agents\ResearchAgents\pyproject.toml agents\deep-research-agent\pyproject.toml
```

### Step 2：目录重命名对齐（10 分钟）

```
原始                          目标
app/                    →    src/
app/api/routes/         →    src/endpoints/
app/api/schemas/        →    src/schemas/
app/api/middleware/      →    src/middleware/
app/main.py             →    src/main.py
app/config.py           →    src/config.py
```

**注意**：需要更新所有 `from app.xxx import` → `from src.xxx import`

### Step 3：补充 `/health` 端点（10 分钟）

```python
# src/endpoints/health.py（新建）
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "agent": "deep-research",
        "version": "0.1.0",
        "models": ["deep-research-v1"],
    }
```

### Step 4：更新 `main.py`（10 分钟）

- 注册 health 路由
- 更新 `app.title` 和 `description`
- 添加 `uvicorn.run()` 入口（端口 8002）

### Step 5：更新 `pyproject.toml`（5 分钟）

- 项目名 → `deep-research-agent`
- 版本 → `0.1.0`

### Step 6：新建 Dockerfile + docker-compose.yml（15 分钟）

从 `_template` 复制并修改端口为 8002。

### Step 7：添加契约测试（20 分钟）

```python
# tests/test_contract.py
# 从 _template 复制，验证四层兼容性
```

### Step 8：验证（10 分钟）

```bash
cd agents/deep-research-agent
pip install -r requirements.txt
python -m src.main
# 验证 GET /health, GET /v1/models, POST /v1/chat/completions
pytest tests/ -v
```

---

## 风险点

1. **import 路径全量替换**：`from app.` → `from src.` 可能遗漏
2. **Chat 端点是 mock**：迁移完成后功能 = 原始状态（mock 响应），核心研究管线需独立开发
3. **`files.py` 路由**：源项目有文件上传功能，评估是否保留

---

## 完成标志

- [ ] `agents/deep-research-agent/` 目录存在且结构符合 `_template`
- [ ] `GET /health` 返回 `{"status":"ok","agent":"deep-research","version":"0.1.0"}`
- [ ] `GET /v1/models` 返回模型列表
- [ ] `POST /v1/chat/completions` 可调通（mock 响应 OK）
- [ ] `pytest tests/test_contract.py` 全部通过
- [ ] `.env.example` 已更新
