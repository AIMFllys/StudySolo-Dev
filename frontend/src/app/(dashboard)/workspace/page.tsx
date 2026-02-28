import Link from 'next/link';
import { cookies } from 'next/headers';

interface WorkflowMeta {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

async function fetchWorkflows(): Promise<WorkflowMeta[]> {
  const apiBase = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:2038';
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  try {
    const res = await fetch(`${apiBase}/api/workflow`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      // Revalidate every 30 seconds for near-real-time list
      next: { revalidate: 30 },
    });

    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: '草稿', className: 'bg-muted text-muted-foreground' },
    running: { label: '运行中', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    completed: { label: '已完成', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    error: { label: '错误', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };
  return map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Server Component — SSR workflow list
export default async function WorkspacePage() {
  const workflows = await fetchWorkflows();

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">我的工作流</h1>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <svg
            className="mb-4 opacity-30"
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
          >
            <rect x="4" y="4" width="40" height="40" rx="8" stroke="currentColor" strokeWidth="2" />
            <path d="M14 18h20M14 24h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-sm">还没有工作流</p>
          <p className="text-xs mt-1">点击右上角"新建工作流"开始</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => {
            const { label, className } = statusLabel(wf.status);
            return (
              <Link
                key={wf.id}
                href={`/workspace/${wf.id}`}
                className="group rounded-xl border border-border bg-card p-5 flex flex-col gap-2 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {wf.name}
                  </h2>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${className}`}
                  >
                    {label}
                  </span>
                </div>

                {wf.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{wf.description}</p>
                )}

                <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>更新于 {formatDate(wf.updated_at)}</span>
                  <span>创建于 {formatDate(wf.created_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
