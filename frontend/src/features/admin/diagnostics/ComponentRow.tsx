import {
  formatLatency,
  getStatusColor,
  getStatusBgColor,
  getStatusIcon,
  type ComponentCheckResult,
} from '@/services/diagnostics';

interface ComponentRowProps {
  component: ComponentCheckResult;
  expanded: boolean;
  onToggle: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  database: '数据库',
  ai_model: 'AI 模型',
  agent: 'Agent',
  external_api: '外部 API',
  internal_service: '内部服务',
};

export function ComponentRow({ component, expanded, onToggle }: ComponentRowProps) {
  return (
    <div className={getStatusBgColor(component.status)}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background">
          <span className={`material-symbols-outlined text-[18px] ${getStatusColor(component.status)}`}>
            {getStatusIcon(component.status)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{component.name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {CATEGORY_LABELS[component.category]}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {formatLatency(component.latency_ms)}
          </div>
        </div>

        {component.error && !expanded && (
          <div className="max-w-xs truncate text-sm text-red-600">{component.error}</div>
        )}

        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={expanded ? '收起详情' : '查看详情'}
        >
          <span className="material-symbols-outlined text-[18px]">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-2">
          {component.error && (
            <div className="mb-3 rounded-md bg-red-50 p-3">
              <div className="text-sm font-medium text-red-800">错误信息</div>
              <div className="mt-1 text-sm text-red-700">{component.error}</div>
            </div>
          )}
          {component.details && Object.keys(component.details).length > 0 && (
            <div className="rounded-md bg-muted p-3">
              <div className="text-sm font-medium text-foreground">详细信息</div>
              <pre className="mt-2 max-h-40 overflow-auto text-xs text-muted-foreground">
                {JSON.stringify(component.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
