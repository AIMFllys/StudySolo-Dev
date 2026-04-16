import '@/app/globals.css';
import SessionRefresher from '@/app/s/[id]/SessionRefresher';
import Link from 'next/link';

export default function MemoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <SessionRefresher />

      {/* Floating minimalist top bar over the canvas */}
      <header className="absolute top-0 left-0 right-0 z-50 px-4 py-3 pointer-events-none">
        <div className="flex items-center justify-between max-w-7xl mx-auto pointer-events-auto">
          <Link
            href="/workspace"
            className="flex items-center gap-2 rounded-md bg-background/80 backdrop-blur-md px-3 py-1.5 border border-border/50 text-sm font-serif font-semibold text-foreground shadow-sm hover:bg-background/90 transition-all group"
            title="返回工作台"
          >
            ← <span className="group-hover:opacity-80 transition-opacity">StudySolo</span>
          </Link>
          <div className="rounded-md bg-background/80 backdrop-blur-md px-3 py-1.5 border border-border/50 text-xs text-muted-foreground shadow-sm font-serif">
            运行记忆 · Memory View
          </div>
        </div>
      </header>

      {/* Canvas spans the entire wrapper */}
      <main className="absolute inset-0 block h-full w-full">{children}</main>
    </div>
  );
}
