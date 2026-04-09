<!-- 编码：UTF-8 -->

# ✅ #09 usage_analytics.py 拆分方案（426 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 426 行 → 180 行，提取 helpers

## 当前问题

单文件包含 6 个公开 API + 大量辅助函数：

1. **时间辅助**（_utcnow、parse_range、parse_window、_bucket_key、_bucket_sequence、_window_sequence）~50 行
2. **数据辅助**（_safe_int、_safe_float、_compute_metrics）~40 行
3. **数据获取**（_fetch_request_rows、_fetch_event_rows、_fetch_family_map）~50 行
4. **公开 API**（get_usage_overview、get_usage_live、get_usage_timeseries、get_model_breakdown、get_recent_calls、get_cost_split）~290 行

## 拆分策略

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `usage_analytics_helpers.py` | 时间辅助 + 数据辅助 + 数据获取 | ~140 |
| `usage_analytics.py` | 6 个公开 API（调用 helpers） | ~290 → 仍略超标 |

进一步拆分公开 API：

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `usage_analytics_helpers.py` | 辅助函数 + 数据获取 | ~140 |
| `usage_analytics.py` | overview + live + timeseries | ~180 |
| `usage_analytics_breakdown.py` | model_breakdown + recent_calls + cost_split | ~160 |

## 拆分后 Tree

```
backend/app/services/
├── usage_analytics.py                 # ~180 行：概览/实时/时序
├── usage_analytics_breakdown.py       # ~160 行：模型分布/最近调用/成本拆分
├── usage_analytics_helpers.py         # ~140 行：辅助函数
└── ...其他已有 services
```

## 预估工作量

~1 小时
