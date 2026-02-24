# NextJS 前端项目规则与约束（AGENT Code）

> 面向 AI Agent 的前端工程规范，涵盖架构约束、编码约定与 UI/UX 实现准则

---

## 🏗️ 项目架构规则

### 1. 目录结构与命名规范

本章定义目录结构、命名规范与核心编码约定，所有代码变更必须遵守。
**约束级别**：`必须` = 强制执行 · `应该` = 推荐遵循 · `永不` = 严格禁止

#### 顶层目录

```text
├── app/                    # Next.js App Router 路由
├── components/             # React 组件
├── services/               # 服务层（业务逻辑）
├── types/                  # TypeScript 类型定义
├── hooks/                  # 自定义 React Hooks
├── lib/                    # 纯工具函数（无业务语义、无外部依赖）
├── utils/                  # 第三方 SDK 封装（Supabase 等）
├── stores/                 # 状态管理（Zustand，按需创建）
├── docs/                   # 项目文档
├── font/                   # 字体资源
├── public/                 # 静态资源
├── proxy.ts                # Next.js 16 请求代理（auth token 刷新）
├── AGENTS.md               # UI/UX 规则
└── .cursor/rules/          # Cursor AI 规则
```

#### 路由 — `app/`

```text
app/
├── layout.tsx              # 根布局（Providers、全局样式）
├── providers.tsx           # 根组件包装器（next-theme、shadcn-ui …）
├── (home)/                 # 路由组：首页
│   ├── layout.tsx          # 首页布局（Sidebar、Navbar 注入）
│   └── page.tsx            # 首页
├── auth/                   # 认证相关路由
│   ├── callback/route.ts   # OAuth / Magic Link 回调 Route Handler
│   ├── sign-in/page.tsx    # 登录页
│   └── sign-up/page.tsx    # 注册页
└── <feature>/              # 其他功能模块（按需扩展）
```

#### 组件 — `components/`

```text
components/
├── ui/                     # Shadcn UI 基础组件（CLI 生成，不手动修改）
├── common/                 # 高复用、无业务语义的通用组件
│   ├── MDX/                # Markdown 渲染相关
│   │   ├── mdx-components.tsx
│   │   ├── FileTree.tsx
│   │   ├── mermaid.tsx
│   │   ├── plantuml.tsx
│   │   └── VideoPlay.tsx
│   ├── FeedBack_Dialog.tsx
│   ├── Theme_RadioGroup.tsx
│   └── Stepper_Line.tsx
├── layout/                 # 布局组件
│   ├── Navbar.tsx
│   └── Sidebar.tsx
└── business/               # 业务组件（按实体分子目录）
    ├── user/               # 用户相关
    │   ├── UserDropdownMenu.tsx
    │   ├── UserAvatarUpload.tsx
    │   ├── UserContextMenu.tsx
    │   └── UserHoverCard.tsx
    ├── auth/               # 认证相关
    │   ├── AuthenticationDialog.tsx
    │   ├── Authentication2FACard.tsx
    │   └── AuthenticationOTPDialog.tsx
    └── <feature>/          # 其他业务模块（按需扩展）
```

#### 服务层 — `services/`

```text
services/
├── user/
│   ├── profile.service.ts  # 用户资料
│   └── plan.service.ts     # 用户订阅计划
├── agent/
│   └── providers.service.ts # AI 接入
└── auth.service.ts          # 客户端认证操作（登录/注册/OTP/退出）
```

#### 类型定义 — `types/`

```text
types/
├── user/
│   └── user_profiles.ts    # 用户资料相关类型
├── agent/                  # AI 相关类型
└── chat/                   # 聊天相关类型
```

#### 自定义 Hooks — `hooks/`

```text
hooks/
├── use-mobile.ts
├── use-modal.ts
└── use-fetch.ts
```

#### 工具与 SDK 封装 — `lib/` & `utils/`

```text
lib/
└── utils.ts                # 通用纯函数（cn、formatDate 等）

utils/
└── supabase/               # Supabase SDK 封装
    ├── client.ts            # 客户端 Supabase 实例
    ├── server.ts            # 服务端 Supabase 实例
    └── middleware.ts        # updateSession（proxy.ts 调用）
```

| 约束 | 说明 |
| :--- | :--- |
| **必须** | `lib/` 仅存放无外部依赖的纯工具函数 |
| **必须** | `utils/` 仅存放第三方 SDK 的初始化与封装，按 SDK 分子目录 |
| **必须** | 文件名统一使用 kebab-case |

