# BUG-001: LogicSwitchNode / LoopMapNode 缺少 `try_parse_json` 方法

> 发现时间：2026-04-27  
> 严重级别：🔴 High  
> 状态：✅ 已修复 (PR #27)  
> 发现方式：`test_nodes_execute_property.py` 自动化测试

---

## 问题描述

`LogicSwitchNode` 和 `LoopMapNode` 的 `post_process` 方法调用了 `self.try_parse_json(raw_output)`，但该方法在 `JsonOutputMixin` 中不存在。

```
AttributeError: 'LogicSwitchNode' object has no attribute 'try_parse_json'
```

## 影响范围

- `backend/app/nodes/analysis/logic_switch/node.py` — 第 69 行
- `backend/app/nodes/analysis/loop_map/node.py` — 第 74 行
- 生产环境中，任何包含逻辑分支或循环映射节点的工作流，在节点执行完成后的 `post_process` 阶段会崩溃
- 崩溃会导致该节点标记为 error，下游所有节点被跳过

## 根因分析

`JsonOutputMixin`（`backend/app/nodes/_mixins.py`）提供了：
- `validate_json(raw_output)` — async 方法，解析失败时 raise ValueError

但 `logic_switch` 和 `loop_map` 的 `post_process` 需要的是：
- `try_parse_json(raw_output)` — sync 方法，解析失败时返回 None（不抛异常）

推测是在重构 mixin 时遗漏了这个方法，或者节点代码引用了一个计划中但未实现的 API。

## 复现步骤

```bash
cd backend
.venv\Scripts\python -m pytest tests/test_nodes_execute_property.py -k "logic_switch" -v
```

输出：
```
AttributeError: 'LogicSwitchNode' object has no attribute 'try_parse_json'
```

## 修复方案

在 `backend/app/nodes/_mixins.py` 的 `JsonOutputMixin` 中添加 `try_parse_json` 方法：

```python
def try_parse_json(self, raw_output: str) -> dict | list | None:
    """Synchronous JSON parse with fallback — returns None on failure."""
    import json
    text = raw_output.strip()
    
    # Strategy 1: direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Strategy 2: strip markdown fences
    for fence in ("```json", "```JSON", "```"):
        if text.startswith(fence):
            text = text[len(fence):]
            break
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Strategy 3: find first { or [ and last } or ]
    start = -1
    end = -1
    for i, ch in enumerate(text):
        if ch in ("{", "["):
            start = i
            break
    for i in range(len(text) - 1, -1, -1):
        if text[i] in ("}", "]"):
            end = i + 1
            break
    
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass
    
    return None
```

## 修复后验证

修复后取消 `test_nodes_execute_property.py` 中 9 个 skipped 测试的 skip 标记，重新运行：

```bash
.venv\Scripts\python -m pytest tests/test_nodes_execute_property.py -v
```

预期：所有 111 个用例全部通过（0 skipped）。

## 关联测试

| 测试文件 | 当前状态 | 修复后预期 |
|:---|:---|:---|
| `test_nodes_execute_property.py::TestJSONNodePostProcess::*[logic_switch]` | SKIPPED | PASSED |
| `test_nodes_execute_property.py::TestJSONNodePostProcess::*[loop_map]` | SKIPPED | PASSED |
| `test_nodes_execute_property.py::TestLLMNodeExecute::test_post_process_returns_node_output[logic_switch]` | SKIPPED | PASSED |
| `test_nodes_execute_property.py::TestLogicSwitchPostProcess::*` | SKIPPED (4) | PASSED |
