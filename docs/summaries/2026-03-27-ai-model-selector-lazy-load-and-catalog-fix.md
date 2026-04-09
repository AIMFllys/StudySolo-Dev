# AI 模型选择器懒加载与目录数据修复总结

> **日期**：2026-03-27  
> **类型**：功能优化 + 数据修复 + 架构健壮性  
> **涉及模块**：AI 对话面板（Track A）、AI 模型目录（Catalog）、Supabase 数据层

---

## 一、背景与根因

### 触发问题

AI 对话侧边栏的模型选择器在页面初始化时出现短暂"空白"状态，且所有 8 个模型的品牌色全部显示为 DeepSeek 蓝（`#4D6BFE`），无法视觉区分不同品牌。

### 深度分析结论

通过完整链路追踪，发现根因是**数据层与配置层的严重失步**：

| 问题 | 影响 |
|------|------|
| `config.yaml` 的 `chat_models` 引用了 8 个 `sku_id`，但数据库 `ai_model_skus` 中只有 2 个实际存在 | 后端 `get_sku_by_id()` 返回 `None`，所有模型的 `vendor` 静默降级为 `deepseek` |
| 后端 `except: pass` 吞掉所有 SKU 查找异常 | 线上故障无从追踪 |
| 前端 `.catch(() => null)` 静默吞掉 API 失败 | 用户看到空列表，无任何提示或重试入口 |
| 模型执行时 `resolve_selected_sku` 返回 `None` | 用户选了 GLM-4.5，实际调用了 DeepSeek，计费也无法按正确 SKU 维度记录 |

---

## 二、改动详情

### 改动 1：懒加载骨架屏 UI（已在上一轮完成）

**文件**：`frontend/src/components/layout/sidebar/SidebarAIPanel.tsx`  
**文件**：`frontend/src/components/layout/sidebar/ModelSelector.tsx`

- 新增 `isModelsLoading` 状态，`finally()` 确保无论成功/失败都会重置
- 模型选择器触发按钮：加载中显示 `Loader2` 旋转图标 + "加载中..."，`disabled` 禁止交互
- 下拉列表：加载中展示 4 个 `animate-pulse` 骨架槽位，消除白屏体验

---

### 改动 2：Supabase 数据迁移 — 补全 7 个 SKU 记录

**新文件**：`supabase/migrations/20260327092200_seed_chat_model_skus.sql`

补全了 `config.yaml chat_models` 所引用但数据库中缺失的所有记录：

**新增 Family（4 个）**：

| family_id | vendor | 说明 |
|-----------|--------|------|
| `zhipu_premium` | zhipu | GLM 旗舰级（GLM-5 / GLM-4.7 等） |
| `doubao_premium` | doubao | 豆包旗舰 Seed 系列 |
| `kimi_reasoning` | moonshot | 月之暗面推理与深度思考模型 |
| `openai_oss` | openai | OpenAI 开放权重模型（七牛代理） |

**新增 SKU（7 个）**：

| sku_id | model_id | provider | 价格（输入/输出 元/百万） |
|--------|----------|----------|----------------------|
| `sku_dashscope_qwen35_flash_native` | `qwen3.5-flash` | dashscope | 0.20 / 2.00 |
| `sku_zhipu_glm_45_native` | `glm-4.5-air` | zhipu | 0.80 / 6.00 |
| `sku_zhipu_glm_47_native` | `glm-5` | zhipu | 4.00 / 18.00 |
| `sku_qiniu_doubao_seed_lite_proxy` | `Doubao Seed 2.0 Lite` | qiniu (proxy) | 0.60 / 3.60 |
| `sku_volcengine_doubao_seed_native` | `Doubao Seed 2.0 Lite` | volcengine | 0.60 / 3.60（降级通道，不可见） |
| `sku_moonshot_kimi_k2_native` | `kimi-k2.5` | moonshot | 4.00 / 21.00 |
| `sku_qiniu_gpt_oss_120b_proxy` | `gpt-oss-120b` | qiniu (proxy) | 1.08 / 5.40 |

> model_id 字符串均来源于项目 `docs/Plans/daily_plan/API` 官方文档验证。

> 迁移使用 `ON CONFLICT DO UPDATE`，可安全重复执行。

---

### 改动 3：config.yaml — vendor 字段独立声明

**文件**：`backend/config.yaml`

在 `chat_models` 每项中增加 `vendor` 字段，使品牌色的决策从"依赖 DB 查询间接推导"改为"配置层自包含声明"：

```yaml
- key: "glm45"
  display_name: "GLM-4.5"
  vendor: "zhipu"          # ← 新增：直接声明，不依赖 DB SKU
  required_tier: "free"
  sku_ids:
    - "sku_zhipu_glm_45_native"
```

**品牌色映射（8 个模型现在各有独立颜色）**：

| vendor | 品牌色 | 对应模型 |
|--------|--------|---------|
| `deepseek` | `#4D6BFE` 蓝 | DeepSeek R1 |
| `qwen` | `#F97316` 橙 | Qwen3.5-Flash, Qwen3-Max |
| `zhipu` | `#2563EB` 深蓝 | GLM-4.5, GLM-4.7 |
| `doubao` | `#3370FF` 品牌蓝 | DouBao Seed 2.0 |
| `moonshot` | `#111827` 深黑 | Kimi K2 |
| `openai_oss` | `#10B981` 绿 | GPT-OSS-120B |

