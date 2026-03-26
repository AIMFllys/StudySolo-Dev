# StudySolo 六平台 API 分类与路由终极方案

> 📅 分析日期：2026-02-26
> 📌 定位：取代旧版"四平台路由策略"，升级为 **三原生主战 + 三代理辅助** 的六平台终极架构
> 🔗 前置文档：[多平台AI-API统一路由与容灾规划](../../docs/Plans/global/多平台AI-API统一路由与容灾规划.md)

---

## 一、核心架构革新：从"四平台线性路由"到"六平台双层分治"

### 1.1 旧方案的致命缺陷

旧方案按 `七牛云 > 优云智算 > 火山引擎 > 阿里云百炼` 线性优先级路由，存在以下问题：

| 问题 | 后果 |
| :--- | :--- |
| 所有请求优先走聚合平台（七牛/优云） | 聚合平台可能注入隐形 System Prompt，污染角色认知和结构化输出 |
| 未区分"格式严格任务"与"灵活对话任务" | JSON 输出被代理层的安全护栏破坏，后端解析失败 |
| 缺少原生平台直连通道 | 无法享受上下文缓存(Context Caching)低价、无法获得满血推理性能 |
| 原生厂商（DeepSeek/Moonshot/智谱）未纳入 | 3家顶级国产原生 API 被白白浪费 |

### 1.2 新方案：双层分治架构

```
                          ┌─────────────────────────────────────────┐
                          │        StudySolo AI 路由引擎 v2          │
                          │     (ai_router.py · 任务分类驱动)        │
                          └──────────────┬──────────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
   ═══════════▼══════════════  ═══════════▼══════════════  ═══════════▼══════════════
   ║  🏠 第一层：原生直连层  ║  ║  🌐 第二层：代理聚合层  ║  ║  🔧 第三层：增值服务层  ║
   ║  (纯净 · 满血 · 低价)  ║  ║  (海外 · 聚合 · 灾备)  ║  ║  (独占功能 · 无替代)   ║
   ═══════════════════════════  ═══════════════════════════  ═══════════════════════════
   │                          │                               │
   ├── 阿里云百炼 (Qwen原生)   ├── 七牛云 (模型聚合+增值)       ├── 七牛云 全网搜索
   ├── DeepSeek官方 (DS原生)   ├── 优云智算 (海外旗舰专线)      ├── 七牛云 图片生成
   ├── Moonshot官方 (Kimi原生)  └── 硅基流动 (开源加速池)       ├── 七牛云 视频生成
   ├── 火山引擎 (豆包原生)                                     └── 七牛云 TTS语音
   └── 智谱AI (GLM原生)
```

---

## 二、八大平台身份证

### 2.1 第一层：原生直连平台（5家）

> **原生直连 = 模型开发商的官方 API 入口。无中间商、无提示词注入、支持全参数控制、享受上下文缓存折扣。**

| # | 平台 | 原生模型 | Base URL | 环境变量 | 核心优势 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **阿里云百炼** | Qwen 全系列 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` | 速度天花板，Qwen 原生宿主，延迟最低 |
| 2 | **DeepSeek 官方** | DeepSeek-V3/R1/V4 | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` | 推理之王，缓存命中仅 0.5元/M，夜间更便宜 |
| 3 | **月之暗面 (Moonshot)** | Kimi K2/K2.5 | `https://api.moonshot.cn/v1` | `MOONSHOT_API_KEY` | 256K超长上下文，自动缓存命中 0.7元/M |
| 4 | **火山引擎** | 豆包 Doubao 全系列 | `https://ark.cn-beijing.volces.com/api/v3` | `VOLCENGINE_API_KEY` | 每日200万Token免费池，万能兜底 |
| 5 | **智谱AI** | GLM-4/GLM-5 | `https://open.bigmodel.cn/api/paas/v4` | `ZHIPU_API_KEY` | 中文理解力顶尖，对话风格自然 |

### 2.2 第二层：代理聚合平台（3家）

> **代理聚合 = 一个 API Key 调用多家模型，但可能存在隐形提示词注入、无法享受上下文缓存。**

