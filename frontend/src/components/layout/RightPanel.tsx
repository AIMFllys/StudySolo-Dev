'use client';

import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { AIStepNodeData } from '@/types';
import Link from 'next/link';

/* ── Status indicator row ─────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '待执行', color: 'bg-gray-400' },
  running: { label: '执行中', color: 'bg-blue-400' },
  done:    { label: '已完成', color: 'bg-green-400' },
  error:   { label: '错误',   color: 'bg-red-400' },
};

function StatusItem({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-medium text-foreground">{count}</span>
    </div>
  );
}

/* ── RightPanel ───────────────────────────────────────── */

export default function RightPanel() {
  const nodes = useWorkflowStore((s) => s.nodes);

  const statusCounts = nodes.reduce<Record<string, number>>((acc, node) => {
    const status = (node.data as AIStepNodeData)?.status ?? 'pending';
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <aside className="hidden md:flex flex-col w-60 border-l border-white/[0.08] bg-[#020617] p-4 shrink-0">
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">执行概览</h3>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <StatusItem key={key} label={cfg.label} count={statusCounts[key] ?? 0} color={cfg.color} />
        ))}
      </section>

      <Link
        href="/settings"
        className="mt-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ⚙ 设置
      </Link>
    </aside>
  );
}
