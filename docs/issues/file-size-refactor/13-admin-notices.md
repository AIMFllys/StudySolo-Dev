<!-- 编码：UTF-8 -->

# #13 admin_notices.py 拆分方案（382 行 → 目标 < 250 行）

## 当前问题

路由文件包含了过多的业务逻辑（Pydantic 模型定义 + 数据库操作内联在路由中）：

- 7 个路由函数（list/get/create/update/delete/publish + _row_to_item 辅助）
- Pydantic 模型定义内联在路由文件中

## 拆分策略

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `models/notice.py` | 已有，确认 Pydantic 模型是否已在此 | — |
| `api/admin_notices.py` | 路由定义（薄层） | ~250 |

检查发现 `models/notice.py` 已存在。主要问题是路由函数内部的数据库操作过于冗长。

更好的方案：将 create/update 中的复杂数据库操作提取到 service：

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `services/notice_service.py` | create/update/delete/publish 业务逻辑 | ~180 |
| `api/admin_notices.py` | 路由定义 + 输入校验 | ~200 |

## 拆分后 Tree

```
backend/app/
├── api/
│   └── admin_notices.py               # ~200 行：路由
├── services/
│   └── notice_service.py              # ~180 行：业务逻辑
├── models/
│   └── notice.py                      # 已有，保持
```

## 预估工作量

~1 小时