#### 状态管理 — `stores/`（按需创建）

```text
stores/
├── use-chat-store.ts       # 聊天状态
└── use-settings-store.ts   # 设置状态
```

| 约束 | 说明 |
| :--- | :--- |
| **必须** | 文件名 kebab-case，以 `use-` 开头（Zustand 约定） |
| **必须** | 一个 store 一个文件，按功能域划分 |

#### 文档 — `docs/`

```text
docs/
├── database/
│   └── user_profile.md     # 数据库表结构文档
└── feature/
    └── agent_providers.md  # Agent 接入文档
```

---

### 2. 命名总览

| 类别 | 格式 | 示例 |
| :--- | :--- | :--- |
| 路由文件夹 | kebab-case | `sign-up/`、`auth-callback/` |
| 组件文件 | PascalCase.tsx | `UserDropdownMenu.tsx` |
| 服务文件 | kebab-case.service.ts | `profile.service.ts` |
| 类型文件 | snake_case.ts | `user_profiles.ts` |
| Hook 文件 | use-kebab-case.ts | `use-mobile.ts` |
| Store 文件 | use-kebab-case.ts | `use-chat-store.ts` |
| 工具文件 | kebab-case.ts | `utils.ts`、`client.ts` |
| 文档文件 | snake_case.md | `user_profile.md` |

---

### 3. 业务实现约定

#### 数据库操作（CRUD）

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 所有数据库 CRUD 操作在服务端执行（Server Component / Route Handler） |
| **必须** | 客户端仅允许调用非数据库功能（登录/注册/OTP/退出） |
| **必须** | 认证状态、用户数据由服务端获取，通过 props 向下传递至客户端组件 |
| **永不** | 在客户端使用 `createClient（server）` 或 `cookies()` |
| **永不** | 在客户端组件中 `import` 服务端服务（`services/server/*`） |
| **永不** | 在生产代码中保留 `console.log` |

#### 服务层实现

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 按实体分文件：一个实体对应一个 `.service.ts` |
| **必须** | 使用对象字面量导出，方法内部自行创建 Supabase 实例，调用方无需手动初始化 |
| **必须** | 导出名称统一为实体名：`userService`、`authService`、`agentService` |

```typescript
// ✅ 正确：对象字面量导出，内部管理实例
export const userService = {
  async getProfile(): Promise<UserProfile | null> {
    const supabase = await getSupabase();
    // ...
  },
};

const profile = await userService.getProfile();

// ❌ 错误：工厂函数，调用方需手动初始化
export async function createUserService() { ... }
const svc = await createUserService();
```

#### 通用规范

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 所有 `interface` / `type` 在 `types/` 目录定义，禁止在服务层或组件中内联 |
| **必须** | `types/` 按实体分子目录，与 `services/` 的实体划分保持一致 |
| **必须** | 枚举值使用联合类型（`type PlanType = "Free" | "Premium"`），不使用 `enum` |
| **必须** | 接口字段与数据库表结构完全对齐，不允许遗漏 |
| **必须** | 所有公开方法需有 JSDoc（功能描述 + `@param` + `@returns`） |
| **必须** | 服务文件中仅使用 `import type` 引入类型 |

---

## ✨ UI/UX 规则

> 构建可访问、快速、愉悦的用户界面。

### 1. 设计与实现

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 优先使用项目已配置的 Shadcn UI 组件库（已预优化可访问性与交互行为） |
| **必须** | 色彩优先使用 `globals.css` 中 `@theme` 指令配置的品牌色变量，确保一致性与主题切换 |
| **必须** | Shadcn UI 缺少所需组件时，基于其设计范式和 CSS 变量体系构建 |
| **永不** | 在组件中编写业务逻辑（数据获取、状态管理），业务逻辑必须放在 `services/` 层 |

### 2. 交互相关

#### 键盘支持

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 根据 WAI-ARIA APG 提供完整键盘支持 |
| **必须** | 提供可见焦点环（`:focus-visible`，配合 `:focus-within`） |
| **必须** | 根据 APG 模式管理焦点（陷阱、移动、返回） |
| **永不** | 使用 `outline: none` 而不提供可见焦点替代方案 |

