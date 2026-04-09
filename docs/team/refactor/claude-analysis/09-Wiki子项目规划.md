# Wiki 子项目规划

> 负责人：队友 A
> 目标：建立项目文档站点

---

## 1. Wiki 定位

### 1.1 目的

- 用户文档（如何创建工作流、如何使用节点）
- 开发者文档（API 参考、架构说明）
- 团队内部知识库

### 1.2 与主项目的关系

- **独立开发**：Wiki 作为 `apps/frontend/wiki/` 子项目
- **共享资源**：使用主项目的 UI 组件、类型定义
- **独立部署**：可以通过 `/wiki` 访问，不影响主应用

---

## 2. 目录结构

```
apps/frontend/wiki/
├── app/
│   ├── page.tsx                    # Wiki 首页
│   ├── layout.tsx                  # Wiki 布局
│   ├── docs/
│   │   ├── layout.tsx             # 文档布局
│   │   ├── page.tsx               # 文档首页
│   │   └── [...slug]/
│   │       └── page.tsx           # 动态文档页
│   └── api/
│       └── search/
│           └── route.ts            # 搜索 API
│
├── components/
│   └── wiki/
│       ├── Sidebar.tsx            # 文档侧边栏
│       ├── Header.tsx              # Wiki 头部
│       ├── SearchDialog.tsx        # 搜索弹窗
│       ├── TOC.tsx                # 目录
│       ├── TableOfContents.tsx
│       ├── MdxContent.tsx          # MDX 渲染
│       └── DocCard.tsx             # 文档卡片
│
├── content/
│   ├── index.mdx                   # 首页内容
│   ├── getting-started/
│   │   ├── _meta.json              # 章节元信息
│   │   ├── quick-start.mdx
│   │   ├── concepts.mdx
│   │   └── first-workflow.mdx
│   ├── guides/
│   │   ├── _meta.json
│   │   ├── creating-workflows.mdx
│   │   ├── using-nodes.mdx
│   │   ├── knowledge-base.mdx
│   │   └── sharing.mdx
│   ├── reference/
│   │   ├── _meta.json
│   │   ├── api/
│   │   │   ├── _meta.json
│   │   │   ├── workflow-api.mdx
│   │   │   ├── nodes-api.mdx
│   │   │   └── chat-api.mdx
│   │   └── node-types/
│   │       ├── _meta.json
│   │       ├── trigger-input.mdx
│   │       ├── ai-analyzer.mdx
│   │       └── ...
│   └── advanced/
│       ├── _meta.json
│       ├── custom-nodes.mdx
│       └── deployment.mdx
│
├── lib/
│   ├── mdx.ts                     # MDX 处理
│   ├── navigation.ts              # 导航生成
│   ├── toc.ts                     # TOC 生成
│   └── search.ts                   # 搜索索引
│
├── public/
│   ├── images/
│   └── assets/
│
├── next.config.ts                 # Next.js 配置
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 3. 技术方案

### 3.1 MDX 方案

使用 `@next/mdx` 或 `next-mdx-remote`：

```typescript
// lib/mdx.ts
import { compileMDX } from 'next-mdx-remote/rsc';
import { mdxOptions } from './mdx-options';

export async function getDocBySlug(slug: string[]) {
  const filePath = `content/${slug.join('/')}.mdx`;
  const source = await readFile(filePath);

  const { content, frontmatter } = await compileMDX({
    source,
    options: { mdxOptions },
  });

  return { content, frontmatter };
}
```

### 3.2 导航方案

```typescript
// lib/navigation.ts
const navigation = {
  'getting-started': {
    title: '快速开始',
    items: [
      { title: '快速入门', href: '/wiki/getting-started/quick-start' },
      { title: '核心概念', href: '/wiki/getting-started/concepts' },
    ],
  },
  'guides': {
    title: '指南',
    items: [...],
  },
};

export function getDocsNavigation() {
  return navigation;
}
```

### 3.3 搜索方案

使用 `flexsearch` 或 Algolia：

```typescript
// lib/search.ts
import FlexSearch from 'flexsearch';

const index = new FlexSearch.Document({
  document: {
    id: 'id',
    index: ['title', 'content'],
    store: ['title', 'href'],
  },
});

// Build index at build time
export async function buildSearchIndex() {
  const docs = await getAllDocs();
  docs.forEach(doc => index.add(doc));
}

