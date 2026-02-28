# 面向用户的产品介绍与使用文档模块 · 功能规划

> 📅 创建日期：2026-02-27  
> 🔄 最新更新：2026-02-27  
> 📌 所属模块：Introduce · M11 使用文档页面  
> 🔗 关联文档：[项目深度功能规划](../../global/项目深度功能规划.md) · [PROJECT_PLAN](../../global/PROJECT_PLAN.md) · [全端UI布局指南](../../global/全端UI全局与核心布局指南.md) · [工作流AI交互规划](../core/工作流AI交互规划.md) · [画布编辑交互](../workflow_canvas/02-canvas-editor-interaction-design.md)

---

## 📑 目录

- [一、模块定位与兼容性分析](#一模块定位与兼容性分析)
- [二、用户端入口与路由设计](#二用户端入口与路由设计)
- [三、页面结构与 UI 设计](#三页面结构与-ui-设计)
- [四、文档内容体系](#四文档内容体系)
- [五、技术实现方案（兼容现有架构）](#五技术实现方案兼容现有架构)
- [六、应用内帮助联动机制](#六应用内帮助联动机制)
- [七、移动端适配](#七移动端适配)
- [八、数据反馈闭环](#八数据反馈闭环)
- [九、SEO 与可发现性](#九seo-与可发现性)
- [十、实施优先级与任务分解](#十实施优先级与任务分解)

---

## 一、模块定位与兼容性分析

### 1.1 在项目架构中的位置

根据 `PROJECT_PLAN.md` 既有规划，文档模块已被预设为前端路由的一部分：

```
frontend/src/app/
  ├── (auth)/             # 认证页面组
  ├── (dashboard)/        # 主面板页面组（需登录）
  │   ├── workspace/      # 工作流画布
  │   ├── templates/      # 模板广场
  │   ├── history/        # 执行历史
  │   └── settings/       # 用户设置
  ├── docs/               # ← 使用文档 (SSG)（本模块）
  ├── layout.tsx
  └── page.tsx            # 首页 Landing
```

在 `项目深度功能规划.md` 模块优先级中：

```
P2 增强功能（第9-12周）
 ├── M11 使用文档页面    ← 本模块
 ├── M12 归档记忆系统
 ├── M13 管理后台
 └── M14 数据分析面板
```

### 1.2 兼容性关键约束

本模块必须完全兼容项目现有技术栈和设计体系，不得引入破坏性依赖。

| 约束维度 | 项目现状 | 本模块策略 |
|---------|---------|-----------|
| **前端框架** | Next.js 16.1 · App Router | 使用 App Router 的 `app/docs/` 路由组 |
| **UI 组件库** | Shadcn/UI + Tailwind CSS v4 | 复用 Shadcn 组件（Sidebar/Accordion/ScrollArea），不引入新 UI 库 |
| **色彩体系** | OKLCH 色彩空间 | 复用全局 CSS 变量 `--foreground` / `--muted` / `--accent` 等 |
| **渲染策略** | 画布 CSR · Landing SSG | 文档页面采用 **SSG**（构建时静态生成），不增加运行时负担 |
| **状态管理** | Zustand | 本模块无需全局状态，文档页面为纯静态展示 |
| **本地缓存** | localforage (IndexedDB) | 文档页面不使用 localforage，零侵入 |
| **认证** | HttpOnly Cookie JWT | 文档页面 **不需要登录** 即可访问（公开页面） |
| **动画** | Framer Motion | 文档页面过渡使用 `motion.div` 保持一致体验 |
| **部署** | 阿里云 ECS · PM2 + Nginx | SSG 页面直接由 Nginx 缓存，无后端 API 调用 |
| **包管理** | pnpm | 文档所需依赖通过 pnpm 安装 |

### 1.3 新增依赖分析（最小化原则）

| 依赖 | 用途 | 是否已在项目中 | 体积影响 |
|------|------|--------------|---------|
| `@next/mdx` | MDX 编译支持 | ❌ 需新增 | ~50KB（编译时依赖，不进 bundle） |
| `@mdx-js/react` | MDX 运行时 | ❌ 需新增 | ~8KB |
| `remark-gfm` | GitHub Flavored Markdown | ✅ **已规划**（02-yaml-config...） | 复用 |
| `rehype-slug` | 标题自动加锚点 | ❌ 需新增 | ~2KB |
| `rehype-autolink-headings` | 标题可点击跳转 | ❌ 需新增 | ~3KB |
| `shiki` | 代码语法高亮 | ✅ **已规划**（02-yaml-config...） | 复用 |

> ✅ **结论**：仅新增 `@next/mdx` + `@mdx-js/react` + 两个 rehype 插件，合计 < 15KB 运行时增量，且与已规划的 Markdown 渲染能力完全互补。

---

## 二、用户端入口与路由设计

### 2.1 入口分布

用户可以通过以下 **7 个入口** 抵达文档模块：

| # | 入口位置 | 触发方式 | 跳转目标 |
|---|---------|---------|---------|
| 1 | **Landing 页导航栏** | 顶栏 "使用指南" 链接 | `/docs` 文档首页 |
| 2 | **Dashboard 顶栏** | 顶栏 `?` 帮助图标 | `/docs` 或上下文相关页面 |
| 3 | **画布工具栏** | 画布右上角 "帮助" 按钮 | `/docs/features/canvas-basics` |
| 4 | **空状态引导** | 新用户工作流列表为空时 | `/docs/getting-started` |
| 5 | **模型选择器** | 锁定模型旁 "了解会员" 链接 | `/docs/billing/plans` |
| 6 | **错误提示** | 操作异常弹窗中的 "查看帮助" | `/docs/faq#对应锚点` |
| 7 | **页脚** | Landing 页/全局页脚 | `/docs` |

### 2.2 路由结构

```
app/docs/           # 独立路由组（不在 (dashboard) 内，无需登录）
  ├── layout.tsx    # 文档专属 Layout（左侧导航 + 右侧 TOC）
  ├── page.tsx      # /docs → 文档首页
  └── [...slug]/
      └── page.tsx  # /docs/getting-started/register → 动态渲染
```

#### 完整路由表

| 路由 | 对应内容 | SSG |
|------|---------|-----|
| `/docs` | 文档首页：产品简介 + 快速导航 | ✅ |
| `/docs/getting-started` | 快速入门索引 | ✅ |
| `/docs/getting-started/register` | 注册与登录 | ✅ |
| `/docs/getting-started/first-workflow` | 创建第一个工作流 | ✅ |
| `/docs/getting-started/quick-tour` | 5 分钟速通 | ✅ |
| `/docs/features` | 功能指南索引 | ✅ |
| `/docs/features/canvas` | 画布操作 | ✅ |
| `/docs/features/node-editing` | 节点编辑与提示词 | ✅ |
| `/docs/features/model-selection` | 模型选择指南 | ✅ |
| `/docs/features/human-in-the-loop` | 人机协同 | ✅ |
| `/docs/features/background-run` | 后台运行 | ✅ |
| `/docs/features/shortcuts` | 快捷键大全 | ✅ |
| `/docs/billing` | 会员与付费索引 | ✅ |
| `/docs/billing/plans` | 会员方案对比 | ✅ |
| `/docs/billing/student` | 学生优惠 (.edu) | ✅ |
| `/docs/billing/add-ons` | 按量加购 | ✅ |
| `/docs/billing/expiration` | 到期与数据保留 | ✅ |
| `/docs/scenarios` | 使用场景索引 | ✅ |
| `/docs/scenarios/exam-review` | 期末复习 | ✅ |
| `/docs/scenarios/research` | 考研备考 | ✅ |
| `/docs/scenarios/skill-learning` | 技能学习 | ✅ |
| `/docs/faq` | 常见问题 | ✅ |
| `/docs/changelog` | 更新日志 | ✅ (ISR 30min) |

> 📐 合计 **23 个路由，20+ 篇 MDX 内容页**

### 2.3 与 `(dashboard)` 路由组的隔离

```
app/
  ├── layout.tsx              # 根 Layout（全局字体、主题、metadata）
  ├── page.tsx                # Landing（公开）
  │
  ├── (auth)/                 # 认证组（公开，独立 Layout）
  │   └── layout.tsx
  │
  ├── (dashboard)/            # 主面板组（需登录，三栏 Layout）
  │   └── layout.tsx          # 带侧边栏 + 画布的 Layout
  │
  └── docs/                   # ← 文档组（公开，独立 Layout）
      └── layout.tsx          # 文档专属 Layout（完全独立于 Dashboard）
```

**关键设计**：
- `docs/` **不在** `(dashboard)/` 路由组内 → **不继承** Dashboard 的三栏 Layout
- `docs/` 拥有**自己独立的 `layout.tsx`** → 不影响现有 Landing / Dashboard / Auth 的布局
- 文档页面 **无需登录** 即可访问 → 不触发 `middleware.ts` 路由守卫
- 文档 Layout 复用项目全局主题（暗色/亮色切换） → 通过根 `layout.tsx` 继承

---

## 三、页面结构与 UI 设计

### 3.1 桌面端布局（与现有设计体系一致）

参照 `全端UI全局与核心布局指南.md` 中的设计理念，文档页面采用 Shadcn 风格三栏布局：

```
┌──────────────────────────────────────────────────────────────────┐
│  StudySolo                 使用指南              🔍   🌙/☀️     │  ← 文档顶栏（共享 Navbar 组件）
├──────────────┬───────────────────────────────────┬───────────────┤
│              │                                   │               │
│  📚 使用指南  │  文档 > 核心功能 > 画布操作        │  📑 本页目录   │
│              │  ─────────────────────────        │               │
│  🚀 快速入门  │                                   │  · 画布导航    │
│    注册登录   │  # 画布基础操作                    │  · 节点操作    │
│    第一个工作流│                                   │  · 连线操作    │
│    速通教程   │  > 掌握画布操作，让学习工作流       │  · 快捷键      │
│              │  > 在你手中游刃有余。               │               │
│  📖 核心功能 ▾│                                   │               │
│    画布操作 ← │  ## 画布导航                       │               │
│    节点编辑   │                                   │               │
│    模型选择   │  - **平移**：按住空白区域拖动       │               │
│    人机协同   │  - **缩放**：滚轮滚动               │               │
│    后台运行   │  - **适配**：Ctrl + 0              │               │
│    快捷键    │                                   │               │
│              │  ## 节点操作                       │               │
│  💎 会员付费  │                                   │               │
│    方案对比   │  - **选中**：单击节点               │               │
│    学生优惠   │  - **编辑**：双击节点               │               │
│    加购      │                                   │               │
│    到期说明   │                                   │               │
│              │  ──────────────────                │               │
│  🎓 使用场景  │  ← 上一篇             下一篇 →    │               │
│              │  速通教程              节点编辑      │               │
│  ❓ FAQ      │                                   │               │
│  📋 更新日志  │  ── 这篇文档有帮助吗？ ──          │               │
│              │  [👍 有帮助]    [👎 需改进]          │               │
├──────────────┴───────────────────────────────────┴───────────────┤
│  © 2026 @1037Solo team · studyflow.1037solo.com                  │
│  黑ICP备2025046407号-3 · feedback@1037solo.com                    │
└──────────────────────────────────────────────────────────────────┘
```

**布局参数**（与项目 UI 体系一致）：

| 区域 | 宽度 | 说明 |
|------|------|------|
| 左侧导航 | ~260px（可收起至 0） | Shadcn Sidebar 组件复用 |
| 中间内容 | 弹性填充，max-width 768px | 阅读舒适的最大宽度 |
| 右侧 TOC | ~200px（≤1280px 时隐藏） | 滚动跟随高亮 |

### 3.2 文档顶栏

复用项目已有的 Navbar 组件，但在 `docs/layout.tsx` 中做微调：

```typescript
// docs/layout.tsx 概念
export default function DocsLayout({ children }) {
  return (
    <>
      {/* 复用全局 Navbar，但高亮 "使用指南" 菜单项 */}
      <Navbar activeItem="docs" />

      <div className="flex max-w-screen-2xl mx-auto">
        {/* 左侧：文档导航侧边栏 */}
        <DocsSidebar />

        {/* 中间：MDX 内容 */}
        <main className="flex-1 max-w-3xl mx-auto px-6 py-8">
          {children}
        </main>

        {/* 右侧：当前页面 TOC */}
        <DocsTOC />
      </div>
    </>
  );
}
```

### 3.3 文档首页设计

```
/docs  文档首页

┌──────────────────────────────────────────────────────┐
│                                                      │
│           📚 StudySolo 使用指南                        │
│                                                      │
│   一句话 → 一个完整的学习工作流                         │
│   从注册到产出，这里有你需要的一切。                     │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ 🚀 快速入门   │ │ 📖 核心功能   │ │ 💎 会员付费   │ │
│  │              │ │              │ │              │ │
│  │ 3 步开始你的  │ │ 画布、节点、  │ │ 方案对比、    │ │
│  │ AI 学习之旅  │ │ 模型、提示词  │ │ 学生优惠     │ │
│  │              │ │              │ │              │ │
│  │ [开始阅读 →]  │ │ [了解更多 →]  │ │ [查看方案 →]  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
│                                                      │
│  ┌──────────────┐ ┌──────────────┐                  │
│  │ 🎓 使用场景   │ │ ❓ 常见问题   │                  │
│  │              │ │              │                  │
│  │ 复习、考研、  │ │ 账号、工作流、 │                  │
│  │ 技能学习     │ │ 付费、技术    │                  │
│  │              │ │              │                  │
│  │ [查看场景 →]  │ │ [查找答案 →]  │                  │
│  └──────────────┘ └──────────────┘                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.4 文档搜索

```
┌──────────────────────────────────────────────┐
│  🔍 搜索文档...                   Ctrl + K    │
│  ─────────────────────────────────────────── │
│  🕐 最近搜索                                  │
│     画布操作                                  │
│     模型选择                                  │
│  ─────────────────────────────────────────── │
│  📖 热门文档                                  │
│     🚀 创建第一个工作流                        │
│     🧠 模型选择指南                            │
│     💎 会员方案对比                            │
└──────────────────────────────────────────────┘

输入关键词后：

┌──────────────────────────────────────────────┐
│  🔍 节点编辑                                  │
│  ─────────────────────────────────────────── │
│  📖 节点编辑与提示词                           │
│     "双击任意节点，进入编辑模式..."             │
│  ─────────────────────────────────────────── │
│  📖 画布基础操作                              │
│     "...选中节点后按 Delete 键删除..."          │
│  ─────────────────────────────────────────── │
│  ❓ 节点的输出不满意怎么办？                    │
│     "三个方法：暂停手动编辑..."                 │
└──────────────────────────────────────────────┘
```

**技术方案**：使用 **FlexSearch**（纯前端全文搜索），构建时索引所有 MDX 内容。无需后端 API。

---

## 四、文档内容体系

### 4.1 按产品功能映射的内容结构

> **每篇文档严格定位其对应的产品功能模块，确保与实际工作的用户体验一一匹配。**

| 分类 | 文档 slug | 对应产品功能 | 内容定位 |
|------|----------|------------|---------|
| **快速入门** | `getting-started/register` | M2 用户认证 | 邮箱注册、验证码、.edu 认证流程 |
| | `getting-started/first-workflow` | M4+M5 AI 引擎 | 输入目标 → AI 规划 → 执行 → 查看 |
| | `getting-started/quick-tour` | 全局 | 产品核心流程 5 分钟速览 |
| **核心功能** | `features/canvas` | M3 工作流画布 | 平移、缩放、导航、小地图 |
| | `features/node-editing` | M3 + 画布编辑交互 | 双击编辑、提示词修改、参数调节 |
| | `features/model-selection` | AI 模型管理 | 模型能力对比、如何选择、权限说明 |
| | `features/human-in-the-loop` | HITL 机制 | 暂停、覆写、继续执行 |
| | `features/background-run` | 后台运行 | 后台执行、进度查看、退出自动停止 |
| | `features/shortcuts` | 画布编辑 | 完整快捷键清单 |
| **会员付费** | `billing/plans` | 付费体系 1.1 | 四级会员权益对比表 |
| | `billing/student` | 学生特权 1.3 | .edu 认证、学期付、免费满血模型 |
| | `billing/add-ons` | 加购体系 1.2 | 存储/工作流/并发加购说明 |
| | `billing/expiration` | 过期机制 1.3 | 数据保留 0-22 天策略 |
| **使用场景** | `scenarios/exam-review` | 学习工作流 | 示例：期末复习场景 |
| | `scenarios/research` | 学习工作流 | 示例：考研知识体系构建 |
| | `scenarios/skill-learning` | 学习工作流 | 示例：新技能快速入门 |
| **FAQ** | `faq` | 全局 | 账号/工作流/付费/技术 Q&A |
| **Changelog** | `changelog` | 全局 | 版本更新记录 |

### 4.2 MDX 文件规范

每篇 `.mdx` 文件遵循统一的 frontmatter 规范：

```mdx
---
title: "画布基础操作"
description: "掌握工作流画布的平移、缩放、节点操作等核心交互"
category: "features"
order: 1
icon: "canvas"
lastUpdated: "2026-02-27"
prev: { slug: "getting-started/quick-tour", title: "速通教程" }
next: { slug: "features/node-editing", title: "节点编辑" }
---

# 画布基础操作

> 掌握画布操作，让学习工作流在你手中游刃有余。

...内容...
```

### 4.3 内容中可使用的自定义 MDX 组件

| 组件 | 用途 | 示例 |
|------|------|------|
| `<Callout>` | 提示/警告/信息框 | 💡 小技巧、⚠️ 注意事项 |
| `<Steps>` | 步骤列表 | 注册流程 1-2-3 |
| `<ShortcutTable>` | 快捷键对照表 | Ctrl+Z 撤销 |
| `<PlanCompare>` | 会员方案对比表 | 交互式权益对比 |
| `<Video>` | 嵌入操作演示 GIF/视频 | 画布拖拽演示 |
| `<ModelCompare>` | 模型能力对比 | 免费/付费模型差异 |
| `<LinkCard>` | 卡片式链接 | 跳转到相关文档 |

---

## 五、技术实现方案（兼容现有架构）

### 5.1 MDX 编译链

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  .mdx 文件   │ →  │  @next/mdx    │ →  │  SSG 静态页   │
│  (content/)  │    │  + remark     │    │  (构建时生成)  │
│              │    │  + rehype     │    │              │
│              │    │  + shiki      │    │              │
└─────────────┘    └──────────────┘    └─────────────┘
```

### 5.2 目录结构

```
frontend/src/
  ├── content/                          # MDX 源文件目录（新增）
  │   └── docs/
  │       ├── index.mdx                 # 文档首页
  │       ├── getting-started/
  │       │   ├── register.mdx
  │       │   ├── first-workflow.mdx
  │       │   └── quick-tour.mdx
  │       ├── features/
  │       │   ├── canvas.mdx
  │       │   ├── node-editing.mdx
  │       │   ├── model-selection.mdx
  │       │   ├── human-in-the-loop.mdx
  │       │   ├── background-run.mdx
  │       │   └── shortcuts.mdx
  │       ├── billing/
  │       │   ├── plans.mdx
  │       │   ├── student.mdx
  │       │   ├── add-ons.mdx
  │       │   └── expiration.mdx
  │       ├── scenarios/
  │       │   ├── exam-review.mdx
  │       │   ├── research.mdx
  │       │   └── skill-learning.mdx
  │       ├── faq.mdx
  │       └── changelog.mdx
  │
  ├── app/
  │   └── docs/                         # 文档路由（新增）
  │       ├── layout.tsx                # 文档 Layout（复用 Navbar）
  │       ├── page.tsx                  # 文档首页
  │       └── [...slug]/
  │           └── page.tsx              # 动态 MDX 渲染
  │
  └── components/
      └── docs/                         # 文档专属组件（新增）
          ├── DocsSidebar.tsx           # 左侧导航
          ├── DocsTOC.tsx              # 右侧目录
          ├── DocsSearch.tsx           # 搜索（Ctrl+K）
          ├── DocsBreadcrumb.tsx       # 面包屑
          ├── DocsPagination.tsx       # 上/下篇导航
          ├── DocsFeedback.tsx         # "有帮助吗"反馈
          └── mdx/                     # MDX 自定义组件
              ├── Callout.tsx
              ├── Steps.tsx
              ├── ShortcutTable.tsx
              ├── PlanCompare.tsx
              ├── Video.tsx
              └── LinkCard.tsx
```

### 5.3 next.config.ts 配置

```typescript
// next.config.ts 补充 MDX 支持
import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    ],
  },
});

const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  // ...existing config
};

export default withMDX(nextConfig);
```

### 5.4 动态路由核心实现

```typescript
// app/docs/[...slug]/page.tsx
import { notFound } from 'next/navigation';
import { getDocBySlug, getAllDocSlugs } from '@/lib/docs';

// SSG：构建时生成所有文档页面
export async function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return slugs.map((slug) => ({ slug: slug.split('/') }));
}

// SEO Metadata
export async function generateMetadata({ params }) {
  const doc = getDocBySlug(params.slug.join('/'));
  if (!doc) return {};
  return {
    title: `${doc.title} | StudySolo 使用指南`,
    description: doc.description,
    openGraph: {
      title: doc.title,
      description: doc.description,
      type: 'article',
      url: `https://studyflow.1037solo.com/docs/${params.slug.join('/')}`,
    },
  };
}

export default async function DocPage({ params }) {
  const slug = params.slug.join('/');
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  const { default: MDXContent } = await import(
    `@/content/docs/${slug}.mdx`
  );

  return (
    <article className="prose dark:prose-invert max-w-none">
      <DocsBreadcrumb category={doc.category} title={doc.title} />
      <MDXContent />
      <DocsPagination prev={doc.prev} next={doc.next} />
      <DocsFeedback slug={slug} />
    </article>
  );
}
```

### 5.5 文档导航数据

```typescript
// lib/docs-nav.ts — 导航树结构
export const docsNav = [
  {
    title: '快速入门',
    icon: 'rocket',
    items: [
      { title: '注册与登录', slug: 'getting-started/register' },
      { title: '创建第一个工作流', slug: 'getting-started/first-workflow' },
      { title: '5 分钟速通', slug: 'getting-started/quick-tour' },
    ],
  },
  {
    title: '核心功能',
    icon: 'book',
    items: [
      { title: '画布操作', slug: 'features/canvas' },
      { title: '节点编辑与提示词', slug: 'features/node-editing' },
      { title: '模型选择指南', slug: 'features/model-selection' },
      { title: '人机协同', slug: 'features/human-in-the-loop' },
      { title: '后台运行', slug: 'features/background-run' },
      { title: '快捷键大全', slug: 'features/shortcuts' },
    ],
  },
  {
    title: '会员与付费',
    icon: 'gem',
    items: [
      { title: '会员方案对比', slug: 'billing/plans' },
      { title: '学生优惠', slug: 'billing/student' },
      { title: '按量加购', slug: 'billing/add-ons' },
      { title: '到期与数据保留', slug: 'billing/expiration' },
    ],
  },
  {
    title: '使用场景',
    icon: 'graduation-cap',
    items: [
      { title: '期末复习', slug: 'scenarios/exam-review' },
      { title: '考研备考', slug: 'scenarios/research' },
      { title: '技能学习', slug: 'scenarios/skill-learning' },
    ],
  },
  { title: '常见问题', icon: 'help-circle', slug: 'faq' },
  { title: '更新日志', icon: 'clipboard', slug: 'changelog' },
];
```

---

## 六、应用内帮助联动机制

### 6.1 上下文感知帮助

当用户在应用内的特定位置执行操作或遇到问题时，帮助系统**感知当前上下文**，引导至最相关的文档：

| 触发位置 | 触发条件 | 跳转文档 | 引导方式 |
|---------|---------|---------|---------|
| 画布页面 | 首次进入 | `/docs/features/canvas` | Tooltip "首次使用？查看画布操作指南" |
| 节点编辑面板 | 首次打开 | `/docs/features/node-editing` | 编辑区顶部的帮助提示条 |
| 模型选择器 | 点击锁定模型 | `/docs/billing/plans` | 选项旁 "了解会员 →" 链接 |
| 工作流失败 | 节点执行出错 | `/docs/faq#工作流相关` | 错误弹窗中的帮助链接 |
| 空工作流列表 | 无工作流时 | `/docs/getting-started` | 空状态引导卡片 |
| 注册页 | .edu 邮箱输入中 | `/docs/billing/student` | 表单下方提示 "学生专享福利 →" |

### 6.2 实现方式

```typescript
// 帮助按钮组件（复用到多个位置）
interface HelpLinkProps {
  docSlug: string;
  label?: string;
  variant?: 'inline' | 'tooltip' | 'banner';
}

export function HelpLink({ docSlug, label = '查看帮助', variant = 'inline' }: HelpLinkProps) {
  return (
    <Link
      href={`/docs/${docSlug}`}
      target="_blank"
      className="text-sm text-muted-foreground hover:text-accent underline-offset-4 hover:underline"
    >
      {label} →
    </Link>
  );
}
```

### 6.3 首次使用引导系统（Onboarding Tips）

利用 `localStorage` 记录用户是否首次使用某功能，首次使用时在关键位置显示引导 Tooltip：

```typescript
// hooks/use-first-visit.ts
export function useFirstVisit(featureKey: string) {
  const [isFirst, setIsFirst] = useState(false);

  useEffect(() => {
    const key = `studysolo_visited_${featureKey}`;
    if (!localStorage.getItem(key)) {
      setIsFirst(true);
      localStorage.setItem(key, 'true');
    }
  }, [featureKey]);

  return isFirst;
}
```

> ⚠️ 这里使用 `localStorage`（非 `HttpOnly Cookie`）是合理的：它仅存储**非敏感的 UI 偏好数据**，不涉及认证信息。完全符合项目的安全策略。

---

## 七、移动端适配

参照 `全端UI全局与核心布局指南.md` 中的移动端设计原则：

### 7.1 移动端布局

```
移动端 /docs (< 768px)

┌──────────────────────┐
│ ☰  使用指南  🔍  🌙  │  ← 顶栏（☰ 控制导航展开）
├──────────────────────┤
│                      │
│  画布基础操作         │  ← 面包屑隐藏，仅显示标题
│                      │
│  ## 画布导航          │
│                      │
│  - 平移：按住拖动     │  ← 全宽内容，padding 适配
│  - 缩放：双指捏合     │
│                      │
│  ...                 │
│                      │
│  ← 速通教程  节点编辑→ │
│                      │
│  有帮助吗？           │
│  [👍]     [👎]        │
│                      │
├──────────────────────┤
│  📚  🚀  💎  ❓  📋   │  ← 底部导航（分类快捷入口）
└──────────────────────┘
```

### 7.2 适配策略

| 元素 | 桌面端 | 移动端 |
|------|--------|--------|
| 左侧导航 | 常驻展示 260px | 点击 ☰ 抽屉展开 (Drawer) |
| 右侧 TOC | 常驻展示 200px | **隐藏**（通过标题点击滚动替代） |
| 搜索 | 顶栏搜索框 | 顶栏图标 → 全屏搜索 Overlay |
| 面包屑 | 完整路径 | 仅显示当前页标题 |
| 底部导航 | 无 | 分类快捷入口（5 图标） |
| 代码块 | 正常展示 | 横向滚动 |

### 7.3 使用 Tailwind v4 断点

```css
/* 文档布局响应式 */
.docs-layout {
  display: flex;
}
.docs-sidebar {
  width: 260px;
  @media (max-width: 768px) {
    display: none;  /* 移动端隐藏，由 Drawer 替代 */
  }
}
.docs-toc {
  width: 200px;
  @media (max-width: 1280px) {
    display: none;  /* 中等屏幕隐藏 */
  }
}
```

---

## 八、数据反馈闭环

### 8.1 文档反馈收集

每篇文档底部的 "有帮助吗" 反馈数据写入数据库，用于分析文档质量：

```sql
-- 文档反馈表（轻量，与 Admin Panel 集成）
CREATE TABLE doc_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_slug TEXT NOT NULL,           -- 文档路径
  is_helpful BOOLEAN NOT NULL,     -- true=有帮助 / false=需改进
  user_id UUID REFERENCES user_profiles(id), -- 可选（未登录用户为 NULL）
  feedback_text TEXT,               -- 可选文字反馈
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_doc_feedback_slug ON doc_feedback (doc_slug, is_helpful);

-- RLS：任何人可写，仅 admin 可读
ALTER TABLE doc_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_feedback_insert" ON doc_feedback FOR INSERT WITH CHECK (true);
```

### 8.2 后端 API

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| `POST` | `/api/docs/feedback` | 提交文档反馈 | 公开（可匿名） |
| `GET` | `/api/admin/docs/feedback` | 查看反馈统计 | Admin |

### 8.3 Admin Panel 集成

在管理后台 → 新增 "文档反馈" 面板：

```
┌──────────────────────────────────────────────┐
│  📚 文档反馈统计                              │
│                                              │
│  平均有帮助率：87.3%                           │
│                                              │
│  低分文档（需优化）：                           │
│  ❗ /docs/features/background-run   62.1%     │
│  ❗ /docs/billing/add-ons           71.5%     │
│                                              │
│  高分文档：                                    │
│  ⭐ /docs/getting-started/first-workflow 96%  │
│  ⭐ /docs/features/canvas             93%    │
└──────────────────────────────────────────────┘
```

---

## 九、SEO 与可发现性

### 9.1 SEO 技术方案

| 策略 | 实现方式 |
|------|---------|
| **SSG 静态 HTML** | 构建时生成，搜索引擎直接索引 |
| **Title + Description** | 每篇 MDX frontmatter 自动映射 `<head>` |
| **OG + Twitter Card** | `generateMetadata()` 中自动生成 |
| **JSON-LD 结构化数据** | FAQ 页使用 `FAQPage` Schema |
| **面包屑 Schema** | `BreadcrumbList` 结构化数据 |
| **Sitemap** | Next.js 内置 sitemap 生成器包含 `/docs/*` |
| **Canonical URL** | 每页设置唯一规范 URL |

### 9.2 搜索引擎优化目标

| 关键词 | 目标排名 | 策略 |
|--------|---------|------|
| "StudySolo 怎么用" | Top 3 | 首页/快速入门 SEO 优化 |
| "AI 学习工作流" | Top 10 | 使用场景页面长尾词 |
| "StudySolo 学生优惠" | Top 3 | 学生优惠页面精准优化 |
| "StudySolo 价格" | Top 3 | 会员方案页面精准优化 |

---

## 十、实施优先级与任务分解

### Phase A — 文档骨架（P2·第9周）

| # | 任务 | 验收标准 |
|---|------|---------|
| A1 | 安装 `@next/mdx` + `rehype-slug` + `rehype-autolink-headings` | `pnpm dev` 正常，MDX 文件可渲染 |
| A2 | 配置 `next.config.ts` MDX 支持 | `.mdx` 文件在 App Router 中可作为页面 |
| A3 | 创建 `app/docs/layout.tsx` 文档 Layout | `/docs` 路由独立于 Dashboard，有自己的侧边栏布局 |
| A4 | 创建 `DocsSidebar` 侧边栏（复用 Shadcn Sidebar） | 导航树正常展示，当前页高亮 |
| A5 | 创建 `DocsTOC` 右侧目录（滚动跟随） | 标题提取正确，点击跳转，滚动高亮 |
| A6 | 创建 `[...slug]/page.tsx` 动态 MDX 渲染 | 任何 slug 对应的 MDX 可正确渲染 |
| A7 | 编写 `content/docs/index.mdx` 文档首页 | `/docs` 页面正常显示首页卡片式导航 |

### Phase B — 核心内容页（P2·第10周）

| # | 任务 | 验收标准 |
|---|------|---------|
| B1 | MDX 自定义组件：Callout / Steps / ShortcutTable | 组件在 MDX 中正常渲染 |
| B2 | 快速入门 3 篇（register / first-workflow / quick-tour） | 内容完整，步骤配截图 |
| B3 | 核心功能 6 篇（canvas / node-editing / model-selection / hitl / bg-run / shortcuts） | 覆盖所有核心功能 |
| B4 | 会员付费 4 篇（plans / student / add-ons / expiration） | 与 `工作流AI交互规划.md` 中的定价一致 |
| B5 | `DocsPagination` 上/下篇导航 | 文档间前后衔接 |
| B6 | `DocsBreadcrumb` 面包屑 | 路径正确展示 |

### Phase C — 增强体验（P2·第11周）

| # | 任务 | 验收标准 |
|---|------|---------|
| C1 | `DocsSearch` 搜索（FlexSearch + Ctrl+K） | 搜索结果即时展示，可键盘导航 |
| C2 | FAQ 页 + JSON-LD `FAQPage` Schema | 结构化数据 Google 识别 |
| C3 | 使用场景 3 篇（exam / research / skill） | 覆盖核心用户画像 |
| C4 | `DocsFeedback` 反馈组件 + 后端 API | 反馈数据入库 |
| C5 | Changelog 页面（ISR 30min） | 更新日志正常展示 |
| C6 | 移动端适配（Drawer 侧边栏 + 底部导航） | 移动端体验正常 |
| C7 | Landing 页 / Navbar 入口接入 | 用户可从多入口进入文档 |
| C8 | SEO 收尾（Sitemap / Canonical / OG） | Lighthouse SEO ≥ 90 分 |

---

> 📌 **文档关系**
>
> | 文档 | 定位 |
> |------|------|
> | **本文（使用文档模块规划）** | 📚 M11 使用文档页面的完整功能实现规划 |
> | `../../global/项目深度功能规划.md` | 🧭 M11 的全局定位（P2 第9-12周） |
> | `../../global/PROJECT_PLAN.md` | 🔧 `app/docs/` 路由预设 + MDX/SSG 技术方案 |
> | `../../global/全端UI全局与核心布局指南.md` | 🎨 UI 设计体系（三栏布局/移动端适配/组件库） |
> | `../workflow_canvas/02-canvas-editor-interaction-design.md` | 🎨 画布编辑交互（文档中"画布操作""节点编辑"等页面的功能来源） |
> | `../core/工作流AI交互规划.md` | 🔄 付费体系（文档中"会员付费"系列页面的数据来源） |
> | `../core/节点分析.md` | 🧩 节点类型体系（文档中"节点类型"页面的功能来源） |
> | `../notice/01-notice-system-design.md` | 🔔 公告系统（文档入口与帮助按钮可联动公告） |
> | `../admin/01-admin-panel-design.md` | 🛠️ 后台面板（文档反馈数据在 Admin 中可视化） |