| # | 平台 | 聚合模型范围 | Base URL | 环境变量 | 核心优势 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 6 | **七牛云 AIGC** | 50+ 国内外模型 | `https://api.qnaigc.com/v1` | `QINIU_AI_API_KEY` | 300万免费Token + 搜索/OCR/图片等独占增值 |
| 7 | **优云智算** | GPT-5.x/Claude-4.x/DS/Kimi | `https://api.compshare.cn/v1` | `COMPSHARE_API_KEY` | 海外最新旗舰模型独占（GPT-5.1/Claude-4.5） |
| 8 | **硅基流动** | 全部主流开源模型 | `https://api.siliconflow.cn/v1` | `SILICONFLOW_API_KEY` | 自研加速引擎，DeepSeek/Qwen跑得比官方还快 |

---

## 三、按任务类型的十路分流

> **核心规则 1：要求格式严格（JSON/结构化输出）的任务，必须走原生平台；灵活对话类任务可以走聚合平台。**
>
> **核心规则 2（新增）：工作流中所有节点默认使用各家AI的原生服务。聚合平台仅用于海外模型调用和灾备降级。**

### 3.1 路由链 A：格式严格任务（JSON输出/结构化数据/工作流编排）

**特征**：System Prompt 要求 AI 只输出 JSON / 固定格式，任何额外文字都会导致代码解析失败。

| 优先级 | 平台 | 模型 | 层级 | 理由 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **阿里云百炼** | `qwen3-turbo` | 原生 | 速度最快 + 零提示词污染 + Qwen 格式遵循力极强 |
| **2** | **DeepSeek 官方** | `deepseek-v3` | 原生 | 格式遵循力优秀 + 缓存命中价格极低 |
| **3** | **火山引擎** | `doubao-2.0-pro` | 原生 | 免费池兜底，豆包格式遵循也不错 |

**绝不使用聚合平台**：代理层可能注入安全护栏导致 JSON 结构被破坏。

**典型场景**：
- 需求分析器 (`ai_analyzer`) - 输出 JSON 结构化需求
- 闪卡生成器 (`flashcard`) - 输出严格的卡片 JSON 数组
- 意图分类器 - 输出 `{"intent": "xxx", "confidence": 0.95}`
- 工作流编排器 (`ai_planner`) - 输出节点拓扑 JSON

---

### 3.2 路由链 B：深度推理任务（大纲生成/知识提炼/长文分析）

**特征**：需要模型"慢思考"（Chain of Thought），输出质量 > 速度，格式灵活。

| 优先级 | 平台 | 模型 | 层级 | 理由 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **DeepSeek 官方** | `deepseek-r1` | 原生 | 满血推理模式 + 缓存命中 1元/M + 无提示词干扰 |
| **2** | **阿里云百炼** | `qwen3-max` | 原生 | Qwen 旗舰推理力 + 原生部署 |
| **3** | **火山引擎** | `deepseek-r1` | 原生 | 火山也部署了 DS-R1，走免费池 |
| **4** | **七牛云** | `deepseek-r1` | 聚合 | 终极灾备（消耗免费额度） |

**典型场景**：
- 大纲生成 (`outline_gen`)
- 知识深度提炼 (`content_extract`)
- 多源综合归纳 (`summary`)
- 论文/文献分析

---

### 3.3 路由链 C：超长文本任务（全书提炼/多文件合并/润色）

**特征**：输入 Token 量巨大（10K-200K），需要模型拥有超长上下文窗口和强注意力。

| 优先级 | 平台 | 模型 | 层级 | 理由 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Moonshot 官方** | `kimi-k2.5` | 原生 | 256K上下文 + 自动缓存命中仅 0.7元/M + 中文长文本注意力顶流 |
| **2** | **阿里云百炼** | `qwen-long` | 原生 | Qwen 长文本版本，128K 上下文 |
| **3** | **七牛云** | `kimi` | 聚合 | 灾备（但在七牛走 Kimi 会丧失缓存优势） |

**典型场景**：
- 润色合并 (`merge_polish`) - 多文件合并为一篇长文
- 全书/全课提炼 - 一本教科书扔进去出大纲
- 历史对话总结 - 用户累计几十轮对话的总结

