# 前端 Agent 接口规范

> 目标：定义前端如何调用子后端 Agent

---

## 1. 前端调用架构

### 1.1 当前架构

```
前端 → 主后端 → AI Provider (OpenAI/DeepSeek/etc.)
```

### 1.2 目标架构

```
前端 → 主后端 → 子后端 Agent → AI Provider
                ↑
                └───────────── 直接调用（可选）
```

### 1.3 调用场景

| 场景 | 调用路径 | 说明 |
|------|---------|------|
| 工作流执行 | 主后端直接调用 AI | 标准节点执行 |
| 子 Agent 调用 | 主后端 → 子 Agent | 特殊功能（代码审查等）|
| 前端直接调用 | 前端 → 子 Agent | 需要用户实时交互的功能 |

---

## 2. Agent 注册与发现

### 2.1 主后端维护 Agent 注册表

```python
# backend/app/models/agent.py
from pydantic import BaseModel
from typing import Optional

class AgentConfig(BaseModel):
    name: str                    # "code-review"
    display_name: str            # "代码审查"
    description: str
    url: str                     # "http://localhost:8001"
    icon: str                    # "🔍"
    capabilities: list[str]       # ["code_review", "security_scan"]
    requires_user_input: bool    # 是否需要用户输入额外参数
    version: str = "1.0.0"

class AgentRegistry:
    def __init__(self):
        self.agents: dict[str, AgentConfig] = {}

    def register(self, config: AgentConfig):
        self.agents[config.name] = config

    def get(self, name: str) -> Optional[AgentConfig]:
        return self.agents.get(name)

    def list_all(self) -> list[AgentConfig]:
        return list(self.agents.values())

# 配置
# backend/config.yaml
agents:
  code_review:
    url: ${CODE_REVIEW_AGENT_URL}
    display_name: "代码审查"
    capabilities:
      - code_review
      - security_scan
    requires_user_input: false
  doc_generator:
    url: ${DOC_GENERATOR_AGENT_URL}
    display_name: "文档生成"
    capabilities:
      - doc_generation
      - api_doc
    requires_user_input: true
```

### 2.2 Agent 元信息 API

```python
# backend/app/api/agents.py
from fastapi import APIRouter
from .agent import agent_registry

router = APIRouter()

@router.get("/agents")
async def list_agents():
    """获取所有可用 Agent"""
    agents = agent_registry.list_all()
    return {
        "agents": [
            {
                "name": a.name,
                "display_name": a.display_name,
                "description": a.description,
                "icon": a.icon,
                "capabilities": a.capabilities,
                "requires_user_input": a.requires_user_input,
            }
            for a in agents
        ]
    }

@router.get("/agents/{name}")
async def get_agent(name: str):
    """获取单个 Agent 详情"""
    agent = agent_registry.get(name)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent
```

---

## 3. 前端 Agent 调用流程

### 3.1 获取 Agent 列表

```typescript
// services/agent.service.ts
import { fetchJSON } from '@/services/api-client';

export interface Agent {
  name: string;
  display_name: string;
  description: string;
  icon: string;
  capabilities: string[];
  requires_user_input: boolean;
}

export async function listAgents(): Promise<Agent[]> {
  const response = await fetchJSON<{ agents: Agent[] }>('/api/agents');
  return response.agents;
}
```

### 3.2 调用 Agent

```typescript
// services/agent.service.ts

export interface AgentCallOptions {
  agentName: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  stream?: boolean;
  onToken?: (token: string) => void;
}

export async function callAgent({
  agentName,
  messages,
  stream = false,
  onToken,
}: AgentCallOptions) {
  if (stream) {
    // 流式调用
    const response = await fetch('/api/agents/' + agentName + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream: true }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // 解析 SSE 事件
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.content) {
            onToken?.(data.content);
          }
        }
      }
    }
  } else {
    // 非流式调用
    const response = await fetchJSON<{
      choices: Array<{ message: { content: string } }>;
    }>('/api/agents/' + agentName + '/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
    return response.choices[0].message.content;
  }
}
```

