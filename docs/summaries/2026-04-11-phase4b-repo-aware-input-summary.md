<!-- 编码：UTF-8 -->

# StudySolo 2026-04-11 阶段总结：Phase 4B `code-review-agent` repo-aware 前置输入能力

**完成日期**：2026-04-11  
**状态**：Phase 4B 已补齐 repo-aware 的第一步输入基线，但当前仍不读取本地仓库，也不进行完整跨文件推理  
**覆盖范围**：`code-review-agent` 的结构化 user message 解析、review target 路径注入、repo context 计数展示，以及对应逻辑测试

## 1. 执行摘要

这轮工作的重点不是把 `code-review-agent` 一次性做成完整 repo-aware 审查器，而是先解决一个更基础的问题：**仓库上下文应该如何进入 Agent**。

在不改冻结契约、不加 body 字段、不碰 Gateway 的前提下，本轮把 repo context 的输入载体固定成了：

1. 单条最新 `user` 消息
2. 其中可包含：
   - `<review_target path="...">...</review_target>`
   - `<repo_context path="...">...</repo_context>`

本轮完成后，Agent 已能识别这种结构化封装格式，并在保持现有协议兼容的前提下，把 repo context 纳入 review 输入流程；但 heuristics 仍然只扫描 `review_target`，不会直接对 context 文件单独报问题。

## 2. 改动前的真实状态

在本轮开始前，`code-review-agent` 已经具备：

1. 最小 OpenAI-compatible 协议
2. 7 条固定规则
3. 多文件 unified diff 感知
4. `Summary + Findings + Limitations` 文本输出

但仍然存在一个实际缺口：

1. 只会读取最后一条 `user` 消息的原始文本
2. 没有任何 repo context 输入约定
3. 普通 snippet / plain_text 在没有 diff header 时无法稳定带出目标文件路径

所以，“继续做 repo-aware”在这一步真正需要先补的，不是文件系统读取，而是**输入协议内的承载约定**。

## 3. 本轮已完成的代码闭环

### 3.1 新增结构化 user message 解析

文件：

- `agents/code-review-agent/src/core/agent.py`

本轮新增了单条 `user` 消息内的结构化封装能力：

1. `<review_target path="...">...</review_target>`
   - 取第一个有效块作为当前真正要审查的目标
2. `<repo_context path="...">...</repo_context>`
   - 可提供零到多个辅助上下文块

解析规则保持保守：

1. 没有 `review_target` → 回退到 legacy 行为
2. 标签 malformed / 未闭合 / 空内容 → fail-open 回退到 legacy
3. 不新增错误响应，不影响协议层

### 3.2 review 行为仍然只作用于 target

本轮特意把边界锁死为：

1. heuristics 只扫描 `review_target`
2. `repo_context` 不单独产出 findings

这样做是为了避免把“提供上下文”直接扩成“上下文本身也被审查并报错”，从而导致误报面在这一步骤过快膨胀。

### 3.3 输出有两处可见增强

本轮新增了两处对结果可见、但不破坏现有消费者的增强：

1. 当 `review_target path` 存在时：
   - 普通 snippet / plain_text findings 也会输出 `File: path:line`
2. 当存在 `repo_context` 时：
   - `Summary` 增加 `Context files supplied: N`

此外，headerless unified diff 也不再一律落到 `<unknown>`，而是优先使用 `review_target path` 作为目标文件路径。

### 3.4 Limitations 口径同步更新

这轮还把结尾的 `Limitations` 改得更准确：

1. 已支持结构化 repo context 输入
2. 仍无跨文件控制流分析
3. 仍无全仓库推理
4. 仍无外部模型 reasoning
5. `repo_context` 仍不会单独产生 findings

## 4. 测试与验证

文件：

- `agents/code-review-agent/tests/test_review_logic.py`

本轮新增并通过的关键用例包括：

1. `<review_target path="...">` 下普通 snippet 输出 `File: path:line`
2. headerless diff 使用 `review_target path`
3. `repo_context` 只计数、不报问题
4. malformed `review_target` 安全回退到 legacy
5. `complete()` 仍只看最后一条 `user` 消息

### 实际结果

- `pytest agents/code-review-agent/tests -q`
  - 结果：`30 passed`

这说明：

1. 现有 contract tests 没被新输入能力破坏
2. legacy 行为保持兼容
3. repo-aware 前置输入能力已形成稳定测试基线

## 5. 当前边界与下一步

本轮完成后，Phase 4B 对 `code-review-agent` 的准确口径应更新为：

1. 已具备结构化 repo-aware 前置输入能力
2. 但 repo context 仍是“调用方显式喂入”的外部上下文
3. Agent 仍不读取本地仓库
4. 仍不做完整跨文件推理
5. 仍不接外部 LLM

因此，这轮是 repo-aware 的**第一步输入基线**，不是完整 repo-aware 审查的终点。

如果继续深化，下一步更合理的方向会是：

1. 稳固 findings 结构与输出稳定性
2. 评估 repo context 如何进一步影响 summary / evidence / ranking
3. 再决定是否进入外部 LLM 或 Gateway 集成前置设计

## 6. 本轮提交

- `55a1cc8 feat(code-review-agent): support repo-aware input envelope`
