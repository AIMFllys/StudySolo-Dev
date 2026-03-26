# AI 模型双轨选择与容灾路由完整规划

> 最后更新：2026-03-27
> 编码要求：UTF-8
> 定位：**AI 对话面板 vs 工作流节点 — 模型选择拆分与容灾降级的完整实施规划**
> 权威优先级：本文档 > `model-split-analysis.md` (分析草稿)
> 配套参考：
> - [项目AI调用及计费分析统一规范.md](../项目规范/项目AI调用及计费分析统一规范.md)
> - [API 统一路由规划](../../Plans/daily_plan/API/README.md)
> - [03-AI配置与计费体系后续工作详细清单.md](../../Plans/daily_plan/API/03-AI配置与计费体系后续工作详细清单.md)

---

## 第一部分：现状全景诊断

### 1.1 当前 DB 中实际存在的 SKU 全表（17 条）

以下为 2026-03-27 从生产库 `ai_model_skus` 表导出的全量真实数据：

| # | sku_id | vendor | provider | model_id | display_name | tier | selectable | fallback_only | 价格(输入/输出) |
|---|--------|--------|----------|----------|-------------|------|-----------|---------------|---------------|
| 1 | `sku_deepseek_chat_native` | deepseek | deepseek | deepseek-chat | DeepSeek V3（原生）| free | ✅ | ❌ | 2/3 |
| 2 | `sku_deepseek_reasoner_native` | deepseek | deepseek | deepseek-reasoner | DeepSeek R1（原生）| pro | ✅ | ❌ | 2/3 |
| 3 | `sku_dashscope_qwen_turbo_native` | qwen | dashscope | qwen-turbo | Qwen Turbo（百炼）| free | ✅ | ❌ | 0.3/0.6 |
| 4 | `sku_dashscope_qwen_plus_native` | qwen | dashscope | qwen-plus | Qwen Plus（百炼）| pro | ✅ | ❌ | 0.8/2 |
| 5 | `sku_dashscope_qwen_max_native` | qwen | dashscope | qwen-max | Qwen Max（百炼）| ultra | ❌ | ✅ | 0/0 ⚠️ |
| 6 | `sku_qiniu_qwen3_max_proxy` | qwen | qiniu | Qwen3-Max | Qwen 3 Max（七牛）| pro_plus | ✅ | ❌ | 6/24 |
| 7 | `sku_siliconflow_qwen_72b_proxy` | qwen | siliconflow | Qwen/Qwen2.5-72B-Instruct | Qwen 72B（硅基流动）| pro_plus | ❌ | ✅ | 0/0 ⚠️ |
| 8 | `sku_volcengine_doubao_pro_32k_native` | doubao | volcengine | Doubao-pro-32k | 豆包 Pro（火山）| free | ✅ | ❌ | 0/0 ⚠️ |
| 9 | `sku_volcengine_doubao_pro_256k_native` | doubao | volcengine | Doubao-pro-256k | 豆包 Pro 256K（火山）| pro | ✅ | ❌ | 0/0 ⚠️ |
| 10 | `sku_zhipu_glm_4_flash_native` | zhipu | zhipu | glm-4-flash | GLM-4 Flash（智谱）| free | ✅ | ❌ | 0/0 ⚠️ |
| 11 | `sku_zhipu_glm_4_native` | zhipu | zhipu | glm-4 | GLM-4（智谱）| pro | ✅ | ❌ | 0/0 ⚠️ |
| 12 | `sku_zhipu_glm_ocr_native` | zhipu | zhipu | glm-ocr | GLM OCR（智谱）| free | ❌ | ✅ | 0.2/0.2 |
| 13 | `sku_moonshot_v1_8k_native` | moonshot | moonshot | moonshot-v1-8k | Kimi 8K（原生）| free | ✅ | ❌ | 0/0 ⚠️ |
| 14 | `sku_moonshot_v1_128k_native` | moonshot | moonshot | moonshot-v1-128k | Kimi 128K（原生）| pro_plus | ✅ | ❌ | 0/0 ⚠️ |
| 15 | `sku_qiniu_kimi_k2_5_proxy` | moonshot | qiniu | Kimi-K2.5 | Kimi K2.5（七牛）| pro_plus | ✅ | ❌ | 4/21 |
| 16 | `sku_qiniu_search_primary` | qiniu | qiniu | qiniu-search-hybrid | 七牛混合搜索 | free | ❌ | ✅ | 36000/36000 |
| 17 | `sku_zhipu_search_expansion` | zhipu | zhipu | zhipu-search-expansion | 智谱搜索扩量 | free | ❌ | ✅ | 0/0 ⚠️ |