---

### 改动 4：后端健壮性升级

**文件**：`backend/app/api/ai_chat_models.py`

1. **vendor 解析顺序优化**：`config.yaml vendor` → DB SKU vendor → 默认 `deepseek`（三级降级）
2. **静默降级变为可见**：`except Exception: pass` → `logger.warning(...)` 当 SKU 查找异常时输出告警
3. **新增 `openai` 品牌色**：`"openai": "#10B981"` 与 `openai_oss` 保持一致

```python
# 改前：静默吞掉，无任何告警
except Exception:
    pass

# 改后：明确告警，线上可观测
except Exception as exc:
    logger.warning(
        "[chat_models] SKU lookup failed for sku_id=%s key=%s: %s",
        sku_ids[0], key, exc,
    )
```

---

### 改动 5：启动时 SKU 一致性校验

**文件**：`backend/app/services/ai_catalog_service.py`

新增 `validate_config_sku_references()` 函数：

- 启动时遍历 `config.yaml` 中所有 `task_routes` 和 `chat_models` 的 `sku_ids`
- 与数据库 `ai_model_skus` 进行差集校验
- 有缺失项时输出 `WARNING` 日志，防止配置漂移被静默掩盖
- 数据健康时输出 `INFO` 确认：`[startup] All X config SKU references verified OK`

**文件**：`backend/app/main.py`

引入 FastAPI `lifespan` 上下文管理器，在应用启动时自动调用 SKU 校验：

```python
@asynccontextmanager
async def lifespan(application: FastAPI):
    try:
        missing = await validate_config_sku_references()
        if missing:
            logger.warning("[startup] %d missing SKU(s) ...", len(missing))
    except Exception as exc:
        logger.error("[startup] SKU validation failed: %s", exc)
    yield
```

---

### 改动 6：前端错误态 + 重试机制

**文件**：`frontend/src/components/layout/sidebar/SidebarAIPanel.tsx`

- 新增 `modelsError: boolean` 状态
- 将模型列表 fetch 逻辑提取为 `fetchChatModels` 可复用回调（`useCallback`）
- API 失败时设置 `modelsError = true`，而非静默忽略
- `isError` 和 `onRetry` 透传到 `ModelSelector`

**文件**：`frontend/src/components/layout/sidebar/ModelSelector.tsx`

- 接口增加 `isError?: boolean` 和 `onRetry?: () => void`
- 错误态触发器：红色边框 + `RefreshCw` 图标 + "加载失败"文字，点击触发 `onRetry`
- 错误态时隐藏下拉箭头（点击直接重试，而非打开空列表）

**三态 UI 对比**：

| 状态 | 按钮视觉 | 点击行为 |
|------|---------|---------|
| 加载中 | 🔄 旋转图标 + "加载中..." + 禁用 | 无 |
| 错误 | 🔴 红色边框 + ↻ + "加载失败" | 重新 fetch |
| 正常 | 品牌色圆点 + 模型名 + ↓ | 展开列表 |

---

## 三、架构原则应用

本次改动严格遵守三个核心架构原则：

| 原则 | 具体体现 |
|------|---------|
| **数据先行** | 先写迁移 SQL 补全 DB 记录，再改 config，再改代码 |
| **配置即文档** | `chat_models` 每项自包含 `vendor` 字段，不依赖 DB 查询推导展示属性 |
| **失败必可见** | 杜绝所有 `except: pass` 和 `.catch(() => null)`，后端 WARNING + 前端错误态 |

---

## 四、改动文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `supabase/migrations/20260327092200_seed_chat_model_skus.sql` | 🆕 新增 | 补全 4 个 family + 7 个 SKU |
| `backend/config.yaml` | ✏️ 修改 | 8 个 chat_model 项增加 `vendor` 字段 |
| `backend/app/api/ai_chat_models.py` | ✏️ 修改 | vendor 三级降级 + 日志 + `openai` 品牌色 |
| `backend/app/services/ai_catalog_service.py` | ✏️ 修改 | 新增 `validate_config_sku_references()` + logging 导入 |
| `backend/app/main.py` | ✏️ 修改 | 新增 `lifespan` + 启动 SKU 校验 |
| `frontend/src/components/layout/sidebar/SidebarAIPanel.tsx` | ✏️ 修改 | `modelsError` 状态 + `fetchChatModels` 回调 |
| `frontend/src/components/layout/sidebar/ModelSelector.tsx` | ✏️ 修改 | 懒加载骨架屏 + 错误态 UI + `onRetry` |

---

## 五、验证清单

- [ ] 执行迁移 SQL：`supabase db push` 或 Dashboard 手动执行
- [ ] 重启后端，观察启动日志无 `[startup] SKU IDs missing` 告警
- [ ] 打开 AI 对话面板，确认 8 个模型显示**各不相同的品牌色**
- [ ] 初始加载时看到骨架屏动画（非白屏）
- [ ] 断网测试：面板显示红色"加载失败"按钮，点击可重试