#### 目标区域与输入

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 点击目标 ≥ 24px（移动端 ≥ 44px）；视觉区域不足时扩展点击区域 |
| **必须** | 移动端 `<input>` 字体 ≥ 16px，防止 iOS 自动缩放 |
| **必须** | 设置 `touch-action: manipulation` 防止双击缩放 |
| **应该** | 设置 `-webkit-tap-highlight-color` 匹配设计 |
| **永不** | 禁用浏览器缩放（`user-scalable=no`、`maximum-scale=1`） |

#### 表单交互

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 表单输入具有水合安全性（焦点/值不丢失） |
| **必须** | 加载中按钮显示旋转指示器并保留原始标签文本 |
| **必须** | `<textarea>` 中 `Enter` 换行、`⌘/Ctrl+Enter` 提交；其他输入 `Enter` 直接提交 |
| **必须** | 提交按钮保持启用直到请求开始，然后禁用并显示旋转指示器 |
| **必须** | 接受自由文本输入后再验证——不阻止输入 |
| **必须** | 允许提交不完整表单以触发验证提示 |
| **必须** | 错误信息内联显示在字段旁；提交时焦点移至首个错误处 |
| **必须** | 使用 `autocomplete` + 有意义的 `name`、正确的 `type` 和 `inputmode` |
| **必须** | 导航离开前警告未保存的更改 |
| **必须** | 兼容密码管理器和双因素验证，允许粘贴验证码 |
| **必须** | 修剪值以处理文本扩展带来的尾部空格 |
| **必须** | 复选框/单选按钮无死区，标签 + 控件共享同一个点击目标 |
| **应该** | 为邮箱/验证码/用户名禁用拼写检查 |
| **应该** | 占位符以 `…` 结尾并展示示例格式 |
| **永不** | 阻止在 `<input>` / `<textarea>` 中粘贴 |

#### 状态与导航

| 约束 | 规则 |
| :--- | :--- |
| **必须** | URL 反映状态（可深层链接的过滤器/标签页/分页/展开面板） |
| **必须** | 前进/后退恢复滚动位置 |
| **必须** | 导航链接使用 `<a>` / `<Link>`（支持 Cmd/Ctrl/中键点击） |
| **永不** | 使用 `<div onClick>` 进行导航 |

#### 信息反馈

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 破坏性操作需确认或提供"撤销"窗口 |
| **必须** | 使用礼貌的 `aria-live` 区域处理提示/内联验证 |
| **应该** | 使用乐观 UI，根据响应协调状态；失败时回滚或提供"撤销" |
| **应该** | 需后续操作的选项使用省略号 `…`（如"重命名…"），加载状态同理（"加载中…"） |

#### 触控与拖拽

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 足够大的目标区域与清晰的示能性，避免精细复杂交互 |
| **必须** | 首次工具提示延迟显示，后续同类即时显示 |
| **必须** | 模态框/抽屉中使用 `overscroll-behavior: contain` |
| **必须** | 拖拽期间禁用文本选择，对被拖元素设置 `inert` |
| **必须** | 看起来可点击的元素必须可点击 |

#### 自动聚焦

| 约束 | 规则 |
| :--- | :--- |
| **应该** | 桌面端对单个主要输入项自动聚焦；移动端慎用（会弹出键盘） |

### 3. 动画准则

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 尊重 `prefers-reduced-motion`（提供简化版本或禁用） |
| **必须** | 仅动画合成器友好属性（`transform`、`opacity`） |
| **必须** | 动画可中断且由输入驱动（无自动播放） |
| **必须** | 设置正确的 `transform-origin`（运动从"物理上"应开始的位置开始） |
| **必须** | SVG 变换应用于带 `transform-box: fill-box` 的 `<g>` 包装器 |
| **应该** | 优先 `CSS` > `Web Animations API` > `JS` 库 |
| **应该** | 仅在阐明因果关系或增加设计愉悦感时使用动画 |
| **应该** | 根据变化幅度（大小/距离/触发方式）选择缓动效果 |
| **永不** | 动画布局属性（`top`、`left`、`width`、`height`） |
| **永不** | 使用 `transition: all`，必须明确列出属性 |

### 4. 布局

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 有意识地与网格/基线/边缘对齐，避免随意放置 |
| **必须** | 验证移动端、笔记本、超宽屏（可用 50% 缩放模拟超宽屏） |
| **必须** | 尊重安全区域（`env(safe-area-inset-*)`） |
| **必须** | 避免不必要的滚动条，修复溢出问题 |
| **应该** | 视觉对齐优先；感知优于几何时可调整 ±1px |
| **应该** | 平衡图标/文本组合（权重/大小/间距/颜色） |
| **应该** | 优先弹性/网格布局，而非 JS 测量布局 |