**关键发现：**

1. ⚠️ 标注的 8 条 SKU 价格仍为 0，属于 [03-AI配置与计费体系后续工作清单] 中尚未完成的「价格补全」任务
2. 对话面板要求的 8 个模型中，仅 3 个在 DB 中有对应 SKU（DeepSeek R1、Qwen3-Max 七牛、GLM-4）
3. 缺失的 SKU：Qwen3.5-Flash、GLM-4.5、GLM-4.7、DouBao-Seed2.0、Kimi-K2、GPT-OSS-120B
4. 🟢 **P0 已完成**：全部 6 个新增模型的真实 model_id 已由用户确认（2026-03-27）

### 1.2 当前容灾降级机制实际代码行为

通过逐行阅读 `ai_router.py`，当前实际实现的降级行为如下：

#### 1.2.1 `call_llm_direct()` — 对话面板的调用路径

```
用户选模型 → selected_model_key
         ↓
resolve_selected_sku() → CatalogSku{provider, model_id}
         ↓
call_llm_direct(sku.provider, sku.model_id, messages, stream=True)
         ↓ 成功 → 正常返回流式 Token
         ↓ 失败 (APITimeoutError | APIError)
         ↓
         ├─ 如果已经有 Token 输出(yielded_any=True)
         │  → raise AIRouterError ❌ 无法降级（流已中断）
         │
         └─ 如果还未产生任何 Token
            → call_llm_structured("chat_response", messages, stream=True)
            → 进入 config.yaml 的 chat_response 路由链
            → 依次尝试: deepseek-reasoner → qwen-plus → doubao-pro-256k
```

**核心问题**：`call_llm_direct()` 失败后的降级是「退化到通用兜底链」，而不是「同家族模型的精准降级」。

示例：用户选了 `Kimi-K2`(moonshot)，如果月之暗面挂了 → 降级到 `deepseek-reasoner`（完全不相关的模型），用户体验断裂。

#### 1.2.2 `call_llm()` / `call_llm_structured()` — 工作流节点的调用路径

```
节点执行 → executor 读取 node.type
         ↓
call_llm(node_type, messages)
         ↓
_build_route_candidates(node_type) → config.yaml task_routes 的 sku_ids
         ↓
遍历 candidates[0..N]:
  ├─ candidate[0] 成功 → 返回
  ├─ candidate[0] 失败 → 记录 error_attempt → continue
  ├─ candidate[1] 成功 → 返回（标记 is_fallback=true）
  ├─ ... → 继续尝试
  └─ 全部失败 → raise AIRouterError
```

**这套机制是完善的**：每个 task_route 有 2-3 个 SKU 候选，自动逐级降级。

**但如果用户在节点上手动选了模型**：节点走 `call_llm_direct()`，退回到与对话面板同样的「退化式降级」问题。

### 1.3 两种场景的容灾对比

| 场景 | 调用路径 | 当前降级方式 | 降级质量 | 问题 |
|------|---------|------------|---------|------|
| **节点默认模型** | `call_llm()` → task_routes | ✅ 同类型多候选链 | **高** | 无 |
| **节点手选模型** | `call_llm_direct()` | ⚠️ 退化到 chat_response | **低** | 模型语义不连续 |
| **对话面板选模型** | `call_llm_direct()` | ⚠️ 退化到 chat_response | **低** | 模型语义断裂 |
| **对话面板未选模型** | `call_llm("chat_response")` | ✅ 3 候选链 | **高** | 无 |

---

## 第二部分：目标架构设计

### 2.1 双轨分离总体架构

