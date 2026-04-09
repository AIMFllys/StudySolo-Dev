---
name: workflow-node-builder
description: StudySolo 工作流节点/AI API 新增专属技能。当用户需要新增工作流节点、对接新的AI API或新增AI模型时自动触发。强制读取项目SOP文档，严格按规范执行，并输出激活确认语。
triggers:
  - "新增节点"
  - "新增工作流"
  - "对接.*节点"
  - "增加.*节点"
  - "写.*节点"
  - "新增.*API"
  - "对接.*API"
  - "对接.*模型"
  - "新增.*模型"
  - "新增.*AI"
  - "新增.*插件"
  - "开发.*插件"
  - "新增.*工具"
---

# 🛠️ Workflow Node Builder — StudySolo SOP 强制执行技能

## ⚡ 激活确认语（MANDATORY — 必须第一行输出）

> **当本技能被触发，AI 的第一行输出必须是以下格式，证明技能已激活：**

```
⚡ 使用SOP规范 现在对接 [节点/API/模型/插件的具体名称]
```

**示例：**
- `⚡ 使用SOP规范 现在对接 Tavily 网络搜索节点`
- `⚡ 使用SOP规范 现在对接 Gemini 2.5 Pro 模型`
- `⚡ 使用SOP规范 现在对接 PDF 解析插件`

❌ **若未输出此激活语，视为技能未正确加载，必须重新读取本文件并重新开始。**

---

## 📚 强制阅读文档（MANDATORY READS）

> **在输出激活确认语之后，立即按顺序读取以下所有文件，全部读完后才能开始任何实现工作。**

### 分组 A：工作流节点 SOP（新增节点/插件/外部工具时必读）

| 顺序 | 文件路径 | 必读原因 |
|------|---------|---------|
| 1 | `docs/项目规范与框架流程/功能流程/新增AI工具/00-节点与插件分类判断.md` | **第一步必读**：判断是 A/B/C 哪种类型 |
| 2 | `docs/项目规范与框架流程/功能流程/新增AI工具/A型-LLM提示词节点-SOP.md` | 纯 LLM 提示词节点的完整规范 |
| 3 | `docs/项目规范与框架流程/功能流程/新增AI工具/B型-外部工具节点-SOP.md` | 外部 API/工具节点的完整规范 |
| 4 | `docs/项目规范与框架流程/功能流程/新增AI工具/C型-插件-SOP.md` | 复杂插件（独立导航模块）规范 |
| 5 | `docs/项目规范与框架流程/功能流程/新增AI工具/执行面板升级规划.md` | 执行面板&推理链 UI 规范（所有节点必须适配）|

### 分组 B：AI 模型接入 SOP（新增/对接 AI 模型时必读）

| 顺序 | 文件路径 | 必读原因 |
|------|---------|---------|
| 1 | `docs/项目规范与框架流程/功能流程/新增AI模型/新增AI模型-SOP.md` | 模型注册、路由配置、计费接入全流程 |

> **规则：** 根据任务类型选择读取对应分组，若任务同时涉及节点+模型，则两组全部读取。

---

## 🔍 第一步必做：类型判断

读完 `00-节点与插件分类判断.md` 后，**必须先输出分类结论**，格式如下：

```
📋 **SOP 类型判断**
- 任务：[用户描述的目标]
- 分类：[A型 LLM节点 / B型 外部工具节点 / C型 插件 / 新增AI模型]
- 判断依据：[一句话说明原因]
- 将参考 SOP：[对应的 SOP 文件名]
```

---

## 📋 执行流程（按顺序，不可跳过）

```
Step 1  输出激活确认语
        ⚡ 使用SOP规范 现在对接 [具体名称]

Step 2  读取所有相关 SOP 文档（分组 A + B，按需）

Step 3  输出类型判断结论
        📋 SOP 类型判断 → [A/B/C/模型]

Step 4  按对应 SOP 的"新增检查清单"逐项过一遍
        输出格式：☑️ [检查项] — [状态/处理意见]

Step 5  输出完整实现计划（后端文件列表 + 前端文件列表）

Step 6  开始实现（严格按 SOP 规范，不得跳步）

Step 7  实现完成后执行验收检查
        按对应 SOP 的"联调验收"章节逐项核对
```

---

## ❌ 严禁行为（直接违反 SOP 的红线）

- ❌ 未读 `00-节点与插件分类判断.md` 就开始写代码
- ❌ 在 `BaseNode.execute()` 之外写核心业务逻辑
- ❌ 硬编码 API Key（必须环境变量，必须 `.env.example` 同步）
- ❌ LLM 节点未配置 `task_routes`（is_llm_node=True 时）
- ❌ 工具节点配置了 `task_routes`（纯工具节点禁止此配置）
- ❌ 新节点未在 SOP 要求的位置注册（`__init_subclass__` 自动注册，但目录结构必须符合）
- ❌ 渲染器未实现 `compact` prop（执行面板要求）
- ❌ 新增的数据库表未设置 RLS 策略
- ❌ 跳过 `npx tsc --noEmit` 类型检查步骤

---

## ✅ 必须包含的交付物（每次新增节点必须有这些）

### 后端交付物
- [ ] `backend/app/nodes/{type_name}/__init__.py` — 自动注册
- [ ] `backend/app/nodes/{type_name}/node.py` — 继承 `BaseNode`
- [ ] `backend/app/nodes/{type_name}/prompts.py`（A型）或 `services/` 封装（B型）
- [ ] `backend/tests/nodes/test_{type_name}.py` — 单元测试

### 前端交付物
- [ ] `frontend/src/features/workflow/components/nodes/renderers/{TypeName}Renderer.tsx`
- [ ] `frontend/src/features/workflow/nodes/workflow-meta.ts` — 注册 `NodeType` union + meta
- [ ] `frontend/src/features/workflow/components/nodes/index.ts` — 注册渲染器映射
- [ ] Renderer 实现 `compact?: boolean` prop（推理链面板适配）

### 文档交付物
- [ ] （可选）如果是 B 型且有新的 Service，在 `docs/` 对应目录补充说明

---

## 💡 触发语句识别规则

> 以下任何一类描述出现时，本技能自动激活：

| 场景 | 识别关键词示例 |
|------|--------------|
| 新增工作流节点 | "新增节点"、"加个节点"、"写一个XXX节点"、"开发XXX节点" |
| 对接外部 API | "对接XXX API"、"接入XXX工具"、"用XXX搜索" |
| 新增 AI 模型 | "加个新模型"、"接入XXX模型"、"对接Gemini/Claude/Kimi" |
| 新增插件模块 | "新增插件"、"做个XXX功能模块"、"左侧新加个页面" |
| AI 功能扩展 | "让AI能XXX"、"让工作流支持XXX" |

---

## 🔗 SOP 文档绝对路径参考

```
项目根目录：d:\project\Study_1037Solo\StudySolo\

工具节点 SOP 目录：
  docs\项目规范与框架流程\功能流程\新增AI工具\
    ├── 00-节点与插件分类判断.md
    ├── A型-LLM提示词节点-SOP.md
    ├── B型-外部工具节点-SOP.md
    ├── C型-插件-SOP.md
    └── 执行面板升级规划.md

AI模型 SOP 目录：
  docs\项目规范与框架流程\功能流程\新增AI模型\
    └── 新增AI模型-SOP.md
```