---

## 4. 工作流节点集成

### 4.1 Agent 节点类型

新增节点类型 `agent_call`：

```typescript
// frontend/src/types/workflow.ts
interface AgentCallNodeData extends NodeData {
  type: 'agent_call';
  agentName: string;
  prompt: string;
  outputFormat: 'markdown' | 'json';
}
```

### 4.2 Agent 节点配置 UI

```typescript
// frontend/src/features/workflow/components/node-config/AgentNodeConfig.tsx

interface AgentNodeConfigProps {
  nodeId: string;
  data: AgentCallNodeData;
}

export function AgentNodeConfig({ nodeId, data }: AgentNodeConfigProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(data.agentName || '');
  const [prompt, setPrompt] = useState(data.prompt || '');

  useEffect(() => {
    listAgents().then(setAgents);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label>选择 Agent</label>
        <select
          value={selectedAgent}
          onChange={(e) => {
            setSelectedAgent(e.target.value);
            updateNodeData(nodeId, { agentName: e.target.value });
          }}
        >
          <option value="">选择 Agent...</option>
          {agents.map((agent) => (
            <option key={agent.name} value={agent.name}>
              {agent.icon} {agent.display_name}
            </option>
          ))}
        </select>
      </div>

      {selectedAgent && (
        <div className="text-sm text-muted">
          {agents.find((a) => a.name === selectedAgent)?.description}
        </div>
      )}

      <div>
        <label>提示词</label>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            updateNodeData(nodeId, { prompt: e.target.value });
          }}
          placeholder="输入你想让 Agent 做的事..."
        />
      </div>
    </div>
  );
}
```

### 4.3 Agent 节点执行

```python
# backend/app/nodes/agent_call/node.py

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.services.agent_caller import AgentCaller

class AgentCallNode(BaseNode):
    node_type = "agent_call"
    category = "agent"
    description = "调用子后端 Agent"
    output_format = "markdown"

    async def execute(self, node_input: NodeInput, llm_caller) -> AsyncIterator[str]:
        agent_name = node_input.node_config.get("agent_name")
        prompt = node_input.node_config.get("prompt", "")

        # 构建消息
        upstream_context = self.build_upstream_context(node_input.upstream_outputs)
        messages = [
            {"role": "system", "content": f"你是一个助手。{upstream_context}"},
            {"role": "user", "content": prompt},
        ]

        # 调用 Agent
        agent_caller = AgentCaller()
        result = await agent_caller.call(agent_name, messages)

        yield result
```

---

## 5. 实时交互式 Agent 调用

### 5.1 场景

用户在工作流中调用代码审查 Agent，需要：
1. 用户输入要审查的代码
2. Agent 实时返回审查结果
3. 结果展示在工作流中

### 5.2 前端实现

```typescript
// features/workflow/hooks/use-agent-stream.ts

export function useAgentStream() {
  const [tokens, setTokens] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortController = useRef<AbortController | null>(null);

  const startStream = async (agentName: string, messages: Message[]) => {
    abortController.current = new AbortController();
    setIsStreaming(true);
    setTokens([]);

    try {
      const response = await fetch(`/api/agents/${agentName}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, stream: true }),
        signal: abortController.current.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              setTokens((prev) => [...prev, data.content]);
            }
            if (data.done) {
              break;
            }
          }
        }
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const stop = () => {
    abortController.current?.abort();
  };

  return { tokens, isStreaming, startStream, stop };
}
```

---

## 6. Agent 结果聚合

### 6.1 多 Agent 结果合并

当工作流有多个 Agent 节点时，结果如何处理：

```python
# backend/app/nodes/agent_call/node.py

class AgentCallNode(BaseNode):
    async def post_process(self, raw_output: str) -> NodeOutput:
        # 如果输出是 JSON（某些 Agent 返回结构化结果）
        try:
            parsed = json.loads(raw_output)
            return NodeOutput(
                content=json.dumps(parsed, ensure_ascii=False, indent=2),
                format="json",
                metadata={"agent_output": parsed}
            )
        except:
            return NodeOutput(content=raw_output, format="markdown")