```
                      ┌───────────────────────────────────────┐
                      │         ai_model_skus (DB 统一)        │
                      │    所有模型 SKU 的完全集（含路由元数据）  │
                      └────────────┬──────────────┬───────────┘
                                   │              │
              ┌────────────────────▼──┐    ┌──────▼─────────────────┐
              │  轨道 A: AI 对话目录    │    │  轨道 B: 工作流节点目录   │
              │  (精选 · 品牌命名)      │    │  (全量 · 厂商分组)       │
              ├───────────────────────┤    ├────────────────────────┤
              │ 数据源:                │    │ 数据源:                 │
              │ config.yaml 新增       │    │ DB is_user_selectable  │
              │ chat_models 配置块     │    │ + config.yaml 不变     │
              ├───────────────────────┤    ├────────────────────────┤
              │ 前端展示:              │    │ 前端展示:               │
              │ 扁平列表，无厂商分区    │    │ 2 级菜单                │
              │ 统一品牌名命名          │    │ L1=厂商 L2=模型         │
              │ 不暴露 provider        │    │ 不暴露 native/proxy     │
              ├───────────────────────┤    ├────────────────────────┤
              │ 路由策略:              │    │ 路由策略:               │
              │ per-model 精准降级链   │    │ 沿用 config.yaml        │
              │ chat_models 配置驱动   │    │ task_routes 机制        │
              └───────────────────────┘    └────────────────────────┘
```

### 2.2 轨道 A — AI 对话面板精选 8 模型

#### 模型列表（固定顺序，即最终渲染顺序）

| 序号 | 面板展示名 | 后端路由链（首选 → 降级） | 会员门槛 | 容灾策略 | 特殊标记 |
|------|-----------|------------------------|---------|---------|--------|
| 1 | DeepSeek R1 | `deepseek/deepseek-reasoner` | free | 无降级，挂了报错 | — |
| 2 | Qwen3.5-Flash | `dashscope/qwen3.5-flash` | free | 无降级，挂了报错 | — |
| 3 | Qwen3-Max | `qiniu/Qwen3-Max` → `dashscope/qwen-max` | pro | proxy_first，七牛挂了走官网 | 会员 👑 |
| 4 | GLM-4.5 | `zhipu/glm-4.5` | free | 无降级，挂了报错 | — |
| 5 | GLM-4.7 | `zhipu/glm-4.7` | pro | 无降级，挂了报错 | 会员 👑 + **⭐ 推荐** |
| 6 | DouBao-Seed2.0 | `qiniu/doubao-seed-2-0-lite-260215` → `volcengine/doubao-seed-2.0` | pro | proxy_first，七牛挂了走火山 | 会员 👑 |
| 7 | Kimi-K2 | `moonshot/kimi-k2-thinking-turbo` | pro | 无降级，挂了报错 | 会员 👑 |
| 8 | GPT-OSS-120B | `qiniu/gpt-oss-120b` | pro | 无降级，挂了报错 | 会员 👑 |

#### 「无降级，挂了报错」的合理性说明

| 模型 | 为什么不设降级 | 业界参考 |
|------|-------------|---------|
| DeepSeek R1 | 其推理能力（CoT 思维链）独一无二，降级到任何其他模型都意味着能力断崖 | OpenAI o1 也是单点无替代 |
| Qwen3.5-Flash | 百炼系统 SLA 99.9%+，极少宕机；降到其他厂商 Flash 模型行为差异大 | Google Gemini Flash 也是单通道 |
| GLM-4.5 / GLM-4.7 | 智谱系独有模型（`glm-4.5` / `glm-4.7`），没有跨厂商同架构替代 | Anthropic Claude 同理 |
| Kimi-K2 | 月之暗面独有，`kimi-k2-thinking-turbo` 是特殊推理模式 | — |
| GPT-OSS-120B | 仅七牛云提供（`gpt-oss-120b`），独占性资源 | — |

**业界对标**：OpenAI API 的 o1-mini、Claude Sonnet 等旗舰模型同样不提供跨厂商自动降级。标准做法是向用户返回明确错误信息 + 建议手动切换模型。

#### 「有降级」的模型降级链路解释

**Qwen3-Max**：
```
请求 → qiniu/Qwen3-Max (代理，成本比官网低)
        ↓ 失败
        dashscope/qwen-max (官网，价格稍高但保证可用)
```

**DouBao-Seed2.0**：
```
请求 → qiniu/doubao-seed-2-0-lite-260215 (代理，七牛云)
        ↓ 失败
        volcengine/doubao-seed-2.0 (官网火山引擎)
```

### 2.3 轨道 B — 工作流节点全量模型 2 级菜单

#### 2 级菜单结构设计

