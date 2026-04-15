# Study Tutor Agent

> 状态：✅ 阶段版已落地（支持本地理解、本地规划、可选 AI 理解、可选 AI 内容生成）
> 负责人：待定
> 端口：8004
> 来源：新建

---

## 用途

学习专家辅导 Agent，根据用户提供的学习主题或学习问题，输出结构化的知识点解析、学习建议和基础练习内容。

当前阶段优先交付一个最小可运行版本：先把“学习辅导”这件事做成标准 Agent 服务，再逐步增强个性化和多轮诊断能力。

当前仓库中的阶段版已经具备：

- 标准 Agent 服务外壳
- 结构化学习辅导输出
- 本地理解模块
- 主主题与相关主题拆分能力
- 本地知识卡片与通用规划
- 可选 OpenAI-compatible AI 理解
- 可选 OpenAI-compatible AI 内容生成
- 上游失败时自动回退到本地逻辑
- 契约测试与核心逻辑测试闭环
- 结构化 JSON 日志与 `X-Request-Id` 透传
- 基础 CORS 配置能力

## V1 任务说明书

### 目标

`study-tutor-agent` 第一版用于根据用户提供的学习主题，生成一份结构化的学习辅导结果，帮助用户快速理解知识点、明确下一步学习方向，并完成基础自测。

### 目标用户

第一版面向以下用户：

- 已经知道自己想学什么
- 能提出明确的学习主题、知识点或问题
- 希望得到讲解、学习建议和练习引导

示例输入：

- `帮我复习牛顿第二定律`
- `解释一下什么是二叉树`
- `我不会函数极限，应该怎么学`

### 输入范围

第一版先只处理单条明确学习请求，输入通常包含：

- 一个学习主题
- 一个知识点问题
- 一个简短的学习困难描述

第一版暂不依赖完整学习档案、长期进度记录或复杂上下文拼接。

### 输出目标

第一版输出固定为结构化辅导内容，建议至少包含以下部分：

1. `Topic Summary`
2. `Key Concepts`
3. `Study Suggestions`
4. `Practice`

其中：

- `Topic Summary`：概括用户当前要学什么
- `Key Concepts`：用通俗方式解释核心知识点
- `Study Suggestions`：给出下一步学习建议
- `Practice`：给出 2-3 个基础练习题

### V1 固定输出模板

```text
Topic Summary
- Topic: <用户当前学习主题>
- Focus: <这次辅导优先帮助用户掌握的内容>

Key Concepts
1. Definition: <基础定义>
2. Core Idea: <核心理解>
3. Common Confusion: <常见误区>

Study Suggestions
1. First Step: <立刻可以开始的学习动作>
2. Next Step: <进一步推进的学习动作>
3. Checkpoint: <判断自己是否掌握的方法>

Practice
1. Basic: <基础题>
2. Understanding: <理解题>
3. Application: <应用题>
```

### 模板设计原则

- `Topic Summary` 只负责确认当前学习主题和本次辅导重点，不展开详细讲解
- `Key Concepts` 负责解释“这是什么、重点是什么、容易误解什么”
- `Study Suggestions` 负责告诉用户“下一步怎么学”，每条都应尽量可执行
- `Practice` 负责用 3 道由浅入深的小题帮助用户完成基础自测
- 整体输出优先稳定、清晰、可复用，为后续接入真实上游能力保留空间

### V1 填充逻辑

第一版的核心思路不是自由聊天，而是把用户的一条学习请求，稳定地映射成固定模板中的四个部分。

整体流程如下：

1. 识别用户当前的学习主题
2. 判断本次辅导最优先解决的问题
3. 按固定结构生成知识讲解、学习建议和练习
4. 以稳定模板输出结果

当前实现支持两种理解方式：

- `heuristic`：默认方式，使用本地规则提取主题、意图和辅导重点
- `openai_compatible`：可选方式，调用上游 OpenAI-compatible 模型辅助理解输入；若调用失败，会自动回退到本地规则

当前阶段的理解结果已不再只有单一 `topic`，而是进一步区分：

- `primary_topic`：当前最主要的学习主题
- `related_topics`：和主主题一起出现、并且可能造成比较或混淆的相关主题

为兼容当前输出模板，最终 `Topic Summary` 仍会优先展示主主题，但规划层已经可以利用相关主题增强 `Focus`、`Common Confusion` 和 `Practice`。

当前实现支持两种内容生成方式：

- `heuristic`：默认方式，使用本地知识卡片和通用规划规则生成四段辅导内容
- `upstream_openai_compatible`：可选方式，调用上游 OpenAI-compatible 模型直接生成 `TutorPlan`，若调用失败，会自动回退到本地规划

#### Step 1: 识别学习主题

第一版默认从用户最后一条消息中提取当前学习主题。

示例：

- `帮我复习牛顿第二定律` → 学习主题：`牛顿第二定律`
- `解释一下什么是二叉树` → 学习主题：`二叉树`
- `我不会函数极限，应该怎么学` → 学习主题：`函数极限`

当前阶段不要求复杂主题抽取，只要能稳定识别“用户现在想学什么”即可。

当前实现已经支持把“主学习主题”和“顺带提及的相关概念”拆开。例如：

- `最近我学时序电路的时候总觉得它有点绕，和汉明码一样，我现在脑子里还是糊的`
  - `primary_topic`：`时序电路`
  - `related_topics`：`汉明码`

当前实现优先支持以下类型的表达：