---

### 3.4 路由链 D：简单快速任务（意图识别/短文分类/轻量问答）

**特征**：Token 消耗极低（100-500），对速度要求极高，对质量要求不高。

| 优先级 | 平台 | 模型 | 层级 | 理由 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **阿里云百炼** | `qwen-turbo` | 原生 | 延迟最低 + 入价仅 0.0003元/K + 极速响应 |
| **2** | **火山引擎** | `doubao-seed-2.0-mini` | 原生 | 200W/日免费池 + 入价 0.0002元/K |
| **3** | **七牛云** | `qwen-turbo` | 聚合 | 终极灾备 |

**典型场景**：
- 用户输入意图分类
- 短文情感分析
- 关键词提取
- 简单问答

---

### 3.5 路由链 E：海外旗舰模型（Pro/Ultra 用户专属）

**特征**：用户需要 GPT-5.x / Claude-4.x 等海外顶级模型。

| 优先级 | 平台 | 模型 | 层级 | 理由 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **优云智算** | `gpt-5.1` / `claude-sonnet-4-5` | 聚合 | 最新版海外模型独占 |
| **2** | **七牛云** | `gpt-4o` / `claude-3-5-sonnet` | 聚合 | 版本可能略旧但稳定 |

> 海外模型只能走聚合平台，无国内原生直连选项。

**典型场景**：
- Pro/Ultra 付费用户的高端体验
- 对英文输出质量有极高要求的场景

---

### 3.6 路由链 F：联网搜索（三级分流）

**特征**：根据搜索深度和场景，分为深度/一般/普通三个等级。

| 等级 | 场景 | 平台 | 服务/模型 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **深度联网搜索** | 工作流中需要深度调研的节点 | **智谱AI** (原生) | Web Search API + Search Agent | 意图识别增强、结构化结果（标题/URL/摘要）、兼容搜狗/夸克引擎 |
| **一般联网搜索** | 工作流中需要快速检索的节点 | **七牛云** (代理) | Baidu Search API | 百度搜索结果聚合，适合快速获取常规信息 |
| **普通联网搜索** | 单独AI对话时的默认搜索 | **阿里云百炼** (原生) | `qwen3.5-flash` + `enable_search: true` | AI原生联网能力，通过 `extra_body` 参数启用，零额外接口成本 |

**路由规则**：
- 工作流节点中标记 `search_depth: deep` 的走智谱深度搜索
- 工作流节点中标记 `search_depth: general` 的走七牛云百度搜索
- 单独AI对话（非工作流）默认走百炼 `qwen3.5-flash` 的内置联网搜索

**降级路径**：
```
深度搜索（智谱）挂了 -> 降级为一般搜索（七牛百度）
一般搜索（七牛）挂了 -> 降级为普通搜索（百炼enable_search）
普通搜索（百炼）挂了 -> 禁用联网搜索，仅用离线知识回答
```

---

### 3.7 路由链 G：多模态向量（图文/视频向量化，RAG多模态检索）

**特征**：将图片、视频、文本统一转换为向量，支持跨模态检索。RAG 系统的核心基础设施。

| 优先级 | 平台 | 模型 | 说明 |
| :--- | :--- | :--- | :--- |
| **1** | **阿里云百炼** (原生) | `qwen3-vl-embedding` | 基于 Qwen3-VL 构建，支持文本/图片/视频/截图等任意组合输入，向量维度可选 256-2560，支持 32K 上下文，MMEB-V2 基准领先，支持 30+ 语言 |
| **2** | **阿里云百炼** (原生) | `tongyi-embedding-vision-flash` | 轻量级多模态向量模型，支持文本/图片/多图输入，向量维度 64-768，价格更低（图片 0.03$/M） |

**选型建议**：
- 高精度场景（论文图表检索、复杂视频理解）→ 用 `qwen3-vl-embedding`
- 大批量/低成本场景（海量图片分类、粗粒度检索）→ 用 `tongyi-embedding-vision-flash`

---

