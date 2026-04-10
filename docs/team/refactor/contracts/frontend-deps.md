# 前端依赖方向图（冻结契约）

> 版本：v1.0 | 冻结日期：2026-04-10
> 状态：🔒 已冻结 — 修改需三人 Sync + 版本号升级
> 关联 Phase：Phase 1 Task 1.2

---

## 依赖方向规则

```
                     ┌──────────────────────────────────┐
                     │           types/                 │
                     │    （只读类型定义 — TypeScript）   │
                     │    所有模块均可依赖 ✅             │
                     └──────────────────────────────────┘
                                    ▲
                     ┌──────────────┼──────────────────┐
                     │              │                  │
              ┌──────┴────────┐  ┌─┴────────────┐  ┌──┴───────────┐
              │ components/ui │  │  services/   │  │   lib/       │
              │  基础 UI 组件 │  │  API 服务层  │  │  工具/SDK    │
              │  所有模块可用 │  │              │  │              │
              └───────────────┘  └──────────────┘  └──────────────┘
                    ▲                  ▲                   ▲
                    │                  │                   │
              ┌─────┴──────────┐ ┌────┴──────────┐  ┌────┴──────────┐
              │    stores/     │ │    hooks/     │  │    utils/     │
              │  Zustand Store │ │  自定义 Hook  │  │   工具函数    │
              └────────────────┘ └───────────────┘  └───────────────┘
                    ▲                  ▲
                    │                  │
              ┌─────┴──────────────────┴──────────────────┐
              │              features/                     │
              │     按领域组织的业务模块                     │
              │  （⚠️ features 之间禁止互相导入！）         │
              └────────────────────────────────────────────┘
                    ▲
              ┌─────┴──────────┐
              │     app/       │
              │  Next.js 路由  │
              │  页面入口      │
              └────────────────┘
```

---

## 逐层规则表

| 模块              | 可依赖的模块                                     | 禁止依赖的模块                         | 依据                         |
|-------------------|--------------------------------------------------|----------------------------------------|------------------------------|
| `types/`          | 仅 TypeScript 内置类型, `@xyflow/react` 类型     | 项目内任何运行时模块                    | 只读类型定义，零副作用       |
| `lib/`            | `types/`, 第三方库                                | `features/`, `stores/`, `services/`    | Supabase/工具初始化          |
| `components/ui/`  | `types/`, `lib/`, `utils/`, 第三方 UI 库          | `features/`, `services/`, `stores/`    | 通用无状态 UI 组件           |
| `services/`       | `types/`, `lib/`                                  | `features/`, `stores/`, `components/`  | 纯 API 调用层，无 UI         |
| `stores/`         | `types/`, `services/`, `lib/`                     | `features/`, `components/`, `hooks/`   | 全局状态管理                 |
| `hooks/`          | `types/`, `stores/`, `services/`, `lib/`, `utils/`| `features/`, `components/`             | 可复用逻辑 Hook              |
| `utils/`          | `types/`, stdlib                                  | `features/`, `stores/`, `services/`    | 纯函数工具                   |
| `components/layout/` | `types/`, `components/ui/`, `stores/`, `hooks/` | `features/`                            | 布局壳组件                   |
| `components/workflow/`| `types/`, `components/ui/`, `stores/`, `hooks/`, `services/` | `features/`               | 工作流专用复合组件           |
| `features/*`      | `types/`, `components/`, `services/`, `stores/`, `hooks/`, `utils/`, `lib/` | **其他 `features/*`** ⚠️ | 领域隔离核心规则 |
| `app/`            | 所有模块                                          | 无                                     | 路由入口，组合一切           |

---

## 关键约束：Features 隔离规则

```
❌ 禁止: features/workflow/ → import from features/admin/
❌ 禁止: features/auth/ → import from features/knowledge/
❌ 禁止: features/admin/ → import from features/workflow/

✅ 允许: features/workflow/ → import from services/workflow.service.ts
✅ 允许: features/admin/ → import from stores/use-admin-store.ts
✅ 允许: features/knowledge/ → import from components/ui/Button.tsx
```

**当两个 feature 需要通信时**：

1. **数据共享** → 通过 `stores/` (Zustand) 的 public API
2. **API 调用** → 通过 `services/` 封装
3. **类型共享** → 通过 `types/` 统一定义
4. **UI 复用** → 提取到 `components/ui/` 或 `components/workflow/`

---

## 当前 Features 清单

| Feature 模块 | 职责 | 对应后端 API |
|-------------|------|-------------|
| `features/workflow/` | 工作流画布、节点、工具栏、执行、AI 面板 | `/api/workflow/*`, `/api/ai/*`, `/api/nodes/*` |
| `features/admin/` | 后台管理子域 | `/api/admin/*` |
| `features/knowledge/` | 知识库管理 | `/api/knowledge/*` |
| `features/auth/` | 登录注册验证码 | `/api/auth/*` |
| `features/settings/` | 个人设置页 | `/api/usage/*` |
| `features/community-nodes/` | 社区节点市场 | `/api/community-nodes/*` |

---

## ESLint 自动化执行（Phase 3 实施）

```jsonc
// .eslintrc.json 新增规则
{
  "rules": {
    "import/no-restricted-paths": ["error", {
      "zones": [
        {
          "target": "./src/features/workflow",
          "from": "./src/features/!(workflow)",
          "message": "features/ 之间禁止互相导入（Contract v1.0）"
        },
        {
          "target": "./src/features/admin",
          "from": "./src/features/!(admin)",
          "message": "features/ 之间禁止互相导入（Contract v1.0）"
        },
        {
          "target": "./src/features/auth",
          "from": "./src/features/!(auth)",
          "message": "features/ 之间禁止互相导入（Contract v1.0）"
        },
        {
          "target": "./src/features/knowledge",
          "from": "./src/features/!(knowledge)",
          "message": "features/ 之间禁止互相导入（Contract v1.0）"
        },
        {
          "target": "./src/features/settings",
          "from": "./src/features/!(settings)",
          "message": "features/ 之间禁止互相导入（Contract v1.0）"
        },
        {
          "target": "./src/services",
          "from": "./src/features",
          "message": "services/ 不可依赖 features/（Contract v1.0）"
        },
        {
          "target": "./src/stores",
          "from": "./src/features",
          "message": "stores/ 不可依赖 features/（Contract v1.0）"
        },
        {
          "target": "./src/types",
          "from": "./src/(features|services|stores|components)",
          "message": "types/ 不可依赖运行时模块（Contract v1.0）"
        }
      ]
    }]
  }
}
```

---

## 签字确认

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 主系统负责人 | | ☐ | |
| 队友 B | | ☐ | |
| 队友 C | | ☐ | |
