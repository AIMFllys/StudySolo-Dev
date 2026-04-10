# 后端依赖方向图（冻结契约）

> 版本：v1.0 | 冻结日期：2026-04-10
> 状态：🔒 已冻结 — 修改需三人 Sync + 版本号升级
> 关联 Phase：Phase 1 Task 1.1

---

## 依赖方向规则

```
                     ┌──────────────────────────────────┐
                     │         models/                  │
                     │    （只读数据模型 — Pydantic）     │
                     │    所有层均可依赖 ✅               │
                     └──────────────────────────────────┘
                                    ▲
                     ┌──────────────┼──────────────────┐
                     │              │                  │
              ┌──────┴──────┐  ┌───┴────────┐  ┌──────┴──────┐
              │   core/     │  │ services/  │  │  engine/    │
              │ 配置/DB/DI  │  │  业务服务  │  │ 执行引擎    │
              └─────────────┘  └────────────┘  └─────────────┘
                    ▲                ▲               ▲
                    │                │               │
              ┌─────┴───────────────┴─┐       ┌─────┴──────┐
              │       api/            │       │   nodes/   │
              │    HTTP 路由层         │       │  插件节点  │
              └───────────────────────┘       └────────────┘
                    ▲
              ┌─────┴──────────┐
              │  middleware/   │
              │  只被 main.py  │
              │  引用          │
              └────────────────┘
```

---

## 逐层规则表

| 模块           | 可依赖的模块                           | 禁止依赖的模块                 | 依据                   |
|----------------|----------------------------------------|-------------------------------|------------------------|
| `models/`      | 仅 `pydantic`, stdlib                  | 项目内任何其他模块             | 只读数据定义，零副作用 |
| `core/`        | `models/`, stdlib, 第三方库            | `api/`, `services/`, `engine/`, `nodes/` | 基础设施层，不含业务   |
| `services/`    | `models/`, `core/`                     | `api/`, `engine/`, `nodes/`   | 业务逻辑，不知路由     |
| `engine/`      | `models/`, `core/`, `services/`, `nodes/` | `api/`                     | 引擎调度节点           |
| `nodes/`       | `models/`, `core/`, `engine/`(仅基类)  | `api/`, `services/`(直接调用) | 防止循环依赖           |
| `api/`         | `models/`, `core/`, `services/`        | `engine/`(直接)               | 路由→服务→模型         |
| `middleware/`  | `core/`                                | 其他所有模块                   | 只被 `main.py` 挂载    |
| `prompts/`     | 无 Python 依赖（纯文本文件）           | 所有模块                       | 提示词模板             |
| `utils/`       | `models/`, `core/`, stdlib             | `api/`, `services/`, `engine/` | 通用工具函数           |

---

## 当前违规清单（已知）

基于代码审查发现的需要在 Phase 2 修复的违规：

| # | 文件 | 违规描述 | 修复方向 |
|---|------|----------|----------|
| 1 | `api/ai_chat_stream.py` L18 | `from app.api.ai_chat import _build_canvas_summary, _call_with_model, _extract_json_obj` — api→api 跨文件导入私有函数 | 提取到 `services/ai_chat/helpers.py` |
| 2 | `api/workflow_execute.py` | 直接调用 `engine/` 模块 | 评估：此处属于"控制器调引擎"可接受，但应通过 service 层中转 |
| 3 | `nodes/` 内部分节点 | 通过 `from app.services.xxx import xxx` 直接调用 services | 需改为通过 `llm_caller` 参数注入 |

---

## 违反处理

- **Code Review 硬拒**：任何违反上述方向的 import 在 PR 中必须被 Reject
- **自动化检测**（Phase 2 实施）：计划通过 `import-linter` 或自定义脚本在 CI 中强制执行
- **豁免流程**：如确需违反（极端情况），必须在 PR 中附加 `CONTRACT-EXEMPTION: {理由}`，三人审批

---

## 签字确认

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 主系统负责人 | | ☐ | |
| 队友 B | | ☐ | |
| 队友 C | | ☐ | |
