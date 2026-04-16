import type { ReactNode } from 'react';
import { TableSkeletonRows } from '@/features/admin/shared';

interface WorkflowTableSectionProps {
  title: string;
  total: number;
  headers: string[];
  loading: boolean;
  emptyText: string;
  emptyColSpan: number;
  accentClassName: string;
  children: ReactNode;
  icon: string;
}

export function WorkflowTableSection({
  title,
  total,
  headers,
  loading,
  emptyText,
  emptyColSpan,
  accentClassName,
  children,
  icon,
}: WorkflowTableSectionProps) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className={`flex items-center justify-between border-b border-border px-6 py-4 bg-card ${accentClassName}`}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] opacity-70">{icon}</span>
          <h2 className="text-[13px] font-medium tracking-wide">{title}</h2>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground">
          共 {total} 条
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-card">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-6 py-3.5 text-[12px] font-medium tracking-wider text-muted-foreground/60 uppercase"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <TableSkeletonRows rows={3} cols={emptyColSpan} />
            ) : (
              children || (
                <tr>
                  <td
                    colSpan={emptyColSpan}
                    className="bg-card px-6 py-12 text-center text-[13px] font-medium tracking-wide text-muted-foreground"
                  >
                    {emptyText}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