### 3.8 路由链 H：文本向量与重排序（RAG文本检索核心）

**特征**：纯文本的向量化和搜索结果重排序，知识库 RAG 的基础管线。

| 功能 | 平台 | 模型 | 说明 |
| :--- | :--- | :--- | :--- |
| **文本向量化** | **阿里云百炼** (原生) | `text-embedding-v4` | 最新一代文本向量模型，替代旧版 v3，精度更高，维度更灵活 |
| **重排序 (Rerank)** | **阿里云百炼** (原生) | `qwen3-vl-rerank` | 对检索结果进行二次精排，大幅提升 RAG 系统的准确率，支持多模态输入（文本+图片查询） |

**RAG 管线完整链路**：
```
用户查询 -> 文本向量化(text-embedding-v4) -> 向量数据库检索(pgvector)
         -> 取 Top-K 结果 -> 重排序(qwen3-vl-rerank) -> 取 Top-N 精排结果
         -> 注入 System Prompt -> LLM 生成最终回答
```

---

### 3.9 路由链 I：图文文档识别（OCR专用）

**特征**：专门用于从图片、PDF等非结构化文档中高精度提取文字、复杂表格、手写体、公式，并可直接输出结构化 JSON 或 HTML。

| 优先级 | 平台 | 模型 | 说明 |
| :--- | :--- | :--- | :--- |
| **1** | **智谱AI** (原生) | `glm-ocr` | 26年初最新开源的专业级多模态OCR大模型，在OmniDocBench霸榜，复杂表格和版面分析极强，API价格低至 ¥0.2/M Tokens |
| **2** | **阿里云百炼** (原生) | `qwen-vl-ocr` | 专用于视觉文字抽取的 Qwen3 原生模型，非常擅长票据、古籍混合排版识别 |

**注意**：OCR 服务已由纯代理转为 **原生双引擎驱动**，大大提高了复杂文件的解析质量。

---

### 3.10 路由链 J：其他增值服务（图片/视频/TTS 等独占服务）

**特征**：图像渲染、视频生成、声音克隆等无法通过大语言模型本身解决的能力。

| 服务 | 唯一平台 | 降级策略 |
| :--- | :--- | :--- |
| 图片生成 (Kling) | **七牛云** | 无替代，前端提示"生图暂不可用" |
| 视频生成 (Kling) | **七牛云** | 无替代，前端提示"生视频暂不可用" |
| 语音合成 (TTS) | **七牛云** | 无替代，前端提示"语音暂不可用" |

---

## 四、为什么必须区分原生和代理？

### 4.1 System Prompt 污染对比

| 维度 | 原生平台（百炼/DeepSeek/Moonshot） | 聚合代理（七牛云/优云智算） |
| :--- | :--- | :--- |
| **你发出的 System Prompt** | AI 看到的 = 你发出的 | AI 看到的 = 你的 + 代理平台偷塞的安全指令 |
| **角色扮演稳定性** | 100% 听你的 | 可能被安全指令覆盖 |
| **JSON 输出可靠性** | 严格按要求输出纯 JSON | 可能在 JSON 前后加上额外文字 |
| **上下文缓存** | 支持，命中后价格骤降 50-80% | 通常不支持，全价计费 |
| **推理满血度** | 原厂参数，无阉割 | 部分平台可能降低采样参数以节省算力 |

### 4.2 价格对比（以 DeepSeek-R1 为例，每百万 Token）

| 计费项 | DeepSeek 官方原生 | 七牛云聚合 | 火山引擎原生 |
| :--- | :--- | :--- | :--- |
| **输入（缓存命中）** | **1元** | 无缓存机制 | 免费池内 0元 |
| **输入（缓存未命中）** | 4元 | 4元 | 免费池内 0元 |
| **输出** | 16元 | 16元 | 免费池内 0元 |
| **夜间优惠 (00:30-08:30)** | 有 2.5折 | 无 | 不适用 |

> **结论**：对于高频调用、格式敏感的生产场景，**原生平台的综合成本可能只有聚合平台的 1/3 到 1/5**（得益于缓存命中和夜间优惠）。

---