```
┌─────────────────────────────────────────┐
│  选择模型                         ▼     │
├─────────────────────────────────────────┤
│  ▪ DeepSeek                             │
│    ├── DeepSeek V3          [Free]      │
│    └── DeepSeek R1          [PRO]       │
│  ▪ 通义千问                             │
│    ├── Qwen Turbo           [Free]      │
│    ├── Qwen Plus            [PRO]       │
│    └── Qwen 3 Max           [PRO+] 七牛 │
│  ▪ 智谱 GLM                             │
│    ├── GLM-4 Flash          [Free]      │
│    └── GLM-4                [PRO]       │
│  ▪ 豆包                                 │
│    ├── 豆包 Pro             [Free]      │
│    └── 豆包 Pro 256K        [PRO]       │
│  ▪ Kimi (月之暗面)                      │
│    ├── Kimi 8K              [Free]      │
│    ├── Kimi 128K            [PRO+]      │
│    └── Kimi K2.5            [PRO+] 七牛 │
└─────────────────────────────────────────┘
```

#### 分组依据

分组使用 DB 字段 `ai_model_families.vendor`，而不是 `ai_model_skus.provider`：

| vendor 值 | L1 菜单展示名 | 说明 |
|-----------|-------------|------|
| `deepseek` | DeepSeek | — |
| `qwen` | 通义千问 | 不暴露 dashscope/qiniu/siliconflow |
| `zhipu` | 智谱 GLM | — |
| `doubao` | 豆包 | 不暴露 volcengine |
| `moonshot` | Kimi (月之暗面) | — |

用户不需要知道调用走的是原生还是代理。代理 SKU 通过 `(七牛)` 后缀在 display_name 中有轻微提示，但不作为分组维度。

---

## 第三部分：容灾降级精确机制设计

### 3.1 现有降级机制的 3 个缺陷

| 缺陷 | 代码位置 | 影响 |
|------|---------|------|
| **D1: 语义断裂降级** | `ai_router.py` L308, L341 | `call_llm_direct()` 失败后退化到 `chat_response` 路由，用户选的 Kimi 变成了 DeepSeek |
| **D2: 无 per-model 降级链** | `config.yaml` 仅有 task 级路由 | 对话面板每个模型没有专属的降级候选 |
| **D3: 流式中断不可恢复** | `ai_router.py` L306-307 | 如果已经发出 Token 后 API 挂了，直接报错无法降级到其他通道（这是正确的，但需要前端处理） |

### 3.2 新增 chat_models 配置块（核心变更）

在 `config.yaml` 中新增 `chat_models` 配置块，为对话面板每个模型定义精准降级链：

```yaml
# config.yaml 新增：AI 对话面板精选模型路由
# 设计原则：
#   1. 每个 chat_model 对应面板上的一个选择项
#   2. sku_ids 列表即为降级链（index 0 = 首选，index 1 = 降级）
#   3. 只有 1 个 sku_id 的模型表示「无降级，挂了报错」
#   4. display_name 是面板展示名，不暴露 provider 信息
#   5. required_tier 决定前端是否置灰 + 后端拦截

chat_models:
  - key: "deepseek_r1"
    display_name: "DeepSeek R1"
    required_tier: "free"
    sort_order: 1
    sku_ids:
      - "sku_deepseek_reasoner_native"

  - key: "qwen35_flash"
    display_name: "Qwen3.5-Flash"
    required_tier: "free"
    sort_order: 2
    sku_ids:
      - "sku_dashscope_qwen35_flash_native"    # model_id: qwen3.5-flash ✅ 已确认

  - key: "qwen3_max"
    display_name: "Qwen3-Max"
    required_tier: "pro"
    sort_order: 3
    sku_ids:
      - "sku_qiniu_qwen3_max_proxy"
      - "sku_dashscope_qwen_max_native"

  - key: "glm45"
    display_name: "GLM-4.5"
    required_tier: "free"
    sort_order: 4
    sku_ids:
      - "sku_zhipu_glm_45_native"              # model_id: glm-4.5 ✅ 已确认

  - key: "glm47"
    display_name: "GLM-4.7"
    required_tier: "pro"
    sort_order: 5
    is_recommended: true                        # ⭐ 推荐图标
    sku_ids:
      - "sku_zhipu_glm_47_native"              # model_id: glm-4.7 ✅ 已确认（注意：非旧 glm-4）

  - key: "doubao_seed"
    display_name: "DouBao-Seed2.0"
    required_tier: "pro"
    sort_order: 6
    sku_ids:
      - "sku_qiniu_doubao_seed_lite_proxy"     # model_id: doubao-seed-2-0-lite-260215 ✅ 已确认
      - "sku_volcengine_doubao_seed_native"

  - key: "kimi_k2"
    display_name: "Kimi-K2"
    required_tier: "pro"
    sort_order: 7
    sku_ids:
      - "sku_moonshot_kimi_k2_native"          # model_id: kimi-k2-thinking-turbo ✅ 已确认

  - key: "gpt_oss_120b"
    display_name: "GPT-OSS-120B"
    required_tier: "pro"
    sort_order: 8
    sku_ids:
      - "sku_qiniu_gpt_oss_120b_proxy"         # model_id: gpt-oss-120b ✅ 已确认
```

