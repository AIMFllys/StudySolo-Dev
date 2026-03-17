'use client';

import { ChevronDown } from 'lucide-react';
import { usePanelStore } from '@/stores/use-panel-store';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export function CollapsibleSection({ id, title, badge, children }: CollapsibleSectionProps) {
  const { collapsedSections, toggleSection } = usePanelStore();
  const isCollapsed = !!collapsedSections[id];

  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
              isCollapsed ? '-rotate-90' : ''
            }`}
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground truncate">
            {title}
          </span>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
        }`}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </section>
  );
}
