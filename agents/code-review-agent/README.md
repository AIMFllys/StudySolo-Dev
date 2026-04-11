# Code Review Agent

> 状态：🔨 规则型本地审查 Agent 已落地（含 repo-aware 前置输入能力）
> 负责人：小李
> 端口：8001
> 来源：新建

---

## 用途

自动化代码审查 Agent。当前版本已经具备 Phase 4B 所需的最小 OpenAI-compatible 协议、规则型本地审查能力，以及单条 `user` 消息内的结构化 repo context 前置输入能力。

## 当前能力

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- non-stream JSON 响应
- SSE stream 响应
- API Key 校验
- 输入识别：`unified_diff / code_snippet / plain_text`
- 7 条固定规则：硬编码密钥、危险动态执行、危险 HTML sink、Shell 命令执行、关闭 TLS 校验、调试遗留、宽泛吞错
- 多文件 unified diff 感知：文件路径、目标新增行号、同规则同文件去重
- 结构化 repo-aware 前置输入：
  - `<review_target path="...">...</review_target>`
  - `<repo_context path="...">...</repo_context>`
  - 仍只对 `review_target` 出 findings，`repo_context` 只做辅助上下文

## 运行

```bash
cd agents/code-review-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m src.main
```

## 验证

```bash
pytest tests -q
```

## 结构化输入示例

````text
<review_target path="frontend/app.tsx">
```tsx
console.log('debug');
```
</review_target>

<repo_context path="frontend/lib/logger.ts">
```ts
export function debugLog(message: string) {
  return console.log(message);
}
```
</repo_context>
````

说明：

- 继续只读取最后一条 `user` 消息
- 若不存在 `<review_target>`，会回退到 legacy 行为：整条 `user` 消息都作为 review target
- `repo_context` 不单独产生 findings，只用于补充上下文计数与后续 repo-aware 演进入口

## 说明

- 当前 `src/core/agent.py` 不调用外部模型
- 当前为本地启发式规则审查，不读取本地仓库文件
- 输出保持 `Summary + Findings + Limitations`
- 后续如果接真实仓库分析或上游 LLM，仍以 `src/core/agent.py` 为主扩展点

## 参考

- [Agent 开发指南](../README.md)
- [接口协议规范](../../docs/team/refactor/final-plan/agent-architecture.md)
