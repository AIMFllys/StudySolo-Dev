# 用户等级模型路由降配机制 · 实施指南

> 📅 创建日期：2026-02-27  
> 📌 所属模块：user_auth · 用户认证与权限  
> 🔗 关联文档：[01-auth-and-guard-strategy](./01-auth-and-guard-strategy.md) · [API 统一路由规划](../API/README.md) · [工作流AI交互规划](../core/工作流AI交互规划.md) · [vip-01-会员体系设计](./vip-01-membership-system-design.md)  
> 🎯 定位：**基于用户等级（Free/Pro/Pro+/Ultra）的 AI 模型路由降配策略，将"十路任务分流矩阵"与用户 Tier 交叉融合**

---

## 📑 目录

- [一、设计背景与核心原则](#一设计背景与核心原则)
- [二、免费版极简三角矩阵策略](#二免费版极简三角矩阵策略)
- [三、四级用户 Tier × 十路路由降配矩阵](#三四级用户-tier--十路路由降配矩阵)
- [四、config.yaml 用户分层配置方案](#四configyaml-用户分层配置方案)
- [五、ai_router.py Tier 感知路由逻辑](#五ai_routerpy-tier-感知路由逻辑)
- [六、数据库 Schema 扩展](#六数据库-schema-扩展)
- [七、成本估算与风险分析](#七成本估算与风险分析)
- [八、ACTION ITEMS](#八action-items)

---

## 一、设计背景与核心原则

### 1.1 为什么需要用户等级降配？

StudySolo 的工作流特性决定了**一次用户输入会引发多次 API 并发调用**：

```
用户输入 "学习 React Hooks"
    │
    ├─ ai_analyzer（需求分析）     → 1次 API 调用 (~500-1K Token)
    ├─ ai_planner（工作流编排）    → 1次 API 调用 (~1K-2K Token)
    ├─ outline_gen（大纲生成）     → 1次 API 调用 (~1K-3K Token)
    ├─ content_extract ×3（知识提炼）→ 3次 API 调用 (~6K-15K Token)
    ├─ summary（总结归纳）         → 1次 API 调用 (~1K-3K Token)
    └─ merge_polish（润色合并）    → 1次 API 调用 (~3K-8K Token)
    ────────────────────────────
    总计：7-8次 API 调用，~12K-32K Token
```

**如果全部满血配置（DeepSeek-R1, qwen3-max, kimi-k2.5 等）**：

| 场景 | 单次完整运行成本 | 100个免费用户/天 | 月度成本 |
|------|:---:|:---:|:---:|
| 全满血 | ¥0.15 - ¥0.50 | ¥15 - ¥50/天 | **¥450 - ¥1,500** |
| 极简降配 | ¥0.005 - ¥0.02 | ¥0.5 - ¥2/天 | **¥15 - ¥60** |
| **成本降幅** | — | — | **降低 90-96%** |

> **结论**：免费用户绝不能全满血配置，必须在现有的「十路分流架构」之上增加一层**用户等级（User Tier）降配机制**。

### 1.2 四条铁律

1. **好刀用在刃上**：大多数节点用最便宜的模型就能搞定，只在真正需要推理的节点才出动"尖兵"
2. **格式稳定优先**：所有 JSON 输出节点必须走原生平台（百炼 qwen 系列），绝不走聚合代理
3. **降级不降质**：免费用户感知到的功能差异应体现在"深度"和"速度"，而非"可用/不可用"
4. **一切配置驱动**：所有 Tier 配置集中在 `config.yaml`，代码零硬编码

---

## 二、免费版极简三角矩阵策略

> **核心决策**：免费版用户采用"高性价比三角矩阵"——Qwen（干苦活）+ DeepSeek（尖兵推理）+ 工具 API（感知外挂）

### 2.1 三角矩阵架构图

```
                    ┌─────────────────────────────────────┐
                    │     Free Tier 极简三角矩阵           │
                    └──────────────┬──────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
    ╔══════▼══════╗        ╔══════▼══════╗        ╔══════▼══════╗
    ║  🏠 基座层   ║        ║  🧠 尖兵层  ║        ║  🔧 工具层   ║
    ║ 通义千问便宜版║        ║  DeepSeek   ║        ║ 第三方API    ║
    ║ (包揽 80% 任务)║      ║ (仅推理任务) ║        ║ (OCR/搜索)  ║
    ╚═════════════╝        ╚═════════════╝        ╚═════════════╝
    
    承担角色：                承担角色：               承担角色：
    · 意图分类               · 深度大纲生成            · OCR 文档识别
    · JSON 格式输出           · 因果分析推理            · 百度搜索聚合
    · 短文本总结              · 复杂知识提炼            · TTS 朗读
    · 闪卡生成                                        
    · 润色合并                                        
    
    模型选择：                模型选择：               服务选择：
    · qwen-turbo (¥0.0003/K) · deepseek-v3 (¥0.002/K) · 七牛 百度搜索
    · qwen-long (长文本)      · (免费版不给 R1)         · 七牛/智谱 OCR
    · GLM-4-Flash (免费兜底)                           · 百炼 enable_search
```

### 2.2 为什么这个组合是"黄金解法"？

#### (1) 通义千问便宜版本包揽大多数问题

| 优势维度 | 具体说明 |
|---------|---------|
| **格式极度稳定** | `qwen-turbo` 执行 JSON Schema 指令时服从度极高，生成 `{'nodes': [], 'edges': []}` 极少出错 |
| **价格低到发指** | 百炼目前千万级初始免费额度，调用 ¥0.0003/K Token，100万 Token 才花几毛钱 |
| **长文本兜底** | `qwen-long` 可处理几万字文档，成本依然极低 |
| **原生平台稳定** | 阿里云百炼直连，无聚合层污染，SSE 流稳定 |

#### (2) DeepSeek 仅在推理时出动

| 优势维度 | 具体说明 |
|---------|---------|
| **好刀用在刃上** | 生成复杂大纲、深度因果分析时切换 DeepSeek，避免普通模型车轱辘话 |
| **免费版用 V3 即可** | `deepseek-v3`（无思维链）成本仅 ¥0.002/K，足够日常推理 |
| **缓存红利** | 高频同质提问命中缓存时，调用几乎不掏钱 |
| **Pro 版才给 R1** | 带思考时间的 `deepseek-r1` 保留给付费用户 |

#### (3) 工具层为什么单独剥出？

**关键洞察**：智谱原生的"带大模型深度总结"的 Web Search 接口很贵（几分钱/次+大量 Token）。我们的策略：

```
买七牛代理的最便宜百度 API 搜索
    └─ 仅返回骨架数据: [{标题: "xx", 摘要: "xx", 链接: "xx"}]
    └─ 几分钱搜一次

拿到百度摘要 → 塞进 Prompt → 丢给最便宜的 qwen-turbo
    └─ "根据搜索结果写一段总结呈现给用户"
    └─ 成本只有原生高端 Search Agent 的 1/10

OCR 也是同理：
    └─ 七牛/智谱 OCR 接口识别文字
    └─ 识别结果再丢给 qwen-turbo 做结构化
```

### 2.3 唯一风险与防备：DeepSeek 宕机

DeepSeek 高并发期经常排队超时。**必须在路由代码中加死命令**：

```python
# ai_router.py 伪逻辑
async def route_reasoning_task(user_tier: str, prompt: str):
    if user_tier == "free":
        try:
            # 首选 deepseek-v3（免费版不给 R1）
            result = await call_api("deepseek", "deepseek-v3", prompt, timeout=8)
            return result
        except (TimeoutError, ServiceUnavailable):
            # 死命令：立刻降级到百炼满血体验模型
            # 免费用户接受回答没那么深邃，但不能接受红字报错
            return await call_api("dashscope", "qwen-plus", prompt, timeout=15)
```

> **原则**：免费用户可以接受 AI 回答没那么深邃，但绝对受不了点击按钮等半天然后弹红字报错。

---

## 三、四级用户 Tier × 十路路由降配矩阵

> 这是整个降配机制的**核心决策表**，`ai_router.py` 运行时依此表决定模型调用。

### 3.1 完整降配矩阵

| 路由链 | 任务类型 | 🆓 Free | 💎 Pro (¥25/月) | 💠 Pro+ (¥79/月) | 👑 Ultra (¥1299/月) |
|:---|:---|:---|:---|:---|:---|
| **A** | 格式严格 (JSON) | `qwen-turbo` | `qwen3-turbo` | `qwen3-turbo` | `qwen3-max` |
| **B** | 深度推理 (CoT) | `deepseek-v3` | `deepseek-r1` | `deepseek-r1` | `deepseek-r1` + `qwen3-max` 双校验 |
| **C** | 超长文本 (10K+) | `qwen-long` | `kimi-k2.5` | `kimi-k2.5` | `kimi-k2.5` 满血 |
| **D** | 简单快速 (≤500T) | `qwen-turbo` / `GLM-4-Flash` | `qwen-turbo` | `qwen3-turbo` | `qwen3-turbo` |
| **E** | 海外旗舰 | ❌ 不可用 | `gpt-4o` (代理) | `gpt-5.1` (代理) | `gpt-5.1` + `claude-4.x` |
| **F** | 联网搜索 | 百炼 `enable_search` 仅限 | 百度搜索 + qwen 总结 | 智谱 Web Search | 智谱 深度搜索 + Agent |
| **G** | 多模态向量 (RAG) | ❌ 不可用 | `qwen3-vl-embedding` | `qwen3-vl-embedding` | 满血多模态 |
| **H** | 文本向量 + Rerank | 仅摘要层检索 | 摘要+向量层 | 摘要+向量+原文 | 全量+缓存优化 |
| **I** | 专业 OCR | 七牛 基础 OCR | `glm-ocr` | `glm-ocr` + `qwen-vl-ocr` 双引擎 | 满血双引擎 |
| **J** | 增值服务 | ❌ 不可用 | 图片生成 (限量) | 图片+视频+TTS | 全功能无限制 |

### 3.2 关键设计决策说明

#### 免费版：五个"不能"，三个"必须"

**五个不能：**
1. ❌ **不能**调用海外模型（GPT、Claude）
2. ❌ **不能**使用多模态向量化（RAG 图像检索）
3. ❌ **不能**使用增值服务（图片/视频/TTS 生成）
4. ❌ **不能**使用 DeepSeek-R1（带思维链的深度推理）
5. ❌ **不能**使用深度联网搜索（仅百炼自带的简单搜索）

**三个必须：**
1. ✅ **必须**保障 JSON 输出稳定（工作流核心功能不断）
2. ✅ **必须**提供基础推理能力（DeepSeek-V3 即可）
3. ✅ **必须**有降级兜底（任何 API 挂了，都有 fallback）

#### Pro 版：解锁满血的性价比甜点

- 解锁 `deepseek-r1`（真正的深度推理）
- 解锁 `kimi-k2.5`（长文本256K上下文）
- 解锁联网搜索（百度 + qwen 总结模式）
- 解锁基础海外模型（GPT-4o 代理）
- 解锁基础 OCR（智谱 glm-ocr）

#### Pro+ / Ultra：递进解锁旗舰

- Pro+：解锁深度搜索、原文检索、图片视频TTS
- Ultra：全功能无限制，最新旗舰模型优先

### 3.3 容灾降级与 Tier 的交叉

```
免费版 DeepSeek-V3 超时 → 自动降级到百炼 qwen-plus（临时提权）
Pro版 DeepSeek-R1 超时  → 降级到百炼 qwen3-max（用配置好的降级链）
Pro版 Kimi K2.5 超时    → 降级到百炼 qwen-long
海外模型不可用           → 对用户显示 "高端模型暂不可用，已切换至国内模型"
```

---

## 四、config.yaml 用户分层配置方案

### 4.1 新增 `user_tiers` 配置块

在现有 `config.yaml` 的 `task_routing` 之后新增：

```yaml
# ========================================
# 用户等级模型路由降配 (User Tier Routing)
# ========================================

user_tiers:
  free:
    display_name: "免费版"
    daily_execution_limit: 20
    max_workflows: 10
    max_concurrent_runs: 2
    storage_gb: 1
    
    # 覆盖十路路由的模型选择
    model_overrides:
      strict_format:
        primary: { platform: dashscope, model: qwen-turbo }
        fallback: [{ platform: zhipu, model: glm-4-flash }]
      reasoning:
        primary: { platform: deepseek, model: deepseek-chat }  # deepseek-v3
        fallback: [{ platform: dashscope, model: qwen-plus }]
        timeout_ms: 8000  # DS 超时 8 秒就切
      long_context:
        primary: { platform: dashscope, model: qwen-long }
        fallback: [{ platform: dashscope, model: qwen-turbo }]
      simple_fast:
        primary: { platform: dashscope, model: qwen-turbo }
        fallback: [{ platform: zhipu, model: glm-4-flash }]
      overseas_flagship:
        enabled: false
        block_message: "海外旗舰模型仅限 Pro 及以上会员使用"
      web_search:
        primary: { platform: dashscope, model: qwen3.5-flash, params: { enable_search: true } }
        fallback: []
        depth: "basic"  # 仅基础搜索
      multimodal_embed:
        enabled: false
        block_message: "多模态 RAG 仅限 Pro 及以上会员使用"
      text_embedding:
        enabled: true
        search_depth: "summary_only"  # 仅摘要层检索
      document_ocr:
        primary: { platform: qiniu, model: general-ocr }
        fallback: []
      premium_services:
        enabled: false
        block_message: "图片/视频/TTS 生成仅限 Pro 及以上会员使用"

  pro:
    display_name: "Pro版"
    daily_execution_limit: 50
    max_workflows: 50
    max_concurrent_runs: 5
    storage_gb: 3
    
    model_overrides:
      strict_format:
        primary: { platform: dashscope, model: qwen3-turbo }
        fallback: [{ platform: deepseek, model: deepseek-chat }, { platform: volcengine, model: doubao-2.0-pro }]
      reasoning:
        primary: { platform: deepseek, model: deepseek-reasoner }  # deepseek-r1
        fallback: [{ platform: dashscope, model: qwen3-max }, { platform: volcengine, model: deepseek-r1 }]
      long_context:
        primary: { platform: moonshot, model: kimi-k2.5 }
        fallback: [{ platform: dashscope, model: qwen-long }]
      simple_fast:
        primary: { platform: dashscope, model: qwen-turbo }
        fallback: [{ platform: volcengine, model: doubao-seed-2.0-mini }]
      overseas_flagship:
        enabled: true
        primary: { platform: compshare, model: gpt-4o }
        fallback: [{ platform: qiniu, model: gpt-4o }]
      web_search:
        primary: { platform: qiniu, service: baidu-search }
        summarizer: { platform: dashscope, model: qwen-turbo }
        fallback: [{ platform: dashscope, model: qwen3.5-flash, params: { enable_search: true } }]
        depth: "general"
      multimodal_embed:
        enabled: true
        primary: { platform: dashscope, model: qwen3-vl-embedding }
      text_embedding:
        enabled: true
        search_depth: "summary_and_vector"
      document_ocr:
        primary: { platform: zhipu, model: glm-ocr }
        fallback: [{ platform: dashscope, model: qwen-vl-ocr }]
      premium_services:
        enabled: true
        daily_limit: { image: 10, video: 0, tts: 20 }

  pro_plus:
    display_name: "Pro+版"
    daily_execution_limit: 150
    max_workflows: 200
    max_concurrent_runs: 10
    storage_gb: 10
    
    model_overrides:
      strict_format:
        primary: { platform: dashscope, model: qwen3-turbo }
        fallback: [{ platform: deepseek, model: deepseek-chat }, { platform: volcengine, model: doubao-2.0-pro }]
      reasoning:
        primary: { platform: deepseek, model: deepseek-reasoner }
        fallback: [{ platform: dashscope, model: qwen3-max }]
      long_context:
        primary: { platform: moonshot, model: kimi-k2.5 }
        fallback: [{ platform: dashscope, model: qwen-long }]
      simple_fast:
        primary: { platform: dashscope, model: qwen3-turbo }
        fallback: [{ platform: volcengine, model: doubao-seed-2.0-mini }]
      overseas_flagship:
        enabled: true
        primary: { platform: compshare, model: gpt-5.1 }
        fallback: [{ platform: qiniu, model: gpt-4o }]
      web_search:
        primary: { platform: zhipu, service: web-search-pro }
        fallback: [{ platform: qiniu, service: baidu-search }]
        depth: "deep"
      multimodal_embed:
        enabled: true
        primary: { platform: dashscope, model: qwen3-vl-embedding }
      text_embedding:
        enabled: true
        search_depth: "full"  # 摘要+向量+原文
      document_ocr:
        primary: { platform: zhipu, model: glm-ocr }
        fallback: [{ platform: dashscope, model: qwen-vl-ocr }]
      premium_services:
        enabled: true
        daily_limit: { image: 50, video: 5, tts: 100 }

  ultra:
    display_name: "Ultra版"
    daily_execution_limit: 500
    max_workflows: -1  # 无限制
    max_concurrent_runs: 100
    storage_gb: 100
    
    model_overrides:
      # Ultra 不做降配，使用默认的十路满血路由
      use_default_routing: true
      overseas_flagship:
        enabled: true
        primary: { platform: compshare, model: gpt-5.1 }
        secondary: { platform: compshare, model: claude-4-sonnet }
      premium_services:
        enabled: true
        daily_limit: { image: -1, video: 50, tts: -1 }  # -1 = 无限制
```

### 4.2 配置加载链路升级

```
config.yaml
    │
    ├── platform_tiers    (八大平台基础配置 — 已有)
    ├── task_routing       (十路任务分流 — 已有)
    └── user_tiers         (用户等级降配 — 新增)
           │
    config_loader.py
           │
           ├── get_tier_config(user_tier: str) → TierConfig
           ├── resolve_model(task_type: str, user_tier: str) → ModelConfig
           └── is_feature_enabled(feature: str, user_tier: str) → bool
           │
    ai_router.py
           │
           └── route(task_type, user_tier, prompt) → API Response
```

---

## 五、ai_router.py Tier 感知路由逻辑

### 5.1 核心路由函数伪代码

```python
# backend/app/services/ai_router.py

from app.core.config_loader import get_config

class TierAwareRouter:
    """用户等级感知的 AI 路由器"""
    
    def __init__(self):
        self.config = get_config()
    
    async def route(
        self, 
        task_type: str,       # "strict_format" | "reasoning" | "long_context" | ...
        user_tier: str,       # "free" | "pro" | "pro_plus" | "ultra"
        prompt: str,
        system_prompt: str = "",
        **kwargs
    ) -> AsyncIterator[str]:
        """根据任务类型和用户等级，选择最优模型并调用"""
        
        # 1. 获取该 Tier 的路由配置
        tier_config = self.config.user_tiers[user_tier]
        route_config = tier_config.model_overrides.get(task_type)
        
        # 2. 检查功能是否对该 Tier 开放
        if route_config and not route_config.get("enabled", True):
            raise FeatureNotAvailableError(
                message=route_config.get("block_message", "此功能需要升级会员"),
                upgrade_url="/pricing"
            )
        
        # 3. Ultra 版直接走默认满血路由
        if route_config and route_config.get("use_default_routing"):
            route_config = self.config.task_routing[task_type]
        
        # 4. 构建调用链（主选 + 降级）
        primary = route_config["primary"]
        fallbacks = route_config.get("fallback", [])
        timeout_ms = route_config.get("timeout_ms", 15000)
        
        # 5. 尝试主选模型
        try:
            async for token in self._call_model(
                platform=primary["platform"],
                model=primary["model"],
                prompt=prompt,
                system_prompt=system_prompt,
                timeout=timeout_ms / 1000,
                params=primary.get("params", {}),
                **kwargs
            ):
                yield token
            return
        except (TimeoutError, APIError) as e:
            logger.warning(f"Primary model failed for {task_type}/{user_tier}: {e}")
        
        # 6. 逐级降级
        for fb in fallbacks:
            try:
                async for token in self._call_model(
                    platform=fb["platform"],
                    model=fb["model"],
                    prompt=prompt,
                    system_prompt=system_prompt,
                    timeout=15,
                    params=fb.get("params", {}),
                    **kwargs
                ):
                    yield token
                return
            except (TimeoutError, APIError) as e:
                logger.warning(f"Fallback {fb['model']} failed: {e}")
                continue
        
        # 7. 全链路失败
        raise AllModelsFailedError(
            message="AI 服务暂时繁忙，请稍后重试",
            task_type=task_type,
            user_tier=user_tier
        )
```

### 5.2 用量配额中间件

```python
# backend/app/middleware/quota.py

from app.core.config_loader import get_config
from app.core.database import supabase

async def check_user_quota(user_id: str, user_tier: str) -> QuotaStatus:
    """检查用户今日剩余配额"""
    
    tier_config = get_config().user_tiers[user_tier]
    daily_limit = tier_config["daily_execution_limit"]
    
    # 查询今日已使用次数
    today = datetime.now(timezone.utc).date()
    result = await supabase.table("workflow_runs") \
        .select("count", count="exact") \
        .eq("user_id", user_id) \
        .gte("started_at", today.isoformat()) \
        .execute()
    
    used = result.count
    remaining = daily_limit - used
    
    if remaining <= 0:
        raise QuotaExceededError(
            message=f"今日执行次数已达上限（{daily_limit}次）",
            upgrade_url="/pricing",
            reset_time="明日 00:00 (UTC+8)"
        )
    
    return QuotaStatus(used=used, remaining=remaining, limit=daily_limit)
```

### 5.3 前端 Tier 感知（API 响应头）

后端在所有 AI 相关的 API 响应中附加用量信息：

```python
# SSE 响应头
headers = {
    "X-User-Tier": "free",
    "X-Daily-Remaining": "17",
    "X-Daily-Limit": "20",
    "X-Model-Used": "qwen-turbo",  # 告诉前端实际用了什么模型
}
```

前端据此在画布上显示：

```
⚡ 今日剩余: 17/20 次  |  当前模型: qwen-turbo  |  🔒 升级至 Pro 解锁满血模型
```

---

## 六、数据库 Schema 扩展

### 6.1 user_profiles 表扩展

```sql
-- 在现有的共享业务表 user_profiles 中新增用户等级和配额字段
ALTER TABLE user_profiles ADD COLUMN tier TEXT DEFAULT 'free' 
    CHECK (tier IN ('free', 'pro', 'pro_plus', 'ultra'));
ALTER TABLE user_profiles ADD COLUMN tier_expires_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN is_student_verified BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN student_verified_at TIMESTAMPTZ;
```

### 6.2 新建 user_usage_daily 表

```sql
-- 用户每日用量统计
CREATE TABLE user_usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- 执行次数
    execution_count INTEGER DEFAULT 0,
    
    -- Token 消耗统计
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    
    -- 分平台 Token 统计（JSONB 动态扩展）
    platform_usage JSONB DEFAULT '{}'::jsonb,
    -- 例: {"dashscope": {"tokens": 15000, "calls": 8}, "deepseek": {"tokens": 3000, "calls": 2}}
    
    -- 增值服务用量
    image_gen_count INTEGER DEFAULT 0,
    video_gen_count INTEGER DEFAULT 0,
    tts_count INTEGER DEFAULT 0,
    ocr_count INTEGER DEFAULT 0,
    search_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, usage_date)
);

-- 索引
CREATE INDEX idx_usage_daily_user_date ON user_usage_daily(user_id, usage_date);

-- RLS
ALTER TABLE user_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_usage" ON user_usage_daily
    FOR ALL USING (auth.uid() = user_id);
```

### 6.3 新建 tier_change_log 表

```sql
-- 用户等级变更日志（审计用）
CREATE TABLE tier_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    from_tier TEXT NOT NULL,
    to_tier TEXT NOT NULL,
    reason TEXT,  -- 'subscription', 'expired', 'admin_override', 'student_verified'
    triggered_by TEXT,  -- 'system', 'admin:xxx', 'payment:stripe'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tier_change_user ON tier_change_log(user_id, created_at DESC);
```

---

## 七、成本估算与风险分析

### 7.1 免费版单次运行成本明细

| 节点 | 路由链 | 模型 | Token 估算 | 成本 (¥) |
|------|:---:|:---|:---:|:---:|
| `ai_analyzer` | A | `qwen-turbo` | ~750 | 0.000225 |
| `ai_planner` | A | `qwen-turbo` | ~1,500 | 0.00045 |
| `outline_gen` | B | `deepseek-v3` | ~2,000 | 0.004 |
| `content_extract` ×3 | B | `deepseek-v3` | ~9,000 | 0.018 |
| `summary` | D | `qwen-turbo` | ~1,500 | 0.00045 |
| `merge_polish` | C | `qwen-long` | ~5,000 | 0.002 |
| **总计** | — | — | **~19,750** | **~¥0.025** |

> ✅ **比满血方案便宜 10-20 倍**！100 个免费用户每天跑一次，月成本仅 ¥75。

### 7.2 各 Tier 月度成本预估

| Tier | 活跃用户数 | 每人日均运行 | 单次成本 | 月成本 |
|:---|:---:|:---:|:---:|:---:|
| Free | 500 人 | 1.5 次 | ¥0.025 | **¥562** |
| Pro | 100 人 | 3 次 | ¥0.15 | **¥1,350** |
| Pro+ | 30 人 | 5 次 | ¥0.30 | **¥1,350** |
| Ultra | 5 人 | 10 次 | ¥0.50 | **¥750** |
| **总计** | — | — | — | **¥4,012** |

> 与 Pro 的 100 人 × ¥25/月 = ¥2,500 收入对比，API 成本占比约 54%。需要通过 Pro+/Ultra 的高利润拉升整体毛利。

### 7.3 风险清单

| 风险 | 概率 | 影响 | 应对 |
|------|:---:|:---:|------|
| DeepSeek 高峰期宕机 | 高 | 免费版推理降级 | 8秒超时硬切百炼 qwen-plus |
| 百炼免费额度用尽 | 低 | 基座层成本上升 | 监控警报 + 切换硅基流动 qwen 分流 |
| 免费用户刷量 | 中 | 成本暴涨 | 日限 20 次 + IP 频率限制 + 验证码 |
| Tier 判断延迟 | 低 | 路由决策变慢 | JWT 中 claim 内嵌 tier，无需查库 |

---

## 八、ACTION ITEMS

| 优先级 | 任务 | 涉及文件 | 依赖 |
|:---|:---|:---|:---|
| **P0** | `config.yaml` 新增 `user_tiers` 配置块 | `config.yaml` | 无 |
| **P0** | `config_loader.py` 新增 `get_tier_config()` 方法 | `backend/app/core/config_loader.py` | config.yaml |
| **P0** | `ai_router.py` 重构为 Tier 感知路由 | `backend/app/services/ai_router.py` | config_loader |
| **P0** | 数据库新增 `user_usage_daily` 表 | Supabase SQL | 无 |
| **P0** | `users` 表新增 `tier` 字段 | Supabase SQL | 无 |
| **P1** | 用量配额检查中间件 | `backend/app/middleware/quota.py` | user_usage_daily |
| **P1** | JWT Claim 中嵌入 `tier` 字段 | `backend/app/middleware/auth.py` | users.tier |
| **P1** | 前端 Tier 感知 UI（升级提示 + 配额显示） | `frontend/src/components/` | API 响应头 |
| **P2** | `tier_change_log` 审计日志 | Supabase SQL | 无 |
| **P2** | 管理后台 Tier 概览看板 | `frontend/src/app/(admin)/` | tier_change_log |

---

> **一句话总结**：免费版采用「Qwen 干苦活 + DeepSeek-V3 当尖兵 + 七牛工具外挂」的极简三角策略，单次运行成本压至 ¥0.025；付费版逐级解锁满血模型、海外旗舰、深度搜索和增值服务。所有配置集中在 `config.yaml` 的 `user_tiers` 块中，代码零硬编码。
