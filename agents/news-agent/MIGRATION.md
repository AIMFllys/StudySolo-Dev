# News Agent 迁移计划

> 源项目：`D:\project\Agents\newsAgents\NewsAgents`
> 目标位置：`StudySolo/agents/news-agent/`
> 预计耗时：~4-6 小时
> 前置依赖：Phase 4B（`_template` 模板就绪）

---

## 源项目兼容性分析

| 维度 | 兼容性 | 说明 |
|------|--------|------|
| 框架 | ✅ FastAPI | 完全匹配 |
| 三端点 | ✅ 全有 | `GET /health` + `GET /v1/models` + `POST /v1/chat/completions` |
| 额外 API | 💡 有 `POST /v1/responses`（OpenAI Responses API） | 加分项，迁移时保留 |
| SSE 格式 | ✅ `data: {json}\n\n` + `data: [DONE]\n\n` | 完全合规 |
| Auth | ✅ `verify_auth` 中间件 | 匹配 |
| **功能完成度** | ✅ **90%+** | 生产可用，41 个数据源 lib |
| 体积 | ⚠️ ~60 文件，含 84KB 的 `last30days.py` | 较大 |
| 目录结构 | ⚠️ `server/` 而非 `src/`，`lib/` 无子目录 | 需重构 |
| Health | ⚠️ 缺少 `agent` + `version` 字段 | 需补充 |

---

## 源项目目录结构

```
NewsAgents/
├── server/
│   ├── __init__.py
│   ├── app.py                      ← FastAPI 入口 + 所有路由（需拆分）
│   ├── api_chat.py                 ← POST /v1/chat/completions
│   ├── auth.py                     ← API Key 验证
│   ├── models.py                   ← 模型定义 + /v1/models
│   ├── pipeline.py                 ← 研究管线核心（~13KB）
│   ├── progress_sse.py             ← 进度 SSE 推送
│   ├── sse.py                      ← SSE 事件构造器
│   └── task_manager.py             ← 后台任务管理
├── lib/                            ← 41 个数据源文件
│   ├── brave_search.py             ← Brave 搜索
│   ├── reddit.py                   ← Reddit 抓取
│   ├── hackernews.py               ← HackerNews
│   ├── youtube_yt.py               ← YouTube
│   ├── xiaohongshu_api.py          ← 小红书
│   ├── bird_x.py                   ← X/Twitter
│   ├── bluesky.py                  ← Bluesky
│   ├── instagram.py                ← Instagram
│   ├── tiktok.py                   ← TikTok
│   ├── polymarket.py               ← Polymarket
│   ├── websearch.py                ← 通用 Web 搜索
│   ├── render.py                   ← 报告渲染（~40KB）
│   ├── schema.py                   ← 数据模型（~31KB）
│   ├── score.py                    ← 评分系统（~24KB）
│   ├── env.py                      ← 环境配置（~27KB）
│   └── ...（共 41 个文件）
├── tests/
├── fixtures/
├── scripts/
├── requirements.txt
├── Dockerfile
├── start.ps1
└── README.md
```

---

## 目标结构

```
agents/news-agent/
├── src/
│   ├── __init__.py
│   ├── main.py                     ← 拆分自 server/app.py
│   ├── config.py                   ← 新建，pydantic-settings
│   ├── router.py                   ← 拆分自 server/app.py
│   ├── endpoints/
│   │   ├── __init__.py
│   │   ├── health.py               ← 补充 agent + version
│   │   ├── models.py               ← 提取自 server/models.py
│   │   ├── completions.py          ← 提取自 server/api_chat.py
│   │   └── responses.py            ← 提取自 server/app.py（保留）
│   ├── core/
│   │   ├── __init__.py
│   │   ├── pipeline.py             ← 移动自 server/pipeline.py
│   │   ├── progress_sse.py         ← 移动自 server/progress_sse.py
│   │   ├── sse.py                  ← 移动自 server/sse.py
│   │   ├── task_manager.py         ← 移动自 server/task_manager.py
│   │   └── prompts.py              ← 新建
│   ├── lib/                        ← 整体搬迁自 lib/（保持不动）
│   │   ├── brave_search.py
│   │   ├── reddit.py
│   │   ├── hackernews.py
│   │   └── ...（41 个文件）
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── request.py              ← 提取自 server/api_chat.py
│   │   └── response.py             ← 提取自 server/models.py
│   └── middleware/
│       ├── __init__.py
│       └── auth.py                 ← 移动自 server/auth.py
├── tests/
│   ├── conftest.py
│   └── test_contract.py            ← 新建，四层契约测试
├── fixtures/                       ← 搬迁自原 fixtures/
├── .env.example
├── Dockerfile                      ← 搬迁自原 Dockerfile，更新端口 8003
├── pyproject.toml                  ← 新建
├── requirements.txt                ← 搬迁自原项目
├── MIGRATION.md                    ← 本文件
└── README.md
```

