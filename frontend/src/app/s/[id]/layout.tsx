import '@/app/globals.css';

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal top bar for shared/public views */}
      <header className="shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <a
            href="/workspace"
            className="text-sm font-serif font-semibold text-foreground hover:opacity-80 transition-opacity"
          >
            StudySolo
          </a>
          <span className="text-xs text-muted-foreground">公开工作流</span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
