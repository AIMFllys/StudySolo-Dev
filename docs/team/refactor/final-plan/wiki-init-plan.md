# Wiki 初始化详细计划

> 属于 Phase 5 的 Task 5.2（队友 A 主导）
> 前置依赖：Phase 3（前端架构重构）完成
> 预估时间：5-7 天
> GitHub Issue：[#10](https://github.com/AIMFllys/StudySolo-Dev/issues/10)
> 方案确认：**Next.js Route Group 嵌入主前端**（独立子项目方案已废弃）

---

## 目标 Tree 结构（完整）

> [!IMPORTANT]
> 以下是 Wiki 实施后的完整目标目录结构。所有后续 AI 对齐以此为准。

```
StudySolo/
│
├── frontend/src/
│   │
│   ├── app/
│   │   ├── layout.tsx                        ← 根 Layout（Theme + Auth + Toaster）
│   │   ├── (auth)/                           ← 认证路由组（现有）
│   │   ├── (admin)/                          ← 管理后台路由组（现有）
│   │   ├── (dashboard)/                      ← 主应用路由组（现有，含 Sidebar）
│   │   │
│   │   └── (wiki)/                           ← ✨ Wiki Route Group（新增）
│   │       └── wiki/                         ← 实际 URL 前缀 /wiki
│   │           ├── layout.tsx                ← Wiki 专属 3 栏布局（不继承 Sidebar）
│   │           ├── page.tsx                  ← /wiki → 首页（文档目录 + 全局搜索）
│   │           ├── loading.tsx               ← Wiki 页面加载态
│   │           └── [...slug]/
│   │               └── page.tsx              ← /wiki/getting-started/quick-start
│   │
│   ├── components/
│   │   ├── layout/                           ← 主应用 Layout 组件（现有，不碰）
│   │   ├── ui/                               ← shadcn UI 组件（现有）
│   │   ├── workflow/                         ← 工作流组件（现有）
│   │   │
│   │   └── wiki/                             ← ✨ Wiki 专属组件（新增）
│   │       ├── WikiLayout.tsx                ← Grid 3 栏容器
│   │       ├── WikiSidebar.tsx               ← 左栏：文档树导航（多级折叠）
│   │       ├── WikiTOC.tsx                   ← 右栏：标题锚点目录（桌面端显示）
│   │       ├── WikiSearch.tsx                ← 搜索框 + Ctrl+K 快捷键
│   │       ├── WikiBreadcrumb.tsx            ← 面包屑导航
│   │       ├── WikiPagination.tsx            ← 上一篇 / 下一篇
│   │       ├── WikiMDXComponents.tsx         ← 自定义 MDX 渲染组件映射
│   │       └── WikiCodeBlock.tsx             ← 代码高亮（shiki）
│   │
│   ├── lib/
│   │   ├── supabase.ts                       ← 现有
│   │   └── wiki.ts                           ← ✨ Wiki 工具函数（新增）
│   │
│   └── styles/
│       ├── globals.css                       ← 现有
│       └── wiki.css                          ← ✨ Wiki 专属样式（新增）
│
└── docs/
    └── wiki-content/                         ← ✨ 文档源内容（新增，全体成员维护）
        ├── _meta.json                        ← 顶级导航配置
        ├── getting-started/
        │   ├── _meta.json                    ← 该组排序+标题覆盖
        │   ├── quick-start.md                ← 5 分钟上手 StudySolo
        │   └── concepts.md                   ← 核心概念（工作流、节点、AI 对话）
        ├── guides/
        │   ├── _meta.json
        │   ├── creating-workflows.md         ← 创建第一个工作流
        │   ├── using-nodes.md                ← 节点使用说明
        │   └── ai-chat.md                    ← AI 对话使用指南
        ├── nodes/
        │   ├── _meta.json
        │   ├── overview.md                   ← 节点总览（可从 manifest 自动生成）
        │   └── categories.md                 ← 节点分类说明
        └── api/
            ├── _meta.json
            └── reference.md                  ← API 参考
```

---

## `_meta.json` 导航配置设计

借鉴 Nextra 的 `_meta.json` 模式，但不引入 Nextra 依赖。AI 只需读取这一个文件就能理解整个导航结构。

### 顶级配置

```json
// docs/wiki-content/_meta.json
{
  "getting-started": { "title": "快速开始", "order": 1 },
  "guides": { "title": "使用指南", "order": 2 },
  "nodes": { "title": "节点文档", "order": 3 },
  "api": { "title": "API 参考", "order": 4 }
}
```

### 子组配置

```json
// docs/wiki-content/getting-started/_meta.json
{
  "quick-start": { "title": "5 分钟上手", "order": 1 },
  "concepts": { "title": "核心概念", "order": 2 }
}
```

### 文档 Frontmatter

```yaml
# docs/wiki-content/getting-started/quick-start.md
---
title: "5 分钟上手 StudySolo"
description: "从零开始创建你的第一个 AI 学习工作流"
lastUpdated: 2026-04-10
---
```

---

## `lib/wiki.ts` 接口设计

```typescript
// frontend/src/lib/wiki.ts

/** 文档元数据 */
interface DocMeta {
  slug: string;
  title: string;
  description?: string;
  lastUpdated?: string;
}

/** 导航项 */
interface NavItem {
  title: string;
  slug?: string;          // 叶子节点才有
  order: number;
  children?: NavItem[];   // 目录节点才有
}

/** TOC 标题项 */
interface TOCItem {
  id: string;
  title: string;
  level: 2 | 3;           // 只取 h2 和 h3
}

/**
 * 从 docs/wiki-content/ 读取指定文档内容
 * @param slug - 如 "getting-started/quick-start"
 * @returns markdown 原文 + frontmatter
 */
export async function getDocContent(slug: string): Promise<{
  content: string;
  frontmatter: DocMeta;
}>;

/**
 * 扫描 docs/wiki-content/ 下所有 .md 文件，返回 slug 列表
 * 用于 generateStaticParams()
 */
export function getAllDocSlugs(): { slug: string[] }[];

/**
 * 读取所有 _meta.json，构建完整的导航树
 */
export function getNavigation(): NavItem[];

/**
 * 从 markdown 内容中提取标题，生成 TOC
 */
export function parseTableOfContents(markdown: string): TOCItem[];
```

---

## Wiki 布局样式

```css
/* frontend/src/styles/wiki.css */

.wiki-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 200px;
  gap: 2rem;
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  min-height: calc(100vh - 64px);
}

/* 移动端：隐藏右侧 TOC，侧边栏可收起 */
@media (max-width: 1024px) {
  .wiki-layout {
    grid-template-columns: 1fr;
    padding: 1rem;
  }
}

@media (min-width: 1024px) and (max-width: 1280px) {
  .wiki-layout {
    grid-template-columns: 240px minmax(0, 1fr);
  }
}

/* 文档内容区的 Prose 样式 */
.wiki-prose {
  max-width: 768px;
}

.wiki-prose h2 { scroll-margin-top: 80px; }
.wiki-prose h3 { scroll-margin-top: 80px; }

/* 右侧 TOC 固定定位 */
.wiki-toc {
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
```

---

## Task 分解

### Task W1：创建 Route Group 骨架（Day 1）

- 创建 `frontend/src/app/(wiki)/wiki/` 目录
- 实现 `layout.tsx`（3 栏 Grid，不继承 Sidebar）
- 实现 `page.tsx`（首页，显示文档目录）
- 实现 `[...slug]/page.tsx`（动态文档路由）

> [!WARNING]
> `layout.tsx` 绝对不要 import 主应用的 `Sidebar` 组件。`(wiki)` 不出现在 URL 中。

### Task W2：创建 Wiki 专属组件（Day 2-3）

| 组件 | 优先级 | 说明 |
|------|--------|------|
| `WikiLayout.tsx` | P0 | 3 栏 Grid 容器 |
| `WikiSidebar.tsx` | P0 | 从 `_meta.json` 读取导航树 |
| `WikiMDXComponents.tsx` | P0 | 代码、警告框、表格的自定义渲染 |
| `WikiBreadcrumb.tsx` | P1 | 面包屑（`guides / creating-workflows`） |
| `WikiTOC.tsx` | P1 | 右侧标题锚点（桌面端） |
| `WikiPagination.tsx` | P2 | 上一篇/下一篇 |
| `WikiSearch.tsx` | P2 | Ctrl+K 搜索（初版可暂缓） |
| `WikiCodeBlock.tsx` | P2 | shiki 代码高亮（MDX 组件内用） |

### Task W3：实现 `lib/wiki.ts`（Day 2）

- `getDocContent()` — 读取 md + gray-matter 解析 frontmatter
- `getAllDocSlugs()` — 扫描文件系统，用于 `generateStaticParams`
- `getNavigation()` — 递归读取 `_meta.json` 构建导航树
- `parseTableOfContents()` — 正则提取 h2/h3 标题

### Task W4：初始化文档内容（Day 3-4）

至少 3 篇可读文档：

1. `getting-started/quick-start.md` — 5 分钟上手
2. `guides/creating-workflows.md` — 创建第一个工作流
3. `guides/using-nodes.md` — 节点使用说明

### Task W5：样式与响应式（Day 4-5）

- 创建 `wiki.css`（3 栏 Grid + prose + 响应式）
- 确保移动端可用（侧边栏折叠/抽屉）
- Design Token 与主应用一致（颜色/字体/间距）

### Task W6：CI 文档检查（Day 5）

```yaml
# .github/workflows/wiki-check.yml
on:
  push:
    paths: ['docs/wiki-content/**']
  pull_request:
    paths: ['docs/wiki-content/**']

jobs:
  lint-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check markdown
        run: npx markdownlint-cli2 "docs/wiki-content/**/*.md"
```

---

## 完成标志

- [ ] `/wiki` 可在本地访问，不继承主应用 Sidebar
- [ ] 3 栏布局正常（桌面：侧边栏 + 内容 + TOC）
- [ ] 移动端响应式正常（单栏 + 可折叠侧边栏）
- [ ] 至少 3 篇文档可正常渲染
- [ ] WikiSidebar 从 `_meta.json` 动态生成导航
- [ ] `generateStaticParams` 已配置（静态生成）
- [ ] `docs/wiki-content/` 目录已建立并有初始内容

---

## 注意事项

> [!CAUTION]
> 1. **不要**安装 `contentlayer`——已停止维护
> 2. **不要**重复安装 `react-markdown`——检查主前端 package.json 是否已有
> 3. **不要**让 Wiki layout 继承 `(dashboard)/layout.tsx` 的 Sidebar
> 4. `docs/wiki-content/` 内容由全体成员维护，队友 A 只负责渲染层
> 5. Wiki Auth 不需要单独实现——同一个 Next.js 进程，天然共用登录态
> 6. 使用 `next-mdx-remote/rsc` 做 Server Component 渲染，不要用客户端 MDX

---

## 生产部署分析

### 结论：Route Group 方案可以正常部署，零额外配置

| 维度 | 分析 |
|------|------|
| **Nginx** | `/wiki` 路径被 Next.js App Router 自动路由处理，**不需要**额外 `location` 块 |
| **PM2** | 复用主前端的 PM2 进程，零额外进程 |
| **构建** | `docs/wiki-content/*.md` 在 `next build` 时被 `lib/wiki.ts` 的 `fs.readFileSync` 读入并预渲染为静态 HTML |
| **运行时** | 预渲染页面由 Next.js 直接提供，**运行时不再读取 md 文件** |
| **Auth** | 同一个 Next.js 进程，天然共用 Supabase Auth 登录态 |
| **URL** | `https://studyflow.1037solo.com/wiki/` → 自动路由到 `(wiki)/wiki/page.tsx` |

#### 现有 Nginx 配置兼容性

当前生产 Nginx 配置对主前端的反代：

```nginx
# 现有配置（已生效）
location / {
    proxy_pass http://127.0.0.1:2037;
    ...
}
```

由于 Wiki 是主前端的 Route Group，所有 `/wiki/*` 请求自动被 Next.js 处理。**不需要**添加任何新的 `location` 块。

#### `docs/wiki-content/` 在服务器上的位置

```
服务器目录结构：
/www/wwwroot/StudySolo/
├── frontend/                    ← next build 在此执行
│   ├── .next/                   ← 构建产物（含预渲染的 Wiki HTML）
│   └── src/app/(wiki)/          ← Wiki 源码
├── docs/
│   └── wiki-content/            ← md 源文件（构建时读取，运行时不需要）
└── backend/
```

> [!TIP]
> `docs/wiki-content/` 只在 **build 阶段**被访问。如果使用 `output: 'standalone'` 模式部署，甚至可以在部署 artifact 中不包含 `docs/` 目录。

---

## 方案变更记录

### 废弃独立 `wiki/` 子项目（2026-04-10）

| 维度 | 旧方案（已废弃） | 新方案（采用） |
|------|--------------|-------------|
| 位置 | `wiki/`（独立 Next.js） | `frontend/src/app/(wiki)/wiki/` |
| 端口 | 2039（独立） | 2037（复用主前端） |
| 部署 | 独立 PM2 + 独立 Nginx 反代 | 复用主前端 PM2 |
| Auth | 需要跨域 SSO | 天然共用 |
| 维护 | 独立 package.json | 共用依赖 |

**原因**：当前团队规模（3 人），独立子项目维护成本远大于收益。

**操作**：`wiki/` 目录已从仓库中移除（`git rm -r wiki/`），所有相关信息已归档到本文档。

### 分析来源

- Claude 分析 `09-Wiki子项目规划.md`：最终推荐 Route Group 嵌入方案
- Codex 分析 `08-wiki-main-project-interface.md`：确立"Wiki 是发布源，不是设计源"原则

