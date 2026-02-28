'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, logout, type UserInfo } from '@/services/auth.service';

interface NavbarProps {
  onNewWorkflow?: () => void;
}

export default function Navbar({ onNewWorkflow }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getUser().then(setUser).catch(() => null);
  }, []);

  async function handleNewWorkflow() {
    if (onNewWorkflow) {
      onNewWorkflow();
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/workflow', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '未命名工作流' }),
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || '创建失败');
      }
      const data = await res.json();
      router.push('/workspace/' + data.id);
    } catch (err) {
      console.error('创建工作流失败:', err);
      alert(err instanceof Error ? err.message : '创建工作流失败，请重试');
    } finally {
      setCreating(false);
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
    <header className="glass-panel h-14 flex items-center justify-between px-4 shrink-0 z-10">
      {/* Logo: primary bolt icon + gradient text */}
      <div className="flex items-center gap-2 select-none">
        <span
          className="material-symbols-outlined text-xl"
          style={{ color: '#6366F1' }}
        >
          bolt
        </span>
        <span
          className="font-bold text-sm tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #6366F1, #10B981)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          StudySolo
        </span>
      </div>

      {/* Center: Search box capsule shape */}
      <div className="hidden sm:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">
            search
          </span>
          <input
            type="text"
            placeholder="搜索工作流..."
            className="w-full bg-slate-900/50 text-sm text-[#F8FAFC] placeholder-[#94A3B8] rounded-full py-1.5 pl-9 pr-4 border border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#6366F1]/50 transition-all"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* New workflow button capsule + glow */}
        <button
          onClick={handleNewWorkflow}
          disabled={creating}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-glow hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-base leading-none">
            {creating ? 'hourglass_empty' : 'add'}
          </span>
          <span>{creating ? '创建中' : '新建'}</span>
        </button>

        {/* User avatar circle + hover primary ring */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold ring-2 ring-transparent hover:ring-primary transition-all overflow-hidden"
            aria-label="用户菜单"
          >
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-44 rounded-lg glass-card py-1 text-sm">
                {user && (
                  <div className="px-3 py-2 text-muted-foreground truncate border-b border-white/[0.08] mb-1">
                    {user.email}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
                >
                  退出登录
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}