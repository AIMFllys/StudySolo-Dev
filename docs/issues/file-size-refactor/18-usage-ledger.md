<!-- 编码：UTF-8 -->

# #18 usage_ledger.py 拆分方案（346 行 → 目标 < 250 行）

## 当前问题

单文件混合了 3 层职责：

1. **数据模型**（BoundUsageRequest、BoundUsageCall、UsageNumbers、UsagePricing）~40 行
2. **纯函数辅助**（utcnow、normalize_*、bucket_to_minute、estimate_*、parse_openai_usage、calculate_cost_cny）~80 行
3. **Context 变量绑定**（bind_usage_request、bind_usage_call、get_bound_*）~25 行
4. **数据库操作**（create_usage_request、finalize_usage_request、record_usage_event、_increment_minute_rollup）~200 行

## 拆分策略

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `usage_ledger_models.py` | 数据模型 + 纯函数辅助 + context 绑定 | ~145 |
| `usage_ledger.py` | 数据库操作（调用 models） | ~200 |

## 拆分后 Tree

```
backend/app/services/
├── usage_ledger.py                    # ~200 行：数据库操作
├── usage_ledger_models.py             # ~145 行：模型 + 辅助函数
└── ...其他已有 services
```

## 预估工作量

~0.5 小时
