<!-- 编码：UTF-8 -->

# ✅ #03 executor.py 拆分方案（671 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 671 行 → 143 行，提取 4 个引擎模块

## 当前问题

`backend/app/engine/executor.py` 是工作流执行引擎核心，混合了 4 个不同职责：

1. **拓扑排序**（topological_sort_levels、topological_sort、_get_all_downstream_helper）~70 行
2. **循环执行**（_execute_loop_group）~100 行
3. **分支过滤**（get_branch_filtered_downstream）~50 行
4. **节点执行**（_execute_single_node、_execute_single_node_with_timeout）~80 行
5. **输入构建**（_build_context_prompt、_merge_outputs、_build_input_snapshot、_resolve_user_content、_build_runtime_config、_build_node_llm_caller）~80 行
6. **主编排**（execute_workflow）~240 行
7. **辅助函数**（_get_max_wait_seconds）~15 行

## 拆分策略

按职责拆分为 4 个模块，保持 `engine/` 包结构。

| 模块 | 职责 | 预估行数 |
|------|------|----------|
| `topology.py` | 拓扑排序 + 下游计算 + 分支过滤 | ~120 |
| `node_runner.py` | 单节点执行 + 输入构建 + LLM caller 构建 | ~180 |
| `loop_runner.py` | 循环容器执行逻辑 | ~120 |
| `executor.py` | 主编排函数 execute_workflow（调用上述模块） | ~250 |

## 拆分后 Tree

```
backend/app/engine/
├── __init__.py                # 已有，更新 re-export
├── context.py                 # 已有，保持
├── events.py                  # 已有，保持
├── sse.py                     # 已有，保持
├── executor.py                # ~250 行：execute_workflow 主编排
├── topology.py                # ~120 行：拓扑排序 + 分支过滤
├── node_runner.py             # ~180 行：单节点执行 + 输入构建
└── loop_runner.py             # ~120 行：循环容器执行
```

## 模块依赖关系

```
executor.py
├── imports topology.py        (topological_sort_levels, get_branch_filtered_downstream)
├── imports node_runner.py     (_execute_single_node_with_timeout, _build_input_snapshot)
├── imports loop_runner.py     (_execute_loop_group)
├── imports context.py         (已有)
├── imports events.py          (已有)
└── imports sse.py             (已有)

node_runner.py
├── imports context.py
└── imports events.py

loop_runner.py
├── imports node_runner.py
├── imports context.py
└── imports events.py
```

## 各模块内容

### topology.py

```python
# 从 executor.py 提取：
def _get_all_downstream_helper(node_id, downstream_map) -> set[str]
def topological_sort_levels(nodes, edges) -> list[list[str]]
def topological_sort(nodes, edges) -> list[str]
def get_branch_filtered_downstream(logic_node_id, chosen_branch, nodes, edges) -> set[str]
def _get_max_wait_seconds(node_id, edges) -> float
```

### node_runner.py

```python
# 从 executor.py 提取：
def _build_context_prompt(implicit_context) -> str
def _merge_outputs(upstream_ids, node_outputs) -> str
def _build_input_snapshot(node_input) -> str
def _resolve_user_content(node_data) -> str
def _build_runtime_config(node_data) -> dict | None
def _build_node_llm_caller(runtime_config)
async def _execute_single_node(node, ...) -> str
async def _execute_single_node_with_timeout(node, ...) -> str
```

### loop_runner.py

```python
# 从 executor.py 提取：
async def _execute_loop_group(group_node, child_nodes, edges, ...) -> None
```

## 可复用识别

- `topological_sort` 可被测试工具、可视化调试工具复用
- `_build_context_prompt` 可被 AI chat 模块复用（当前 chat 有独立实现）
- `_merge_outputs` 是纯函数，可被其他编排场景复用

## 风险

- `execute_workflow` 内部有大量闭包变量（node_outputs、save_callback 等），拆分时需要通过参数传递或 context 对象
- 建议引入 `ExecutionContext` dataclass 封装运行时状态，减少参数传递

## 预估工作量

~2.5 小时（拆分 + 调整 import + 运行现有测试验证）