## 五、容灾降级全景图 v2

### 5.1 六路降级总表

| 路由链 | 正常通道 | Level 1 降级 | Level 2 降级 | Level 3 极端 |
| :--- | :--- | :--- | :--- | :--- |
| **A. 格式严格** | 百炼 `qwen3-turbo` | DeepSeek `deepseek-v3` | 火山 `doubao-2.0-pro` | 友好错误页 |
| **B. 深度推理** | DeepSeek `deepseek-r1` | 百炼 `qwen3-max` | 火山 `deepseek-r1` 然后 七牛云 | 友好错误页 |
| **C. 超长文本** | Moonshot `kimi-k2.5` | 百炼 `qwen-long` | 七牛云 `kimi` | 友好错误页 |
| **D. 简单快速** | 百炼 `qwen-turbo` | 火山 `doubao-mini` | 七牛云 `qwen-turbo` | 友好错误页 |
| **E. 海外旗舰** | 优云 `gpt-5.1` | 七牛云 `gpt-4o` | 无 | "高端模型暂不可用" |
| **F. 深度搜索** | 智谱 Web Search | 七牛 百度搜索 | 百炼 enable_search | 禁用联网搜索 |
| **G. 多模态向量** | 百炼 `qwen3-vl-embedding` | 百炼 `tongyi-vision-flash` | 无 | "向量化暂不可用" |
| **H. 文本向量** | 百炼 `text-embedding-v4` | 无 | 无 | "检索暂不可用" |
| **I. 专业 OCR** | 智谱 `glm-ocr` | 百炼 `qwen-vl-ocr` | 七牛云 OCR | "文档解析失败" |
| **J. 增值服务** | 七牛云独占 | 无 | 无 | "功能暂时不可用" |

### 5.2 跨链路紧急降级

当某条链路所有平台全部宕掉时，可以跨链路借模型：

```
格式严格链全挂 -> 借用 深度推理链 的 DeepSeek-R1（R1 也能输出 JSON）
深度推理链全挂 -> 借用 格式严格链 的 Qwen3-Turbo（Turbo 也能做推理，只是慢一点）
超长文本链全挂 -> 借用 深度推理链 的 DeepSeek-R1（R1 有 128K 上下文）
简单快速链全挂 -> 借用 格式严格链 的 Qwen3-Turbo
```

---

## 六、环境变量完整版（.env 模板）

```env
# ============================================
# StudySolo 后端环境变量（六平台完整版 v2）
# 绝不提交到 Git！
# ============================================

# === 原生直连平台 ===
DASHSCOPE_API_KEY=       # 阿里云百炼 (Qwen原生) — https://bailian.console.aliyun.com
DEEPSEEK_API_KEY=        # DeepSeek官方 — https://platform.deepseek.com
MOONSHOT_API_KEY=        # 月之暗面Kimi — https://platform.moonshot.cn
VOLCENGINE_API_KEY=      # 火山引擎(豆包原生) — https://console.volcengine.com/ark
ZHIPU_API_KEY=           # 智谱AI(GLM原生) — https://open.bigmodel.cn

# === 代理聚合平台 ===
QINIU_AI_API_KEY=        # 七牛云AIGC — https://portal.qiniu.com
COMPSHARE_API_KEY=       # 优云智算 — https://www.compshare.cn
SILICONFLOW_API_KEY=     # 硅基流动 — https://cloud.siliconflow.cn
```

---

## 七、config.yaml 路由配置 v2（关键片段）