### 3.3 后端路由规则变更

#### 3.3.1 新增 API 端点

```
GET /api/ai/chat/models
```

返回格式：

```json
{
  "models": [
    {
      "key": "deepseek_r1",
      "display_name": "DeepSeek R1",
      "required_tier": "free",
      "sort_order": 1,
      "brand_color": "#4D6BFE",
      "description": "强悍推理，思维链透明可见",
      "has_fallback": false,
      "is_recommended": false
    },
    {
      "key": "glm47",
      "display_name": "GLM-4.7",
      "required_tier": "pro",
      "sort_order": 5,
      "brand_color": "#3B82F6",
      "description": "智谱旗舰，Agentic Engineering",
      "has_fallback": false,
      "is_recommended": true
    }
  ]
}
```

#### 3.3.2 对话调用时的路由变更

当前 `ai_chat_stream.py` 的调用链：

```python
# 现有：直接调 call_llm_direct，失败后退化
if selected_sku:
    token_iter = await call_llm_direct(
        selected_sku.provider, selected_sku.model_id, ...
    )
```

改后：

```python
# 新增：使用 chat_model key 进行精准路由
if body.selected_model_key and body.selected_model_key.startswith("chat_"):
    # Chat 面板模型 → 走 chat_models 路由链
    token_iter = await call_llm("chat:" + chat_model_key, messages, stream=True)
elif selected_sku:
    # 工作流节点手选模型 → 维持现有 direct 调用逻辑
    token_iter = await call_llm_direct(
        selected_sku.provider, selected_sku.model_id, ...
    )
```

**or 更简洁的方案**（推荐）：

在 `ai_router.py` 内部增强 `call_llm_direct_structured()`，使其查找 `chat_models` 配置中的 sku_ids 列表作为精准降级候选，而不是暴力退化到 `chat_response`：

```python
# ai_router.py 中 call_llm_direct_structured 的 fallback 逻辑变更
# 原来：失败后 → call_llm_structured("chat_response", ...)
# 改后：失败后 → 查 chat_models 中是否有匹配的降级链 → 有则走降级链 → 无则走 chat_response
```

#### 3.3.3 错误处理策略（无降级模型）

对于只有 1 个 sku_id 的模型（DeepSeek R1 / Qwen3.5-Flash / GLM 等），失败后：

```python
# 后端行为
if all_candidates_exhausted and len(candidates) == 1:
    raise AIRouterError(
        f"{model_display_name} 服务暂时不可用，请稍后重试或切换其他模型"
    )

# 前端展示
{
    "error": "DeepSeek R1 服务暂时不可用，请稍后重试或切换其他模型",
    "error_code": "MODEL_UNAVAILABLE",
    "done": true,
    "suggested_alternatives": ["qwen35_flash", "glm45"]
}
```

**业界参考**：
- OpenAI：返回 503 Service Unavailable + `"The model is currently overloaded"`
- Anthropic：返回 529 Overloaded + 建议 exponential backoff
- Google AI Studio：返回 `UNAVAILABLE` + 自动建议切换到 Flash 模型

我们的方案比业界更友好——在错误信息中直接给出可选替代模型。

---

## 第四部分：DB 变更设计

### 4.1 需要新增的 ai_model_families 行

