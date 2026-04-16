# Visual Site Agent

> 状态：✅ 阶段版已落地
> 负责人：待定
> 端口：8005
> 来源：新建

---

## 用途

可视化网站生成 Agent，根据用户提供的页面需求、内容主题或展示目标，输出结构化页面方案、设计说明和基础 HTML 草稿。

当前阶段优先交付一个最小可运行版本：先把“网页生成”做成标准 Agent 服务，再逐步增强页面复杂度、样式质量和导出能力。

## V1 任务说明书

### 目标

`visual-site-agent` 第一版用于根据用户提供的网页需求，生成一份结构化的网站页面草案，帮助用户快速确定页面结构、视觉方向和基础 HTML 内容。

### 目标用户

第一版面向以下用户：

- 已经知道自己想做什么页面
- 能提出明确的主题、用途或展示对象
- 希望先得到一个可继续修改的页面草稿

示例输入：

- `帮我做一个展示学习报告的网页`
- `生成一个介绍二叉树知识点的教学页面`
- `我想做一个展示课程总结的单页网站`

### 输入范围

第一版先只处理单条明确页面需求，输入通常包含：

- 页面主题
- 页面用途
- 页面风格或展示重点

第一版暂不依赖上传文件、复杂多轮需求澄清或真实设计资产。

### 输出目标

第一版输出固定为结构化页面方案，建议至少包含以下部分：

1. `Page Summary`
2. `Page Structure`
3. `Design Notes`
4. `Starter HTML`

其中：

- `Page Summary`：概括页面主题与展示目标
- `Page Structure`：说明页面由哪些核心区块组成
- `Design Notes`：给出视觉风格、布局和交互建议
- `Starter HTML`：提供可继续扩展的基础 HTML 草稿

### V1 固定输出模板

```text
Page Summary
- Topic: <页面主题>
- Goal: <页面主要展示目标>

Page Structure
1. Hero: <首屏内容>
2. Main Sections: <主要内容区块>
3. Supporting Elements: <补充信息或交互元素>

Design Notes
1. Visual Direction: <整体视觉方向>
2. Layout Advice: <布局建议>
3. Interaction Hint: <基础交互建议>

Starter HTML
```html
<!-- 基础页面草稿 -->
```
```

### 模板设计原则

- `Page Summary` 只负责确认页面主题和目标，不展开细节
- `Page Structure` 负责把页面拆成用户容易理解和实现的结构区块
- `Design Notes` 负责给出可执行的视觉和交互建议
- `Starter HTML` 负责提供最小可用草稿，为后续继续生成完整页面保留空间
- 整体输出优先稳定、清晰、便于继续接入更强的生成能力

### V1 填充逻辑

第一版的核心思路不是自由聊天，而是把用户的一条页面需求稳定地映射成固定模板中的四个部分。

整体流程如下：

1. 识别用户当前想做的页面主题
2. 判断页面的主要展示目标
3. 按固定结构生成页面区块、设计建议和 HTML 草稿
4. 以稳定模板输出结果

#### Step 1: 识别页面主题

第一版默认从用户最后一条消息中提取当前页面主题。

示例：

- `帮我做一个展示学习报告的网页` → 页面主题：`学习报告`
- `生成一个介绍二叉树知识点的教学页面` → 页面主题：`二叉树知识点`
- `我想做一个展示课程总结的单页网站` → 页面主题：`课程总结`

第一版的提取原则是：

- 去掉请求壳子，例如 `帮我做一个`、`生成一个`、`我想做一个`
- 去掉页面壳子，例如 `网页`、`页面`、`网站`、`单页网站`
- 保留中间真正的主题词

也就是说，这一步重点不是理解所有表达，而是稳定回答“这页到底是关于什么的”。

#### Step 2: 判断展示目标

在识别出页面主题后，第一版需要进一步判断这次页面生成最优先解决什么问题。

简单规则：

- 用户偏向“介绍/说明”时，目标放在信息清晰展示
- 用户偏向“展示/汇报”时，目标放在结果呈现与结构梳理
- 用户偏向“教学/学习”时，目标放在内容引导和层次清晰
- 用户偏向“作品/落地页”时，目标放在视觉吸引和重点突出

这一阶段建议统一抽象成 `page_goal`，例如：

- `展示学习报告` → `清晰展示学习成果和阶段总结`
- `介绍二叉树知识点` → `帮助读者快速理解核心概念和结构`
- `展示课程总结` → `梳理课程重点并方便快速回顾`

也就是说，`page_goal` 回答的是：

**“这个页面最主要想完成什么任务？”**

#### Step 2.5: 分类页面类型与风格方向

为了让后续页面规划更稳定，第一版建议在理解阶段额外提取两个字段：

