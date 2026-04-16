# Wiki 内容目录

> 文档格式：Markdown（.md）
> 渲染路径：`/wiki/<path>` → 读取本目录对应文件

## 目录结构

```
wiki-content/
├── _meta.json              # 顶级导航配置
├── getting-started/
│   ├── _meta.json          # 分组导航配置
│   └── quick-start.md      # 快速开始
├── guides/
│   ├── _meta.json
│   └── creating-workflows.md  # 创建工作流
└── README.md               # 本文件
```

## 新增文档说明

在对应子目录下新建 `.md` 文件即可，路由自动生成。
例如：`guides/advanced-nodes.md` → `/wiki/guides/advanced-nodes`

## 文档规范

### Frontmatter（必须）

每篇文档开头必须包含：

```yaml
---
title: "文档标题"
description: "一句话描述"
lastUpdated: 2026-04-16
---
```

### 导航配置 `_meta.json`

```json
{
  "file-name": { "title": "显示标题", "order": 1 }
}
```

## GitHub 协作指引

### 提交范围

- ✅ `docs/wiki-content/` —— Markdown 文档
- ✅ `frontend/src/app/(wiki)/` —— 渲染代码（如需优化）
- ✅ `frontend/src/components/wiki/` —— 新增组件
- ❌ **禁止改动** `backend/`、`agents/`、`frontend/src/components/layout/`

### 分支命名

- `feat/wiki-<topic>` —— 新增功能/组件
- `docs/wiki-<topic>` —— 纯文档更新

### PR 规范

- 标题前缀 `[wiki]`
- 描述中列出修改的文件路径
- 本地预览通过（`pnpm dev` 访问 `/wiki`）

### 本地测试

```bash
cd frontend
pnpm dev          # 访问 http://localhost:2037/wiki
```