### 5. 内容与可访问性

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 骨架屏反映最终内容结构，避免布局偏移 |
| **必须** | `<title>` 匹配当前页面上下文 |
| **必须** | 无死胡同——始终提供下一步/恢复选项 |
| **必须** | 设计空状态/稀疏状态/密集状态/错误状态 |
| **必须** | 数字比较时使用 `font-variant-numeric: tabular-nums` |
| **必须** | 状态提示具有冗余性（不单靠颜色），图标应有文本标签 |
| **必须** | 即使视觉省略标签，也须有可访问名称 |
| **必须** | 使用 `…` 字符（而非 `...`） |
| **必须** | 标题设置 `scroll-margin-top`，提供"跳转到内容"链接，层级化 `<h1>`–`<h6>` |
| **必须** | 对用户生成内容具有弹性（短/中/极长） |
| **必须** | 使用区域化日期/时间/数字格式（`Intl.DateTimeFormat`、`Intl.NumberFormat`） |
| **必须** | 准确的 `aria-label`，装饰性元素使用 `aria-hidden` |
| **必须** | 纯图标按钮需有描述性的 `aria-label` |
| **必须** | 优先使用原生语义元素（`button`、`a`、`label`、`table`），再考虑 `ARIA` |
| **必须** | 使用不换行空格——`10&nbsp;MB`、`⌘&nbsp;K`、品牌名称 |
| **应该** | 优先内联帮助，工具提示作为最后手段 |
| **应该** | 使用弯引号（`\u201c` `\u201d`），避免孤行/寡行（`text-wrap: balance`） |

### 6. 内容处理

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 文本容器处理长内容（`truncate`、`line-clamp-*`、`break-words`） |
| **必须** | 弹性盒子项需要 `min-w-0` 以实现截断 |
| **必须** | 处理空状态——空字符串/数组不导致 UI 损坏 |

### 7. 性能优化

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 可靠地测量（禁用可能影响运行时的浏览器扩展） |
| **必须** | 跟踪并最小化重新渲染（`React DevTools` / `React Scan`） |
| **必须** | 在 CPU/网络节流条件下分析性能 |
| **必须** | 批量读写布局，避免回流/重绘 |
| **必须** | 变更操作（`POST`/`PATCH`/`DELETE`）目标耗时 < 500ms |
| **必须** | 虚拟化大型列表（> 50 项） |
| **必须** | 预加载首屏图片，懒加载其余图片 |
| **必须** | 防止累积布局偏移（明确图片尺寸） |
| **应该** | 优先使用非受控输入；受控输入确保每次按键开销低廉 |
| **应该** | 对 CDN 域名使用 `<link rel="preconnect">` |
| **应该** | 关键字体使用 `<link rel="preload" as="font">` 配合 `font-display: swap` |
| **应该** | 在 iOS 低功耗模式和 macOS Safari 上测试 |

### 8. 深色模式与主题

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 深色主题在 `<html>` 上设置 `color-scheme: dark` |
| **必须** | 原生 `<select>` 明确设置 `background-color` 和 `color`（修复 Windows 兼容问题） |
| **应该** | `<meta name="theme-color">` 匹配页面背景 |

### 9. 水合安全

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 带 `value` 的输入项需要 `onChange`（或使用 `defaultValue`） |
| **应该** | 保护日期/时间渲染，防止水合不匹配 |

### 10. 视觉设计细节

| 约束 | 规则 |
| :--- | :--- |
| **必须** | 可访问的图表（色盲友好配色方案） |
| **必须** | 满足对比度要求——优先使用 `APCA` 而非 `WCAG 2` |
| **必须** | `:hover` / `:active` / `:focus` 时增加对比度 |
| **应该** | 使用分层阴影（环境光 + 直射光） |
| **应该** | 半透明边框 + 阴影实现清晰边缘 |
| **应该** | 嵌套圆角——子元素 ≤ 父元素，保持同心 |
| **应该** | 色调一致性——边框/阴影/文本颜色向背景色调靠拢 |
| **应该** | 浏览器 UI 颜色与页面背景匹配 |
| **应该** | 避免深色渐变产生条带（必要时使用背景图片） |