- `page_type`
- `style_direction`

##### `page_type`

第一版建议先只分 4 类：

- `report_page`：学习报告、成果展示、进度汇报
- `teaching_page`：知识讲解、概念介绍、教学页面
- `summary_page`：课程总结、复习梳理、重点归纳
- `landing_page`：展示感更强的介绍页、作品页、宣传页

可以按需求关键词做简单映射：

- 偏“展示 / 汇报 / 呈现” → `report_page`
- 偏“介绍 / 讲解 / 教学 / 知识点” → `teaching_page`
- 偏“总结 / 复习 / 梳理” → `summary_page`
- 偏“宣传 / 展示感 / 作品” → `landing_page`

##### `style_direction`

这一项回答的是页面整体应该偏什么气质。

第一版建议先用“页面类型 → 默认风格”的映射：

- `report_page` → `clean`
- `teaching_page` → `academic`
- `summary_page` → `clean`
- `landing_page` → `showcase`

如果用户明确写了风格词，再覆盖默认值。例如：

- `简洁` → `clean`
- `学术` → `academic`
- `展示感强` → `showcase`
- `轻松一点` → `friendly`

#### Step 3: 填充四个固定部分

##### `Page Summary`

- `Topic`：填写页面主题
- `Goal`：填写页面主要展示目标

第一版建议尽量短小稳定，优先承担两件事：

- 确认用户到底想做什么页面
- 确认这次页面生成最优先解决什么展示任务

建议固定为：

```text
Page Summary
- Topic: <页面主题>
- Goal: <页面主要展示目标>
```

##### `Page Structure`

- `Hero`：首屏核心信息
- `Main Sections`：主体内容区块
- `Supporting Elements`：补充信息、CTA 或小交互

第一版建议把这一段理解成“页面骨架”，不要一开始就把它做成很复杂的页面树。

每个槽位建议这样理解：

- `Hero`：用户进入页面第一眼看到的核心内容，比如标题、副标题、简短说明、主按钮
- `Main Sections`：页面中真正承载信息的主要区块，比如简介、知识点分区、案例展示、总结模块
- `Supporting Elements`：不一定是主体，但能提升页面完整度的内容，比如导航、标签、统计卡片、页脚、CTA

这一段的目标不是穷尽细节，而是先把页面组织方式说清楚。

##### `Design Notes`

- `Visual Direction`：页面气质与视觉方向
- `Layout Advice`：布局建议
- `Interaction Hint`：基础交互提示

第一版里这一段应该尽量可执行，而不是空泛地写“简洁大气、科技感”。

建议每一项都落到具体一点的描述：

- `Visual Direction`：颜色倾向、气质、信息密度
- `Layout Advice`：单栏/双栏、区块分隔方式、内容节奏
- `Interaction Hint`：最基础的小交互，比如 hover、折叠、锚点跳转、卡片展开

如果用户没明确说风格，第一版就优先生成“清晰、稳妥、易读”的默认方案。

##### `Starter HTML`

- 提供一个基础 HTML 骨架
- 保持结构清晰、可扩展

第一版建议只输出一个最小可继续修改的 HTML 草稿，不追求一次性生成完整复杂站点。

草稿里建议至少包含：

- 页面标题
- Hero 区块
- 至少 2 个主体 section
- 一个简单 footer 或补充区块

如果当前阶段不想一开始就做复杂 CSS，可以先保证 HTML 结构清晰，再逐步增强样式。

#### Step 4: 稳定输出

第一版始终按以下顺序输出：

1. `Page Summary`
2. `Page Structure`
3. `Design Notes`
4. `Starter HTML`

这样做的目的是：

- 降低实现复杂度
- 保持用户体验稳定
- 方便后续补充更强的页面生成能力
- 方便测试和长期维护

### 理解模块 V1

为了让 `visual-site-agent` 的实现更稳定，第一版建议将用户输入先转换成下面这张“页面任务卡”：

```text
page_topic
page_goal
page_type
style_direction
```

它们分别表示：

- `page_topic`：页面主题
- `page_goal`：页面主要展示目标
- `page_type`：页面类型
- `style_direction`：页面风格方向

例如：

```text
输入：帮我做一个展示学习报告的网页

page_topic = 学习报告
page_goal = 清晰展示学习成果和阶段总结
page_type = report_page
style_direction = clean
```

```text
输入：生成一个介绍二叉树知识点的教学页面

page_topic = 二叉树知识点
page_goal = 帮助读者快速理解核心概念和结构
page_type = teaching_page
style_direction = academic
```

这一步的意义是：

- 先把用户的自然语言需求转成结构化页面任务
- 让后面的页面规划和 HTML 生成更稳定
- 避免直接对原始输入自由发挥

