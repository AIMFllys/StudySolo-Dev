# Wiki 开发计划（小陈接手版）

> 负责人：小陈
> 更新时间：2026-04-13
> 完整原始计划：`docs/team/refactor/final-plan/wiki-init-plan.md`
> 方案：Next.js Route Group 嵌入主前端（`frontend/src/app/(wiki)/wiki/`）

---

## 当前已完成（羽升 S4.1 交付）

| 文件 | 说明 |
|------|------|
| `frontend/src/app/(wiki)/wiki/layout.tsx` | Wiki 专属布局（左侧导航 + 右侧内容，不继承主应用 Sidebar） |
| `frontend/src/app/(wiki)/wiki/page.tsx` | Wiki 首页（文档列表，导航硬编码） |
| `frontend/src/app/(wiki)/wiki/[...slug]/page.tsx` | 动态文档路由（读取 `docs/wiki-content/` 下的 md 文件渲染） |
| `docs/wiki-content/README.md` | 目录说明 |
| `docs/wiki-content/getting-started/quick-start.md` | 占位文档 |
| `docs/wiki-content/guides/creating-workflows.md` | 占位文档 |

**当前可访问**：启动前端后 `/wiki` 和 `/wiki/getting-started/quick-start` 均可访问，Markdown 渲染正常。

---

## 你需要做的事（Task W2 ~ W6）

### Task W2：创建 Wiki 专属组件（优先级最高）

目标目录：`frontend/src/components/wiki/`

当前 `layout.tsx` 的导航是**硬编码**的，需要改为从 `_meta.json` 动态读取。

需要创建的组件：

| 组件 | 优先级 | 说明 |
|------|--------|------|
| `WikiSidebar.tsx` | P0 | 从 `_meta.json` 读取导航树，替换 layout.tsx 中的硬编码导航 |
| `WikiBreadcrumb.tsx` | P1 | 面包屑（如 `使用指南 / 创建工作流`） |
| `WikiTOC.tsx` | P1 | 右侧标题锚点目录（桌面端，h2/h3） |
| `WikiPagination.tsx` | P2 | 上一篇 / 下一篇 |
| `WikiSearch.tsx` | P2 | Ctrl+K 搜索（初版可暂缓） |
| `WikiCodeBlock.tsx` | P2 | shiki 代码高亮（已有 shiki 依赖，直接用） |

### Task W3：实现 `lib/wiki.ts`

目标文件：`frontend/src/lib/wiki.ts`

```typescript
// 需要实现的函数

// 读取指定文档内容 + frontmatter
export async function getDocContent(slug: string): Promise<{
  content: string;
  frontmatter: { title: string; description?: string; lastUpdated?: string };
}>;

// 扫描所有 .md 文件，用于 generateStaticParams()
export function getAllDocSlugs(): { slug: string[] }[];

// 递归读取 _meta.json，构建导航树
export function getNavigation(): NavItem[];

// 从 markdown 提取 h2/h3 标题，生成 TOC
export function parseTableOfContents(markdown: string): TOCItem[];
```

同时需要在 `[...slug]/page.tsx` 中添加 `generateStaticParams`（当前缺失，生产构建需要）：

```typescript
export async function generateStaticParams() {
  return getAllDocSlugs();
}
```

### Task W4：补充文档内容

需要创建 `_meta.json` 导航配置文件，并补充文档：

**`_meta.json` 格式**（参考 `wiki-init-plan.md` §`_meta.json` 导航配置设计）：

```json
// docs/wiki-content/_meta.json
{
  "getting-started": { "title": "快速开始", "order": 1 },
  "guides": { "title": "使用指南", "order": 2 },
  "nodes": { "title": "节点文档", "order": 3 },
  "api": { "title": "API 参考", "order": 4 }
}
```

需要补充的文档（至少完成前 3 篇）：

- `docs/wiki-content/getting-started/quick-start.md` — 填充真实内容（当前是占位）
- `docs/wiki-content/getting-started/concepts.md` — 核心概念（工作流、节点、AI 对话）
- `docs/wiki-content/guides/creating-workflows.md` — 填充真实内容（当前是占位）
- `docs/wiki-content/guides/using-nodes.md` — 节点使用说明
- `docs/wiki-content/guides/ai-chat.md` — AI 对话使用指南

每篇文档加 frontmatter：

```yaml
---
title: "文档标题"
description: "一句话描述"
lastUpdated: 2026-04-13
---
```

### Task W5：样式与响应式

创建 `frontend/src/styles/wiki.css`，实现 3 栏 Grid 布局和响应式。

详细 CSS 规范见 `docs/team/refactor/final-plan/wiki-init-plan.md` §Wiki 布局样式。

关键要求：
- 桌面端：左侧导航 260px + 内容区 + 右侧 TOC 200px
- 平板端（< 1280px）：左侧导航 + 内容区（隐藏 TOC）
- 移动端（< 1024px）：单栏 + 可折叠侧边栏

### Task W6：CI 文档检查（可选，最后做）

创建 `.github/workflows/wiki-check.yml`，对 `docs/wiki-content/**/*.md` 运行 markdownlint。

---

## 注意事项

1. **不要**安装 `contentlayer`（已停止维护）
2. `react-markdown`、`remark-gfm`、`shiki` 已在 `frontend/package.json` 中，直接用
3. **不要**让 Wiki layout 继承 `(dashboard)/layout.tsx` 的 Sidebar
4. 使用 Server Component 渲染（`[...slug]/page.tsx` 已是 Server Component）
5. 文档内容（`docs/wiki-content/`）由你负责填充，渲染层代码已就绪

---

## 完成标志

- [ ] WikiSidebar 从 `_meta.json` 动态生成导航（替换硬编码）
- [ ] `lib/wiki.ts` 实现完整
- [ ] `generateStaticParams` 已配置
- [ ] 至少 3 篇文档有真实内容（非占位）
- [ ] 3 栏布局正常（桌面：侧边栏 + 内容 + TOC）
- [ ] 移动端响应式正常
- [ ] `/wiki` 可在本地正常访问

---

## 参考文档

- 完整原始计划：`docs/team/refactor/final-plan/wiki-init-plan.md`
- 前端工程规范：`docs/项目规范与框架流程/项目规范/08-前端工程规范.md`
- 设计规范（颜色/字体/间距）：`docs/项目规范与框架流程/项目规范/05-设计规范.md`
