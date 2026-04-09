<!-- 编码：UTF-8 -->

# #17 CommunityNodeManagePage.tsx 拆分方案（362 行 → 目标 < 250 行）

## 当前问题

单个组件函数 362 行，包含：

1. **数据获取**（useEffect + API 调用）~40 行
2. **表单状态**（编辑/创建模式切换）~50 行
3. **操作处理**（发布/更新/删除/上传知识文件）~80 行
4. **JSX 渲染**（节点列表 + 编辑表单 + 知识文件上传区）~190 行

## 拆分策略

| 文件 | 内容 | 预估行数 |
|------|------|----------|
| `CommunityNodeManagePage.tsx` | 主页面布局 + 列表 | ~150 |
| `CommunityNodeEditor.tsx` | 编辑/创建表单 | ~140 |
| `use-community-node-manage.ts` | 数据获取 + 操作处理 hook | ~80 |

## 拆分后 Tree

```
frontend/src/features/community-nodes/
├── components/
│   ├── CommunityNodeManagePage.tsx     # ~150 行：页面布局
│   ├── CommunityNodeEditor.tsx         # ~140 行：编辑表单
│   ├── CommunityNodeCard.tsx           # 已有，保持
│   ├── CommunityNodeList.tsx           # 已有，保持
│   ├── KnowledgeFileUpload.tsx         # 已有，保持
│   ├── PublishNodeDialog.tsx           # 已有，保持
│   └── SchemaEditor.tsx               # 已有，保持
├── hooks/
│   └── use-community-node-manage.ts   # ~80 行：管理逻辑
├── constants/
│   └── catalog.ts                     # 已有，保持
```

## 预估工作量

~1 小时