```yaml
# ==================== 平台层级定义 ====================
platform_tiers:
  native:
    - id: dashscope
      display_name: 阿里云百炼
      base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
      api_key: $DASHSCOPE_API_KEY
      native_models: [qwen-turbo, qwen3-turbo, qwen3-plus, qwen3-max, qwen-long, text-embedding-v3, text-embedding-v4, qwen3-vl-embedding, tongyi-embedding-vision-flash, qwen3-vl-rerank, qwen-vl-ocr]
    - id: deepseek
      display_name: DeepSeek官方
      base_url: https://api.deepseek.com/v1
      api_key: $DEEPSEEK_API_KEY
      native_models: [deepseek-chat, deepseek-reasoner]
    - id: moonshot
      display_name: 月之暗面Kimi
      base_url: https://api.moonshot.cn/v1
      api_key: $MOONSHOT_API_KEY
      native_models: [kimi-k2.5, kimi-k2-0905-preview, moonshot-v1-128k]
    - id: volcengine
      display_name: 火山引擎
      base_url: https://ark.cn-beijing.volces.com/api/v3
      api_key: $VOLCENGINE_API_KEY
      native_models: [doubao-2.0-pro, doubao-seed-2.0-mini, doubao-seed-1.6]
      free_tier: 2000000
    - id: zhipu
      display_name: 智谱AI
      base_url: https://open.bigmodel.cn/api/paas/v4
      api_key: $ZHIPU_API_KEY
      native_models: [glm-4, glm-5, web-search-pro, glm-ocr]

  proxy:
    - id: qiniu
      display_name: 七牛云AIGC
      base_url: https://api.qnaigc.com/v1
      api_key: $QINIU_AI_API_KEY
      free_tier: 3000000
    - id: compshare
      display_name: 优云智算
      base_url: https://api.compshare.cn/v1
      api_key: $COMPSHARE_API_KEY
    - id: siliconflow
      display_name: 硅基流动
      base_url: https://api.siliconflow.cn/v1
      api_key: $SILICONFLOW_API_KEY

# ==================== 任务分类路由 v2 ====================
task_routing:

  strict_format:
    description: "要求严格JSON/结构化输出的任务，必须走原生平台"
    chain:
      - { platform: dashscope, model: qwen3-turbo, tier: native }
      - { platform: deepseek, model: deepseek-chat, tier: native }
      - { platform: volcengine, model: doubao-2.0-pro, tier: native }
    cross_fallback: reasoning

  reasoning:
    description: "需要慢思考/深度推理的任务"
    chain:
      - { platform: deepseek, model: deepseek-reasoner, tier: native }
      - { platform: dashscope, model: qwen3-max, tier: native }
      - { platform: volcengine, model: deepseek-r1, tier: native }
      - { platform: qiniu, model: deepseek-r1, tier: proxy }
    cross_fallback: strict_format

  long_context:
    description: "超长输入(10K-200K Token)的文本处理"
    chain:
      - { platform: moonshot, model: kimi-k2.5, tier: native }
      - { platform: dashscope, model: qwen-long, tier: native }
      - { platform: qiniu, model: kimi, tier: proxy }
    cross_fallback: reasoning

  simple_fast:
    description: "轻量级、低Token、高速响应的简单任务"
    chain:
      - { platform: dashscope, model: qwen-turbo, tier: native }
      - { platform: volcengine, model: doubao-seed-2.0-mini, tier: native }
      - { platform: qiniu, model: qwen-turbo, tier: proxy }
    cross_fallback: strict_format

  premium_overseas:
    description: "海外顶级模型，仅付费用户可用"
    tier_required: pro
    chain:
      - { platform: compshare, model: gpt-5.1, tier: proxy }
      - { platform: qiniu, model: gpt-4o, tier: proxy }

  # 🔍 F. 联网搜索（三级分流）
  deep_search:
    description: "深度联网搜索（工作流调研节点）"
    chain:
      - { platform: zhipu, model: web-search-pro, tier: native }
      - { platform: qiniu, model: baidu-search, tier: proxy }
      - { platform: dashscope, model: qwen3.5-flash, tier: native, params: { enable_search: true } }

  general_search:
    description: "一般联网搜索（工作流普通节点）"
    chain:
      - { platform: qiniu, model: baidu-search, tier: proxy }
      - { platform: dashscope, model: qwen3.5-flash, tier: native, params: { enable_search: true } }

  normal_search:
    description: "普通联网搜索（单独AI对话默认）"
    chain:
      - { platform: dashscope, model: qwen3.5-flash, tier: native, params: { enable_search: true } }

  # 🖼️ G. 多模态向量
  multimodal_embedding:
    description: "图文/视频多模态向量化，RAG多模态检索"
    chain:
      - { platform: dashscope, model: qwen3-vl-embedding, tier: native }
      - { platform: dashscope, model: tongyi-embedding-vision-flash, tier: native }
    no_fallback: true

  # 📐 H. 文本向量与重排序
  text_embedding:
    description: "纯文本向量化，RAG文本检索核心"
    chain:
      - { platform: dashscope, model: text-embedding-v4, tier: native }
    no_fallback: true

  text_rerank:
    description: "检索结果重排序，提升RAG准确率"
    chain:
      - { platform: dashscope, model: qwen3-vl-rerank, tier: native }
    no_fallback: true

  # 📝 I. 专业 OCR
  document_ocr:
    description: "图文排版解析、复杂表格提取、手写体识别"
    chain:
      - { platform: zhipu, model: glm-ocr, tier: native }
      - { platform: dashscope, model: qwen-vl-ocr, tier: native }
      - { platform: qiniu, model: ocr-fallback, tier: proxy }

  # 🔧 J. 其他增值服务
  value_added_services:
    description: "图片生/视频/TTS等独占API"
    chain:
      - { platform: qiniu, model: null, tier: proxy }
    no_fallback: true
```

