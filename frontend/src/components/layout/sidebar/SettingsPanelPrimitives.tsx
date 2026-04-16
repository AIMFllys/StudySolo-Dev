import React from 'react';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 pb-6 border-b border-dashed border-border/50 last:border-0 last:pb-0">
      <p className="mb-3 text-[11px] font-medium tracking-[0.1em] text-muted-foreground/80">
        {title}
      </p>
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2.5 text-xs font-medium text-foreground transition-all hover:bg-muted/40"
    >
      {label}
      <div
        className={`node-paper-bg relative h-[22px] w-[38px] rounded-full border-[1.5px] transition-all shadow-sm ${
          checked ? 'border-primary/40' : 'border-border/60'
        }`}
      >
        <div
          className={`absolute top-[1.5px] h-[15px] w-[15px] rounded-full border-[1.5px] bg-background shadow-sm transition-transform ${
            checked ? 'translate-x-[18px] border-primary' : 'translate-x-[2px] border-border/60'
          }`}
        />
      </div>
    </button>
  );
}
