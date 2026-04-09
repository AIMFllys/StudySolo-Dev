<!-- 编码：UTF-8 -->

# ✅ #07 community_node_service.py 拆分方案（428 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 428 行 → 131 行，读写分离

## 当前问题

单文件包含 3 层职责：

1. **序列化辅助**（_sanitize_search、_load_author_names、_load_liked_ids、_serialize_public、_serialize_mine）~90 行
2. **查询操作**（list_public_nodes、list_my_nodes、get_my_node、get_public_node、get_node_with_prompt）~130 行
3. **写入操作**（create_node、update_node、delete_node、like_node、unlike_node）~210 行

## 拆分策略

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `community_node_serializers.py` | 序列化 + 辅助查询函数 | ~90 |
| `community_node_service.py` | 查询 + 写入（调用 serializers） | ~340 → 仍超标 |

更好的方案 — 按读写分离：

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `community_node_queries.py` | list/get 查询 + 序列化辅助 | ~220 |
| `community_node_service.py` | create/update/delete/like/unlike 写入 | ~210 |

## 拆分后 Tree

```
backend/app/services/
├── community_node_queries.py    # ~220 行：查询 + 序列化
├── community_node_service.py    # ~210 行：写入操作
└── ...其他已有 services
```

## 预估工作量

~1 小时