---

## 八、节点到路由链到模型到平台 四层映射总矩阵

> **原则：工作流中所有节点默认使用原生服务。**

### 8.1 工作流核心节点

| 节点类型 | 路由链 | 首选平台 | 首选模型 | 降级路径 | Token消耗 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ai_analyzer` 需求分析 | A 格式严格 | 百炼(原生) | `qwen3-turbo` | DeepSeek 然后 火山 | ~500-1K |
| `ai_planner` 工作流编排 | A 格式严格 | 百炼(原生) | `qwen3-turbo` | DeepSeek 然后 火山 | ~1K-2K |
| `flashcard` 闪卡生成 | A 格式严格 | 百炼(原生) | `qwen-turbo` | 火山免费池 | ~300-800 |
| `outline_gen` 大纲生成 | B 深度推理 | DeepSeek(原生) | `deepseek-r1` | 百炼Max 然后 火山 | ~1K-3K |
| `content_extract` 知识提炼 | B 深度推理 | DeepSeek(原生) | `deepseek-r1` | 百炼Max 然后 火山 | ~2K-5K |
| `summary` 总结归纳 | B 深度推理 | DeepSeek(原生) | `deepseek-r1` | 百炼Max 然后 火山 | ~1K-3K |
| `merge_polish` 润色合并 | C 超长文本 | Moonshot(原生) | `kimi-k2.5` | 百炼Long 然后 七牛 | ~3K-8K |
| `intent_classify` 意图分类 | D 简单快速 | 百炼(原生) | `qwen-turbo` | 火山mini 然后 七牛 | ~100-300 |
| `pro_chat` Pro对话 | E 海外旗舰 | 优云智算(代理) | `gpt-5.1` | 七牛GPT-4o | ~1K-4K |

### 8.2 联网搜索节点

| 节点类型 | 路由链 | 首选平台 | 首选服务/模型 | 降级路径 | 计费方式 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `deep_search` 深度调研 | F 深度搜索 | 智谱AI(原生) | Web Search API + Search Agent | 七牛百度搜索 然后 百炼enable_search | 按次/按量 |
| `general_search` 一般搜索 | F 一般搜索 | 七牛云(代理) | Baidu Search API | 百炼enable_search | 按次 |
| `chat_search` AI对话搜索 | F 普通搜索 | 百炼(原生) | `qwen3.5-flash` + enable_search | 无 | 仅模型Token费 |

### 8.3 RAG 向量化与检索节点

| 节点类型 | 路由链 | 首选平台 | 首选模型 | 降级路径 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mm_embed` 多模态向量化 | G 多模态向量 | 百炼(原生) | `qwen3-vl-embedding` | `tongyi-embedding-vision-flash` | 支持文本/图片/视频/截图混合输入 |
| `text_embed` 文本向量化 | H 文本向量 | 百炼(原生) | `text-embedding-v4` | 无替代 | 纯文本向量化，知识库入库用 |
| `rerank` 检索结果重排 | H 重排序 | 百炼(原生) | `qwen3-vl-rerank` | 无替代 | 检索 Top-K 后二次精排 |