| id | vendor | family_name | task_family | routing_policy |
|----|--------|-------------|-------------|---------------|
| `qwen_flash` | qwen | Qwen Flash | cheap_chat | native_first |
| `zhipu_45` | zhipu | GLM 4.5 | cheap_chat | native_first |
| `zhipu_47` | zhipu | GLM 4.7 | premium_chat | native_first |
| `doubao_flagship` | doubao | Doubao Flagship | premium_chat | proxy_first |
| `kimi_flagship` | moonshot | Kimi Flagship | premium_chat | native_first |
| `gpt_oss` | openai_oss | GPT OSS | premium_chat | proxy_first |

> **注意**：GLM-4.7 (`glm-4.7`) 是与旧 `glm-4` 不同的新模型，需要新建独立 family 和 SKU，**不复用**现有 `sku_zhipu_glm_4_native`。

### 4.2 需要新增的 ai_model_skus 行

| sku_id | family_id | provider | model_id | display_name | required_tier | is_user_selectable | is_fallback_only | 价格(输入/输出) | 来源 | 确认状态 |
|--------|-----------|----------|----------|-------------|--------------|-------------------|-----------------|---------------|------|--------|
| `sku_dashscope_qwen35_flash_native` | qwen_flash | dashscope | `qwen3.5-flash` | Qwen3.5-Flash（百炼）| free | true | false | **待查** | 百炼控制台 | ✅ ID 已确认 |
| `sku_zhipu_glm_45_native` | zhipu_45 | zhipu | `glm-4.5` | GLM-4.5（智谱）| free | true | false | **待查** | 智谱控制台 | ✅ ID 已确认 |
| `sku_zhipu_glm_47_native` | zhipu_47 | zhipu | `glm-4.7` | GLM-4.7（智谱）⭐ | pro | true | false | **待查** | 智谱控制台 | ✅ ID 已确认 |
| `sku_qiniu_doubao_seed_lite_proxy` | doubao_flagship | qiniu | `doubao-seed-2-0-lite-260215` | DouBao Seed Lite（七牛）| pro | true | false | 0.6/3.6 | 七牛模型广场 | ✅ ID 已确认 |
| `sku_volcengine_doubao_seed_native` | doubao_flagship | volcengine | `doubao-seed-2.0` | DouBao Seed（火山）| pro | false | true | **待查** | 火山控制台 | ⚠️ 降级链 |
| `sku_moonshot_kimi_k2_native` | kimi_flagship | moonshot | `kimi-k2-thinking-turbo` | Kimi-K2（原生）| pro | true | false | **待查** | 月之暗面控制台 | ✅ ID 已确认 |
| `sku_qiniu_gpt_oss_120b_proxy` | gpt_oss | qiniu | `gpt-oss-120b` | GPT-OSS-120B（七牛）| pro | true | false | 1.08/5.4 | 七牛模型广场 | ✅ ID 已确认 |

### 4.3 需要修改的现有 SKU

| sku_id | 变更项 | 原值 | 新值 | 原因 |
|--------|-------|------|------|------|
| `sku_deepseek_reasoner_native` | required_tier | pro | **free** | 对话面板要求 DeepSeek R1 为 Free 模型 |
| `sku_dashscope_qwen_max_native` | is_fallback_only | true | **true** (不变) | 保持为 Qwen3-Max 的官网降级通道 |
| `sku_dashscope_qwen_max_native` | required_tier | ultra | **pro** | 对齐 Qwen3-Max 的 tier 到 pro |

---

## 第五部分：前端变更设计

### 5.1 轨道 A — 对话面板 ModelSelector 改造

#### 当前问题

`ModelSelector.tsx` 使用 `groupModelsByProvider()` 按 provider 分组渲染，展示"七牛云 / 百炼 / 智谱"等技术通道名称。

#### 改造目标

改为扁平有序列表，按 `chat_models` 配置的 `sort_order` 排列，不再分组：

```tsx
// 改造前：
const groups = groupModelsByProvider(options);
{Object.entries(groups).map(([provider, models]) => (
  <div key={provider}>
    <span>{provider}</span>  // 展示 "七牛云"、"百炼" 等
    {models.map(model => <ModelItem />)}
  </div>
))}

// 改造后：
// options 已经按 sort_order 排好序，直接渲染
{options.map(model => <ModelItem />)}
```

#### 数据来源变更

```typescript
// 改造前：SidebarAIPanel.tsx
const models = await getUserAiModelCatalog();  // 调用 /api/ai/models/catalog

// 改造后：
const models = await getChatModelList();  // 调用 /api/ai/chat/models (新增)
```

