<!-- 编码：UTF-8 -->

# #14 admin_users.py 拆分方案（371 行 → 目标 < 250 行）

## 当前问题

路由文件内联了 8 个 Pydantic 模型 + 4 个路由函数，其中 `list_users` 和 `get_user_detail` 各 ~70-100 行。

## 拆分策略

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `models/admin.py` | 已有，将 UserListItem/PaginatedUserList/UserDetail 等模型移入 | +80 行 |
| `api/admin_users.py` | 路由定义（引用 models） | ~290 → 仍略超标 |

进一步优化 — 将 `get_user_detail` 的复杂聚合查询下沉：

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `models/admin.py` | 新增 User 相关模型 | 已有 + ~80 行 |
| `services/admin_user_service.py` | 用户详情聚合查询 | ~120 行 |
| `api/admin_users.py` | 路由定义 | ~170 行 |

## 拆分后 Tree

```
backend/app/
├── api/
│   └── admin_users.py                 # ~170 行
├── services/
│   └── admin_user_service.py          # ~120 行
├── models/
│   └── admin.py                       # 已有 + 新增模型
```

## 预估工作量

~1 小时
