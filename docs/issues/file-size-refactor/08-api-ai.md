<!-- 编码：UTF-8 -->

# ✅ #08 api/ai.py 拆分方案（427 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 427 行 → 64 行，业务逻辑下沉 service

## 当前问题

API 路由文件包含了大量业务逻辑，违反了"路由层应薄"的原则：

1. **输入处理**（sanitize_user_input、_extract_json）~25 行
2. **图规范化**（_normalize_edges、_should_auto_layout、_auto_layout_nodes）~130 行
3. **重试逻辑**（_call_with_retry）~30 行
4. **工作流生成核心**（generate_workflow、_generate_workflow_impl、_generate_workflow_core）~240 行

## 拆分策略

将业务逻辑下沉到 service 层：

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `services/workflow_generator.py` | 图规范化 + 自动布局 + 生成核心逻辑 | ~250 |
| `api/ai.py` | 路由定义 + 输入校验（调用 service） | ~180 |

## 拆分后 Tree

```
backend/app/
├── api/
│   └── ai.py                          # ~180 行：路由 + 输入校验
├── services/
│   └── workflow_generator.py          # ~250 行：工作流生成业务逻辑
```

## 可复用识别

- `_normalize_edges` 和 `_auto_layout_nodes` 可被工作流导入/模板功能复用
- `sanitize_user_input` 可提升到 `utils/` 供其他 API 使用

## 预估工作量

~1.5 小时