### 第一版填充规则建议

为了让后面实现更稳定，第一版建议补上下面这些固定规则：

#### `Page Summary`

- 控制在 2 行内
- 不展开细节
- 优先确认页面主题和主要用途

#### `Page Structure`

- 默认拆成 `Hero + Main Sections + Supporting Elements`
- 主体区块建议控制在 2 到 4 个
- 不在这一段写样式细节

#### `Design Notes`

- 每条都要能指导实现
- 少用空泛形容词
- 优先说明颜色、布局和基础交互

#### `Starter HTML`

- 默认生成单页 HTML 骨架
- 结构优先于样式
- 代码保持简单、可读、可扩展

### 示例理解

如果用户输入：

`帮我做一个展示学习报告的网页`

第一版更适合生成这种理解结果：

- `Topic`：学习报告
- `Goal`：清晰展示学习成果、重点结论和阶段总结

然后页面骨架可以偏向：

- `Hero`：报告标题 + 简短概览
- `Main Sections`：学习进展、重点内容、成果总结
- `Supporting Elements`：统计卡片、标签、页脚

而不是一开始就去做特别复杂的页面系统。

## V1 核心能力

第一版只聚焦以下 3 项能力：

- 页面结构生成
- 设计说明生成
- HTML 草稿生成

这三项能力已经足以构成一个最小可用的可视化网页生成 Agent。

## 暂不实现

为控制范围，第一版先不实现以下内容：

- 真正复杂的多页站点生成
- PDF 导出
- 思维导图文件解析
- 真实知识图谱布局引擎
- 复杂前端交互逻辑
- 上传素材后的自动排版

这些能力可以在后续版本中逐步补齐。

## 后续版本方向

- `V2`：更完整的单页站点、更多页面风格、可选主题模板
- `V3`：知识图谱可视化、学习报告动态页面、导出 HTML/PDF

## 技术栈

- Python 3.11+ / FastAPI / uvicorn
- 协议：OpenAI Chat Completions 兼容

## 快速开始

```bash
cd agents/visual-site-agent
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

## 当前首版能力

- `GET /health`
- `GET /health/ready`
- `GET /v1/models`
- `POST /v1/chat/completions`
- 根据页面需求输出页面结构、设计说明和 HTML 草稿
- 支持 `heuristic` 本地理解
- 可选接入 `openai_compatible` 上游模型做 AI 理解，并在失败时回退
- 可选接入 `upstream_openai_compatible` 上游模型做 AI 页面规划，并在失败时回退到本地规划
- 支持 non-stream 与 SSE stream
- 已补齐契约测试、页面理解测试、AI 理解测试与上游规划测试
- 支持结构化 JSON 日志输出到 stdout
- 支持 `X-Request-Id` 透传与请求耗时日志
- 支持通过 `AGENT_CORS_ALLOW_ORIGINS` 配置 CORS 白名单
- 支持基础内存限流，并在超限时返回 `429 rate_limit_exceeded`
- 支持基础过载保护，并在并发超限时返回 `503 agent_overloaded`

可选治理层配置示例：

```bash
AGENT_CORS_ALLOW_ORIGINS=*
AGENT_RATE_LIMIT_ENABLED=true
AGENT_RATE_LIMIT_REQUESTS=60
AGENT_RATE_LIMIT_WINDOW_SECONDS=60
AGENT_OVERLOAD_PROTECTION_ENABLED=true
AGENT_OVERLOAD_MAX_IN_FLIGHT_REQUESTS=20
AGENT_PLANNER_BACKEND=heuristic
AGENT_PLANNER_MODEL=
AGENT_PLANNER_BASE_URL=
AGENT_PLANNER_API_KEY=
AGENT_PLANNER_TIMEOUT_SECONDS=30.0
```

生产环境建议将 `*` 替换为 Gateway 或前端来源地址，多个来源可使用英文逗号分隔。
限流窗口默认是 `60 秒 / 60 次`，当前为轻量级进程内限流，适合单实例阶段版。
并发过载保护默认阈值是 `20` 个 in-flight 请求，当前同样是轻量级单进程实现。

## 验证

```bash
pytest tests -q
```

当前阶段测试基线：

- `30 passed`

当前目录已补齐：

- `Dockerfile`
- `docker-compose.yml`
- `pyproject.toml`

## 仍待实现

- 与 Gateway 的 timeout 链联调验证
- 更强的页面规划能力，例如多页面站点、主题模板和更完整的 CSS
- 更正式的多实例级限流/过载保护，当前为单进程内存实现

## 参考

- [Agent 开发指南](../README.md)
- [接口协议规范](../../docs/issues/TeamRefactor/final-plan/agent-architecture.md)
