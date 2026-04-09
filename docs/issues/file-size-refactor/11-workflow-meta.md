<!-- 编码：UTF-8 -->

# ✅ #11 workflow-meta.ts 评估（411 行 — 确认保留，不拆分）

> **状态：已确认保留** | 评估日期：2026-03-30 | 纯数据常量文件，不违反 SRP

## 当前分析

`frontend/src/features/workflow/constants/workflow-meta.ts` 是纯数据常量文件，包含：

- `NODE_TYPE_META` 对象：每个节点类型的 label、icon、color、category 映射
- `getNodeTheme()` 辅助函数
- 节点分类常量

## 评估结论

**建议保留不拆分**，原因：

1. 纯数据文件，没有逻辑复杂度，不违反 SRP
2. 所有节点元数据集中在一处是正确的 Single Source of Truth
3. 拆分反而会增加查找成本
4. 411 行中大部分是数据定义，不是可执行逻辑

## 替代优化

如果未来节点类型继续增长超过 500 行，可考虑：
- 按 category 拆分为 `input-nodes-meta.ts`、`analysis-nodes-meta.ts`、`generation-nodes-meta.ts`
- 在主文件中 `...spread` 合并

## 预估工作量

0（不需要操作）