#### 新增类型

```typescript
// 新增 ChatModelOption，与 AIModelOption 解耦
interface ChatModelOption {
  key: string;            // "deepseek_r1"
  displayName: string;    // "DeepSeek R1"
  requiredTier: TierType;
  sortOrder: number;
  brandColor: string;
  description: string;
  hasFallback: boolean;   // 前端可据此在 Tooltip 中提示"无降级"
  isRecommended: boolean; // ⭐ GLM-4.7 等标记推荐的模型
  isPremium: boolean;     // 会员模型(pro/pro_plus) → 显示 👑 皇冠图标 + 置灰
}
```

#### 会员模型样式说明（与现有机制一致）

| 条件 | UI 表现 |
|------|--------|
| `isPremium = true` + 用户未达标 | 置灰 + 👑 `PRO` 标签 + 不可点击 |
| `isPremium = true` + 用户已达标 | 正常可点 + 👑 `PRO` 标签 |
| `isRecommended = true` | 额外显示 ⭐ 推荐图标（仅 GLM-4.7）|

### 5.2 轨道 B — 节点 NodeModelSelector 2 级菜单改造

#### 新增工具函数

```typescript
// ai-models.ts 新增
const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  zhipu: '智谱 GLM',
  doubao: '豆包',
  moonshot: 'Kimi (月之暗面)',
};

function groupModelsByVendor(options: AIModelOption[]): Record<string, AIModelOption[]> {
  const groups: Record<string, AIModelOption[]> = {};
  for (const opt of options) {
    const vendorKey = opt.vendor ?? 'other';
    const displayVendor = VENDOR_DISPLAY_NAMES[vendorKey] ?? vendorKey;
    (groups[displayVendor] ??= []).push(opt);
  }
  return groups;
}
```

#### NodeModelSelector 改造要点

- L1 菜单：渲染 `VENDOR_DISPLAY_NAMES` 的键
- L2 菜单：渲染该 vendor 下的所有 `is_user_selectable=true` 的 SKU
- 保持 PRO 标签 + 置灰 + Upsell 提示的现有逻辑
- 数据来源不变：继续调用 `/api/ai/models/catalog`

---

## 第六部分：实施计划

### 6.1 阶段划分

| 阶段 | 内容 | 前置依赖 | 预估工作量 | 状态 |
|------|------|---------|-----------|----- |
| **P0: 模型可用性确认** | 逐个确认 6 个待新增 SKU 的真实 model_id | 无 | 30 min | ✅ **已完成** |
| **P1: DB 数据准备** | 新增 families + SKUs + 修改现有 SKU | P0 ✅ | 1h | ⏳ 待执行 |
| **P2: 后端 chat_models 配置** | config.yaml 新增 chat_models 块 + API 端点 | P1 | 2h | ⏳ 待执行 |
| **P3: 后端路由增强** | ai_router.py 在 call_llm_direct 失败时查 chat_models 降级链 | P2 | 2h | ⏳ 待执行 |
| **P4: 前端对话面板改造** | ModelSelector 扁平化 + 新数据源 + 推荐图标 | P2 | 1.5h | ⏳ 待执行 |
| **P5: 前端节点选择器改造** | NodeModelSelector 2 级菜单 | P1 | 2h | ⏳ 待执行 |
| **P6: 全链路验证** | 8 模型逐个 chat 测试 + 降级测试 + 节点选模测试 | P3-P5 | 1.5h | ⏳ 待执行 |

### 6.2 P0 确认结果（✅ 已完成 2026-03-27）

| 序号 | 模型 | 确认的真实 model_id | 确认时间 |
|------|------|-------------------|---------|
| 1 | Qwen3.5-Flash | `qwen3.5-flash` | 2026-03-27 |
| 2 | GLM-4.5 | `glm-4.5`（非 glm-4-air，非旧 glm-4-flash）| 2026-03-27 |
| 3 | GLM-4.7 | `glm-4.7`（独立新模型，非旧 DB 中的 `glm-4`）| 2026-03-27 |
| 4 | DouBao-Seed2.0 | `doubao-seed-2-0-lite-260215`（七牛云专用 ID）| 2026-03-27 |
| 5 | Kimi-K2 | `kimi-k2-thinking-turbo` | 2026-03-27 |
| 6 | GPT-OSS-120B | `gpt-oss-120b` | 2026-03-27 |

