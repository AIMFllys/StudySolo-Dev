<!-- 编码：UTF-8 -->

# ✅ #04 ai_router.py 拆分方案（480 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 480 行 → 197 行，提取 llm_provider + llm_caller

## 当前问题

`backend/app/services/ai_router.py` 混合了 3 层职责：

1. **Provider 基础设施**（_get_provider_config、_get_client、_is_provider_configured）~30 行
2. **底层调用**（_call_non_stream、_stream_tokens、_empty_stream、_record_error_attempt）~130 行
3. **路由策略**（_build_route_candidates、_pricing_from_sku）~30 行
4. **公开 API**（call_llm、call_llm_direct、call_llm_structured、call_llm_direct_structured）~290 行

## 拆分策略

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `llm_provider.py` | Provider 配置 + client 创建 + 错误记录 | ~80 |
| `llm_caller.py` | 底层 non-stream / stream 调用 | ~150 |
| `ai_router.py` | 路由策略 + 公开 API（调用 llm_caller） | ~250 |

## 拆分后 Tree

```
backend/app/services/
├── ai_router.py               # ~250 行：路由策略 + 公开 call_llm* API
├── llm_provider.py            # ~80 行：provider 配置、client 工厂
├── llm_caller.py              # ~150 行：底层 LLM 调用（stream/non-stream）
└── ...其他已有 services
```

## 预估工作量

~1.5 小时
