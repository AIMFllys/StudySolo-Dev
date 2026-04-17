'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Search, Plus, Loader2, Settings, LogOut, User } from 'lucide-react';
import { getUser, logout, type UserInfo } from '@/services/auth.service';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
  onNewWorkflow?: () => Promise<void> | void;
  creating?: boolean;
}

export default function Navbar({ onNewWorkflow, creating = false }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getUser().then(setUser).catch(() => null);
  }, []);

  async function handleNewWorkflow() {
    if (onNewWorkflow) {
      await onNewWorkflow();
    }
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <header className="h-14 flex items-center justify-between px-4 shrink-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="flex items-center gap-2 select-none">
        {/* Theme toggle — before logo */}
        <ThemeToggle />
        <div className="h-5 w-px bg-border/40" />
        <Zap className="w-5 h-5 text-primary fill-primary/20" />
        <span
          className="font-bold text-sm tracking-tight font-serif bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
        >
          StudySolo
        </span>
        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary rounded-md border border-primary/20">
          Beta
        </span>
      </div>

      {/* Search - desktop shows input, mobile shows icon */}
      <div className="hidden sm:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索工作流..."
            className="w-full bg-secondary/50 text-sm text-foreground placeholder-muted-foreground rounded-full py-1.5 pl-9 pr-4 border border-border focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>
      <button
        type="button"
        className="sm:hidden flex h-9 w-9 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="搜索"
      >
        <Search className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleNewWorkflow()}
          disabled={creating}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-glow hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-[0.98]"
        >
          {creating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Plus className="w-4 h-4" />
          }
          <span>{creating ? '创建中' : '新建'}</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold ring-2 ring-transparent hover:ring-primary transition-all overflow-hidden touch-target"
            aria-label="用户菜单"
          >
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-44 rounded-lg glass-card py-1 text-sm">
                {user ? (
                  <div className="px-3 py-2 text-muted-foreground truncate border-b border-border mb-1">
                    {user.email}
                  </div>
                ) : null}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/settings');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  设置
                </button>
                <button
                  onClick={() => void handleLogout()}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
