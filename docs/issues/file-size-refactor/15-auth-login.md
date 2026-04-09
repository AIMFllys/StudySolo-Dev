<!-- 编码：UTF-8 -->

# ✅ #15 auth/login.py 拆分方案（369 行 → 目标 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 369 行 → 127 行，提取 password.py + me.py

## 当前问题

单文件包含 8 个路由函数，职责跨越了 3 个域：

1. **认证**（login、logout、refresh、sync_session）~140 行
2. **密码重置**（forgot_password、reset_password、reset_password_with_code）~100 行
3. **用户信息**（me）~60 行
4. **Pydantic 模型** + 辅助 ~70 行

## 拆分策略

auth 包已经存在（`backend/app/api/auth/`），直接按域拆分：

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `auth/login.py` | login + logout + refresh + sync_session | ~180 |
| `auth/password.py` | forgot_password + reset_password + reset_password_with_code | ~120 |
| `auth/me.py` | me 路由 | ~70 |

## 拆分后 Tree

```
backend/app/api/auth/
├── __init__.py                        # 更新 router 聚合
├── _helpers.py                        # 已有，保持
├── captcha.py                         # 已有，保持
├── consent.py                         # 已有，保持
├── login.py                           # ~180 行：登录/登出/刷新/同步
├── password.py                        # ~120 行：密码重置流程
├── me.py                              # ~70 行：当前用户信息
└── register.py                        # 已有，保持
```

## 预估工作量

~1 小时