- `解释一下什么是二叉树`
- `请帮我复习牛顿第二定律`
- `我不会函数极限，应该怎么学`
- `我总是搞不懂前序遍历和中序遍历`

若用户输入过于模糊，第一版会回退为 `学习主题待确认`，避免误判主题。

#### Step 2: 判断本次辅导重点

在识别出学习主题后，第一版需要进一步判断这次回答最优先帮助用户解决什么问题。

简单规则：

- 用户偏向“解释”时，重点放在基础概念理解
- 用户偏向“不会 / 搞混 / 不理解”时，重点放在核心理解和误区澄清
- 用户偏向“怎么学 / 怎么复习”时，重点放在学习顺序和基础练习方向
- 用户偏向“复习 / 回顾”时，重点放在核心框架回顾和高频关键点梳理

这一阶段产出的内容主要用于填充 `Topic Summary` 中的 `Focus`。

#### Step 3: 填充四个固定部分

##### `Topic Summary`

- `Topic`：填写用户当前学习主题
- `Focus`：填写本次辅导最优先帮助用户掌握的内容

当前阶段固定展示主主题；若识别到 `related_topics`，则会优先体现在 `Focus`、`Common Confusion` 和 `Practice` 中。

##### `Key Concepts`

- `Definition`：解释主题的基础定义
- `Core Idea`：解释最关键的理解抓手
- `Common Confusion`：指出最容易出现的误区

##### `Study Suggestions`

- `First Step`：给出用户现在立刻可以开始的动作
- `Next Step`：给出下一步推进建议
- `Checkpoint`：给出判断是否掌握的方法

##### `Practice`

- `Basic`：检查基础定义或概念
- `Understanding`：检查是否真正理解
- `Application`：检查能否进行基础应用

#### Step 4: 稳定输出

第一版始终按以下顺序输出：

1. `Topic Summary`
2. `Key Concepts`
3. `Study Suggestions`
4. `Practice`

这样做的目的是：

- 降低实现复杂度
- 保持用户体验稳定
- 方便后续补充更强的上游能力
- 方便测试和长期维护

## V1 核心能力

第一版只聚焦以下 3 项能力：

- 知识点解析
- 学习建议生成
- 基础练习题生成

这三项能力已经足以构成一个最小可用的学习辅导 Agent。

## 暂不实现

为控制范围，第一版先不实现以下内容：

- 长期学习进度跟踪
- 真实个性化学习画像建模
- 自动薄弱环节诊断引擎
- 复杂多轮互动式辅导
- 强依赖 StudySolo 工作流结果的深度联动
- 完整学习路径规划系统

这些能力可以在后续版本中逐步补齐。

## 后续版本方向

- `V2`：学习路径推荐、阶段化学习计划
- `V3`：薄弱环节诊断、多轮互动辅导、结合 StudySolo 工作流结果做更强个性化

## 技术栈

- Python 3.11+ / FastAPI / uvicorn
- 协议：OpenAI Chat Completions 兼容

## 当前首版能力

- `GET /health`
- `GET /health/ready`
- `GET /v1/models`
- `POST /v1/chat/completions`
- 根据学习主题输出讲解、学习建议和基础练习题
- 支持 `heuristic` 本地理解
- 可选接入 `openai_compatible` 上游模型做 AI 理解，并在失败时回退
- 支持 `heuristic` 本地内容规划
- 可选接入 `upstream_openai_compatible` 上游模型做 AI 内容生成，并在失败时回退
- 支持 `primary_topic` 与 `related_topics` 的理解和规划增强
- 支持 non-stream 与 SSE stream
- 已补齐契约测试、理解测试、AI 理解测试和 upstream tutor 测试
- 支持结构化 JSON 日志输出到 stdout
- 支持 `X-Request-Id` 透传与请求耗时日志
- 支持通过 `AGENT_CORS_ALLOW_ORIGINS` 配置 CORS 白名单
- 支持基础内存限流，并在超限时返回 `429 rate_limit_exceeded`

## 快速开始

```bash
cd agents/study-tutor-agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m src.main
```

`.env` 使用说明：

- `AGENT_API_KEY` 为必填项，启动前必须改成你自己的测试或部署密钥
- 本地调用时，请求头必须带 `Authorization: Bearer <AGENT_API_KEY>`
- `AGENT_CORS_ALLOW_ORIGINS=*` 只建议用于本地开发
- 默认后端是 `heuristic`
- 只有在补齐对应的 `MODEL / BASE_URL / API_KEY` 后，才应切换到上游 AI 模式

容器启动方式：

```bash
docker compose up --build
```

可选治理层配置示例：

```bash
AGENT_CORS_ALLOW_ORIGINS=*
AGENT_RATE_LIMIT_ENABLED=true
AGENT_RATE_LIMIT_REQUESTS=60
AGENT_RATE_LIMIT_WINDOW_SECONDS=60
```

生产环境建议将 `*` 替换为 Gateway 或前端来源地址，多个来源可使用英文逗号分隔。
限流窗口默认是 `60 秒 / 60 次`，当前为轻量级进程内限流，适合单实例阶段版。

## 验证

```bash
pytest tests -q
```

当前阶段测试基线：

- `35 passed`

当前目录已补齐：

- `Dockerfile`
- `docker-compose.yml`
- `pyproject.toml`

## 参考

- [Agent 开发指南](../README.md)
- [接口协议规范](../../docs/team/refactor/final-plan/agent-architecture.md)