```

---

## 7. 错误处理

### 7.1 前端错误处理

```typescript
// services/agent.service.ts

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public agentName?: string
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export async function callAgent(options: AgentCallOptions) {
  try {
    return await agentCall(options);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AgentError('用户取消了请求', 'ABORTED');
    }
    if (error.response?.status === 503) {
      throw new AgentError('Agent 服务暂时不可用', 'SERVICE_UNAVAILABLE', options.agentName);
    }
    if (error.response?.status === 404) {
      throw new AgentError('Agent 不存在', 'NOT_FOUND', options.agentName);
    }
    throw new AgentError(
      error.message || 'Agent 调用失败',
      'UNKNOWN_ERROR',
      options.agentName
    );
  }
}
```

### 7.2 后端错误传播

```python
# backend/app/services/agent_caller.py

class AgentCallerError(Exception):
    def __init__(self, message: str, agent_name: str, status_code: int = None):
        self.message = message
        self.agent_name = agent_name
        self.status_code = status_code
        super().__init__(f"Agent '{agent_name}' error: {message}")

async def call_agent(agent_name: str, messages: list[dict]) -> dict:
    agent_config = agent_registry.get(agent_name)
    if not agent_config:
        raise AgentCallerError("Agent not found", agent_name, 404)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{agent_config.url}/v1/chat/completions",
                json={"model": agent_name, "messages": messages},
                timeout=30,
            )
            if response.status_code != 200:
                raise AgentCallerError(
                    response.text,
                    agent_name,
                    response.status_code
                )
            return response.json()
    except httpx.TimeoutException:
        raise AgentCallerError("Agent request timeout", agent_name, 408)
    except httpx.ConnectError:
        raise AgentCallerError("Agent service unavailable", agent_name, 503)
```

---

## 8. 安全性

### 8.1 子 Agent 认证（可选）

如果 Agent 需要认证：

```python
# backend/app/services/agent_caller.py

async def call_agent_with_auth(agent_name: str, messages: list[dict]) -> dict:
    agent_config = agent_registry.get(agent_name)

    headers = {}
    if agent_config.api_key:
        headers["Authorization"] = f"Bearer {agent_config.api_key}"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{agent_config.url}/v1/chat/completions",
            json={"model": agent_name, "messages": messages},
            headers=headers,
            timeout=30,
        )
        return response.json()
```

### 8.2 前端代理

前端不直接调用子 Agent，通过主后端代理：

```python
# backend/app/api/agents.py

@router.post("/agents/{agent_name}/chat")
async def agent_chat_proxy(
    agent_name: str,
    body: dict,
    current_user = Depends(get_current_user),
):
    # 速率限制
    await rate_limit(f"agent:{agent_name}", current_user["id"], limit=10, window=60)

    # 调用 Agent
    result = await agent_caller.call(agent_name, body["messages"])

    return result
```

---

## 9. 类型定义

### 9.1 TypeScript 类型

```typescript
// types/agent.ts

export interface Agent {
  name: string;
  display_name: string;
  description: string;
  icon: string;
  capabilities: string[];
  requires_user_input: boolean;
  version: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentStreamEvent {
  id: string;
  object: 'chat.completion.chunk';
  choices: Array<{
    index: number;
    delta: { content?: string };
    finish_reason: string | null;
  }>;
}

export interface AgentResponse {
  id: string;
  object: 'chat.completion';
  choices: Array<{
    message: { role: 'assistant'; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### 9.2 Python 类型

```python
# backend/app/models/agent.py

from pydantic import BaseModel
from typing import Optional

class AgentMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str

class AgentChatRequest(BaseModel):
    model: str
    messages: list[AgentMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: Optional[bool] = False

class AgentChatResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    choices: list[dict]
    usage: dict
```
