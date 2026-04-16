import type { NodeManifestItem } from '@/types';
import type { AgentDirectoryItem, AgentModelsResponse } from '@/services/agent.service';

interface Props {
  manifestItem: NodeManifestItem | null;
  agentDirectoryItem: AgentDirectoryItem | null;
  agentModelsInfo: AgentModelsResponse | null;
  agentInfoError: string | null;
}

export function AgentBindingInfoPanel({ manifestItem, agentDirectoryItem, agentModelsInfo, agentInfoError }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-rose-200/70 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/10">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Agent 绑定信息</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          这个节点固定绑定到子后端 Agent，不支持切换到其他 Agent，只能选择该 Agent 提供的模型。
        </p>
      </div>

      <div className="grid gap-2 text-xs text-muted-foreground">
        <div>绑定 Agent：<span className="font-mono text-foreground">{manifestItem?.agent_name}</span></div>
        <div>
          健康状态：
          <span className={`ml-1 font-medium ${agentModelsInfo?.healthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
            {agentModelsInfo?.healthy ? 'healthy' : 'fallback / unavailable'}
          </span>
        </div>
        <div>
          模型来源：
          <span className="ml-1 text-foreground">
            {agentModelsInfo?.source === 'runtime' ? '子 Agent /v1/models' : 'agents.yaml 注册表回退'}
          </span>
        </div>
        <div>
          Skills：
          <span className={`ml-1 font-medium ${agentDirectoryItem?.skills_ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            {agentDirectoryItem?.skills_ready ? 'ready' : 'not-ready'}
          </span>
          <span className="ml-3">MCP：</span>
          <span className={`ml-1 font-medium ${agentDirectoryItem?.mcp_ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            {agentDirectoryItem?.mcp_ready ? 'ready' : 'not-ready'}
          </span>
        </div>
        {agentModelsInfo?.models.length ? (
          <div>可选模型：<span className="text-foreground">{agentModelsInfo.models.join(' / ')}</span></div>
        ) : null}
      </div>

      {(agentDirectoryItem?.capabilities ?? manifestItem?.output_capabilities ?? []).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(agentDirectoryItem?.capabilities ?? manifestItem?.output_capabilities ?? []).map((capability) => (
            <span
              key={capability}
              className="rounded-full border border-rose-300/70 bg-white/80 px-2 py-0.5 text-[11px] text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200"
            >
              {capability}
            </span>
          ))}
        </div>
      ) : null}

      {agentInfoError ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">{agentInfoError}</p>
      ) : null}
    </div>
  );
}