### 8.4 专业 OCR 视觉节点

| 节点类型 | 路由链 | 首选平台 | 首选模型 | 降级路径 |
| :--- | :--- | :--- | :--- | :--- |
| `document_ocr` 文档解析 | I 专业 OCR | 智谱AI(原生) | `glm-ocr` | 百炼 `qwen-vl-ocr` |

### 8.5 其他增值服务节点

| 节点类型 | 路由链 | 首选平台 | 降级路径 |
| :--- | :--- | :--- | :--- |
| `img_gen` 图片生成 | J 增值服务 | 七牛云(独占) | 无替代 |
| `video_gen` 视频生成 | J 增值服务 | 七牛云(独占) | 无替代 |
| `tts` 语音合成 | J 增值服务 | 七牛云(独占) | 无替代 |

---

## 九、成本优化策略 v2

### 9.1 开发/比赛期月度成本预估（日均50万Token）

| 任务类型 | 日均消耗 | 走哪个平台 | 日成本 | 月成本 |
| :--- | :--- | :--- | :--- | :--- |
| 格式严格(30%) | 15万T | 百炼 Qwen-Turbo | 0.045元 | 1.35元 |
| 深度推理(25%) | 12.5万T | DeepSeek-R1（缓存命中） | 0.125元 | 3.75元 |
| 超长文本(10%) | 5万T | Moonshot Kimi（缓存命中） | 0.035元 | 1.05元 |
| 简单快速(30%) | 15万T | 火山引擎免费池 | **0元** | **0元** |
| 海外模型(5%) | 2.5万T | 优云智算 | 0.5-2元 | 15-60元 |
| **合计** | **50万T/日** | 多平台 | **约0.7-2.2元** | **约21-66元** |

### 9.2 对比旧方案

| 维度 | 旧方案（全走七牛云聚合） | 新方案（原生优先） |
| :--- | :--- | :--- |
| 月成本 | 30-100元（无缓存折扣） | **21-66元**（缓存命中 + 免费池） |
| 格式可靠性 | 偶发 JSON 解析失败 | 100% 纯净输出 |
| 推理性能 | 可能被降采样 | 满血原生 |
| 长文本成本 | 5-15元/月（全价） | **1元/月**（Kimi 缓存命中） |

---

## 十、对比旧方案的全面差异

| 维度 | 旧方案（四平台线性路由） | 新方案（六平台双层分治） |
| :--- | :--- | :--- |
| 平台数 | 4（七牛/优云/火山/百炼） | **8**（+DeepSeek/Moonshot/智谱/硅基） |
| 路由逻辑 | 线性优先级排队 | **按任务类型直接分流** |
| 原生直连 | 仅百炼+火山 | **百炼+DeepSeek+Moonshot+火山+智谱** |
| System Prompt 安全 | 聚合平台可能污染 | 关键任务全走原生 |
| 上下文缓存 | 无法享受 | DeepSeek/Kimi 原生缓存大幅降本 |
| 超长文本 | 无专门通道 | Moonshot Kimi 256K 专线 |
| 格式输出可靠性 | 偶发失败 | 原生链专门保障 |
| 扩展新平台 | 改代码 | **改 YAML 配置即可** |

---

## 实施注意事项

1. `ai_router.py` 需要从"按平台优先级线性遍历"重构为"按任务类型查找对应路由链"
2. DeepSeek 官方 API 高峰期可能排队，建议设置 8s 超时后立即降级到百炼
3. Moonshot API 的模型 ID 格式与 OpenAI 兼容，但 `kimi-k2.5` 需确认控制台是否已上线
4. 智谱 AI 的 Base URL 路径与其他家略有不同 (`/v4` 而非 `/v1`)，需在代码中适配
5. 硅基流动主要作为 DeepSeek/Qwen 官方拥堵时的分流池，不作为首选

> **一句话总结**：**原生主战、代理辅助、分流分治、每条链路都有免费层兜底。**