// API route for search
// app/api/search/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  const results = index.search(query, { limit: 10 });

  return Response.json(results);
}
```

---

## 4. 内容规划

### 4.1 初始内容（MVP）

**必须包含（用户最需要）：**
1. 快速开始指南
2. 创建第一个工作流
3. 节点类型参考
4. 常见问题 FAQ

### 4.2 第二批内容

**计划：**
1. 高级工作流技巧
2. 知识库使用指南
3. API 参考文档
4. 部署指南

### 4.3 文档维护

**规则：**
1. 每个 PR 必须更新相关文档（如果改动涉及用户功能）
2. 文档使用 Markdown/MDX 格式
3. 代码块必须有语言标注
4. 截图上传到 `public/images/`

---

## 5. 访问方式

### 5.1 Route Group 方案（推荐）

```
apps/frontend/src/app/(wiki)/  # Route Group
```

**URL 映射：**
```
/wiki                    → (wiki)/wiki/page.tsx
/wiki/getting-started     → (wiki)/wiki/getting-started/page.tsx
/wiki/guides/creating     → (wiki)/wiki/guides/creating/page.tsx
```

### 5.2 部署配置

**Vercel 或自部署：**
- 静态导出：`next build --static`
- 或 SSR 模式，直接通过 `/wiki` 访问

---

## 6. 与主项目的集成

### 6.1 共享 UI 组件

```typescript
// apps/frontend/wiki/components/wiki/Header.tsx
import { Button } from '@studysolo/ui';
import { Input } from '@studysolo/ui';

export function WikiHeader() {
  return (
    <header className="wiki-header">
      <Button variant="ghost">返回应用</Button>
      <SearchDialog />
    </header>
  );
}
```

### 6.2 共享类型

```typescript
// 从 @studysolo/shared 导入
import type { WorkflowNode, NodeManifest } from '@studysolo/shared/types';
```

### 6.3 样式

使用主项目的 Tailwind 配置：
```typescript
// tailwind.config.ts
import baseConfig from '../../tailwind.config';

export default {
  ...baseConfig,
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './wiki/**/*.{ts,tsx}',  // Wiki 内容
  ],
};
```

---

## 7. 团队协作流程

### 7.1 Wiki 开发流程

```bash
# 1. 创建分支
git checkout -b feat/wiki-content

# 2. 开发 Wiki 内容
# 编辑 content/ 目录下的 .mdx 文件

# 3. 预览（本地）
pnpm --filter @studysolo/frontend wiki:dev

# 4. 提交
git add apps/frontend/wiki/content/
git commit -m "docs(wiki): 添加快速开始指南"

# 5. PR
git push -u origin feat/wiki-content
```

### 7.2 文档编写规范

```mdx
---
title: 快速开始
description: 学习如何在 5 分钟内创建第一个工作流
---

# 快速开始

在这篇指南中，你将学习...

## 前置要求

- 一个 StudySolo 账号
- 了解基本的工作流概念

## 步骤 1：创建工作流

1. 点击「新建工作流」按钮
2. 选择空白工作流或模板

:::tip
提示：使用模板可以更快开始！
:::

## 代码示例

```typescript
const workflow = await api.createWorkflow({
  name: 'My First Workflow',
});
```
```

---

## 8. 里程碑

| 阶段 | 内容 | 预计时间 |
|------|------|---------|
| M1 | Wiki 基础设施搭建完成 | 3 天 |
| M2 | 快速开始 + 核心概念文档 | 2 天 |
| M3 | 节点参考文档（所有节点）| 3 天 |
| M4 | 指南文档（创建工作流等）| 2 天 |
| M5 | API 参考文档 | 2 天 |
| M6 | 搜索功能 + 优化 | 1 天 |

---

## 9. 工具推荐

| 工具 | 用途 |
|------|------|
| MDX | Markdown + JSX |
| Shiki | 代码高亮 |
| Tailwind Typography | 文档排版 |
| FlexSearch | 本地搜索 |
| Cloudflare Pages | 部署（可选）|

---

## 10. 注意事项

1. **内容优先**：先完成最需要的文档，不要过度设计
2. **保持更新**：每次功能改动同步更新文档
3. **示例代码**：尽量提供可运行的示例
4. **截图**：复杂的 UI 改动需要截图说明
5. **国际化**：如果将来需要英文版，预留 i18n 结构