> **重要发现**：GLM-4.7 的 model_id 是 `glm-4.7`，与 DB 中现有的 `sku_zhipu_glm_4_native`（model_id=`glm-4`）是**不同模型**。需要新建独立 SKU `sku_zhipu_glm_47_native`。

### 6.3 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 部分模型 API 尚未正式发布 | 中 | 对话面板无法展示该模型 | 配置为 `is_enabled=false`，等 API 就绪后开启 |
| 七牛云 model_id 与官网不一致 | 低 | 调用 404 | 提前在测试环境验证 |
| DeepSeek R1 从 pro 改为 free 的成本影响 | 中 | 免费用户大量调用推理模型 | 结合 usage quota 日限额控制 |
| 前端改造导致 ModelSelector 回归 | 低 | UI 异常 | 保留旧组件在 git 中，可快速回滚 |

---

## 第七部分：与现有规范文档的关系

### 7.1 遵守的硬约束（来自 03-后续工作清单 §7）

本规划严格遵守以下已确立的硬约束：

- ✅ 不把运行时核心路由完全迁移到后台可编辑配置（chat_models 在 config.yaml 中）
- ✅ 不把价格逻辑写回 YAML（价格仍由 Supabase SKU 表承载）
- ✅ 不按 vendor 模糊结算成本（计费仍按 platform 级 SKU 精确结算）
- ✅ 不让工具模型混入普通聊天路由链
- ✅ 不绕过 `selected_model_key` 再扩展新的正式请求字段

### 7.2 与统一规范的一致性

| 统一规范条款 | 本规划对应 |
|------------|----------|
| §2.1 运行时路由层归 YAML / Python | chat_models 配置块在 config.yaml ✅ |
| §2.2 模型目录层归 Supabase | 新增 SKU 仍存 DB ✅ |
| §3.1 便宜模型 native_first | DeepSeek R1 / Qwen3.5-Flash / GLM 均走原生 ✅ |
| §3.2 贵模型 proxy_first | Qwen3-Max / DouBao-Seed 走七牛再降级 ✅ |
| §9.1 正式入口 selected_model_key | 对话面板使用 chat_model key，本质同一字段 ✅ |

### 7.3 配套文档的更新要求

本规划实施完成后，需同步更新：

1. `项目AI调用及计费分析统一规范.md` — 新增 §9.4 对话面板模型选择接口说明
2. `config.yaml` 文件头注释 — 标注 chat_models 区块用途
3. `新增AI模型-SOP.md` — 新增「对话面板模型上下架」操作指引

---

## 附录 A：七牛云可用模型中与本规划相关的 model_id 确认

来源：`docs/Plans/daily_plan/API/AI_API参考资料/七牛云-更详细指南.md/七牛云可用模型.md` + 用户确认

| 需要的模型 | 七牛云 model_id | 价格（输入/输出 元/K） | 确认状态 |
|-----------|----------------|---------------------|---------|
| Qwen3-Max | `Qwen3-Max` | 0.006/0.024 | ✅ 已确认，DB 已有 |
| DouBao-Seed2.0 Lite | `doubao-seed-2-0-lite-260215` | 0.0006/0.0036 | ✅ 已确认（用户提供精确 ID）|
| GPT-OSS-120B | `gpt-oss-120b` | 0.00108/0.0054 | ✅ 已确认 |
| DeepSeek R1 (七牛) | `DeepSeek-R1` | 0.004/0.016 | ℹ️ 不使用（对话面板 R1 走官网） |

## 附录 B：优云智算可用模型参考

来源：`docs/Plans/daily_plan/API/AI_API参考资料/优云智算-更详细官方指南/优云智算可用模型.md`

优云智算当前不用于对话面板的 8 个模型。其主要价值在于：
- 海外旗舰模型独占（GPT-5.x / Claude-4.x）— 未来 Pro 用户扩展方向
- 作为七牛云的二级灾备候选

---

> **一句话总结**：对话面板 8 个精选模型走 `chat_models` 配置块实现 per-model 精准降级链，工作流节点全量模型走现有 `task_routes` 机制 + 前端 2 级 vendor 分组，两条轨道共享 DB SKU 层但完全独立路由。