---

## 迁移步骤

### Step 1：整体复制（10 分钟）

```bash
# 复制核心代码
cp -r D:\project\Agents\newsAgents\NewsAgents\server agents\news-agent\src_raw
cp -r D:\project\Agents\newsAgents\NewsAgents\lib agents\news-agent\src\lib
cp -r D:\project\Agents\newsAgents\NewsAgents\tests agents\news-agent\tests
cp -r D:\project\Agents\newsAgents\NewsAgents\fixtures agents\news-agent\fixtures
cp D:\project\Agents\newsAgents\NewsAgents\requirements.txt agents\news-agent\
cp D:\project\Agents\newsAgents\NewsAgents\Dockerfile agents\news-agent\
```

### Step 2：拆分 `server/app.py`（30 分钟）

这是最大的重构点。`server/app.py`（380 行）需要拆分为：

| 原位置 | 目标 |
|--------|------|
| FastAPI() 初始化 + CORS | `src/main.py` |
| `include_router()` 调用 | `src/router.py` |
| `GET /health` | `src/endpoints/health.py`（补充 agent/version） |
| `GET /v1/models` | `src/endpoints/models.py` |
| `POST /v1/responses` | `src/endpoints/responses.py` |
| `_stream_mode1()` + `_stream_mode3()` | `src/core/pipeline.py` 或 `src/endpoints/responses.py` |

### Step 3：提取 endpoints（20 分钟）

- `server/api_chat.py` → `src/endpoints/completions.py`
- `server/models.py` 中的 Schema → `src/schemas/response.py`
- `server/models.py` 中的 `/v1/models` 路由 → `src/endpoints/models.py`

### Step 4：搬迁 core 模块（10 分钟）

```
server/pipeline.py      → src/core/pipeline.py
server/progress_sse.py   → src/core/progress_sse.py
server/sse.py            → src/core/sse.py
server/task_manager.py   → src/core/task_manager.py
server/auth.py           → src/middleware/auth.py
```

### Step 5：修复 import 路径（30 分钟）

这是最耗时的步骤。所有文件中的 import 需要更新：

```python
# 原始
from lib import env, render
from .auth import verify_auth
from .models import AVAILABLE_MODELS

# 目标
from src.lib import env, render
from src.middleware.auth import verify_auth
from src.schemas.response import AVAILABLE_MODELS
```

### Step 6：补充 Health 字段（5 分钟）

```python
@router.get("/health")
async def health():
    return {
        "status": "ok",
        "agent": "news",
        "version": "0.1.0",
        "uptime_seconds": int(time.time() - _start_time),
        "models": ["last30days", "last30days-quick", "last30days-deep"],
    }
```

### Step 7：新建 config.py + pyproject.toml（10 分钟）

从 `_template` 复制并修改。

### Step 8：添加契约测试（20 分钟）

从 `_template/tests/test_contract.py` 复制并适配。

### Step 9：验证（20 分钟）

```bash
cd agents/news-agent
pip install -r requirements.txt
python -m src.main
# 验证所有端点
pytest tests/ -v
```

---

## 风险点

1. **`lib/` 相互依赖复杂**：41 个文件之间有交叉引用，搬迁时不要拆分 lib 内部结构
2. **`last30days.py`（84KB）**：这个巨大文件是核心入口，依赖几乎所有 lib 文件
3. **`server/app.py` 中流式生成器**：`_stream_mode1()` 和 `_stream_mode3()` 逻辑复杂，拆分时注意闭包变量
4. **环境变量差异**：NewsAgents 的 `lib/env.py`（27KB）包含大量自定义配置逻辑，需要与 `_template` 的 `config.py` 并存
5. **Cookie 相关模块**：`chrome_cookies.py`、`safari_cookies.py`、`cookie_extract.py` 在服务器环境可能不可用

---

## 完成标志

- [ ] `agents/news-agent/` 目录存在且结构符合目标
- [ ] `GET /health` 返回 `{"status":"ok","agent":"news","version":"0.1.0"}`
- [ ] `GET /v1/models` 返回模型列表（last30days 等）
- [ ] `POST /v1/chat/completions` 可调通（stream + non-stream）
- [ ] `POST /v1/responses` 可调通（保留的额外 API）
- [ ] `pytest tests/test_contract.py` 全部通过
- [ ] `lib/` 下 41 个文件完整，import 路径全部修正
- [ ] `Dockerfile` 端口已更新为 8003
