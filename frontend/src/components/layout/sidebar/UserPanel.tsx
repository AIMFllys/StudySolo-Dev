'use client';

import { useEffect, useState } from 'react';
import { Mail, UserCheck, Shield, ExternalLink, ChevronRight } from 'lucide-react';
import { getUser, getTierLabel, type UserInfo } from '@/services/auth.service';

export default function UserPanel() {
  const [user, setUser] = useState<UserInfo | null>(null);

  const fetchUser = () => {
    getUser().then(setUser).catch(() => null);
  };

  useEffect(() => {
    fetchUser();
    window.addEventListener('studysolo:tier-refresh', fetchUser);
    return () => window.removeEventListener('studysolo:tier-refresh', fetchUser);
  }, []);

  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        {/* Avatar + Name card */}
        <div className="border-b border-border px-4 py-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={`node-paper-bg flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-foreground overflow-hidden shadow-sm border-[1.5px] ${
                user?.tier === 'ultra' ? 'border-amber-400 text-amber-900 dark:text-amber-200' :
                user?.tier === 'pro' ? 'border-slate-400 text-slate-900 dark:text-slate-200' :
                user?.tier === 'pro_plus' ? 'border-emerald-400 text-emerald-900 dark:text-emerald-200' :
                'border-border/50 text-foreground'
              }`}>
                {user?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              
              {/* Tier Badge */}
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-widest shadow-sm z-10 whitespace-nowrap border-[1.5px] font-mono node-paper-bg
                ${user?.tier === 'ultra' ? 'text-amber-900 dark:text-amber-200 border-amber-300' :
                  user?.tier === 'pro' ? 'text-slate-900 dark:text-slate-200 border-slate-300' :
                  user?.tier === 'pro_plus' ? 'text-emerald-900 dark:text-emerald-200 border-emerald-300' :
                  'text-foreground border-border/50'
                }
              `}>
                {getTierLabel(user?.tier)}
              </div>
            </div>
            <div className="min-w-0 flex-1 pl-2">
              <p className="truncate text-sm font-bold font-serif text-foreground">
                {user?.name || '用户'}
              </p>
              <p className="truncate text-[11px] font-mono text-muted-foreground mt-0.5 opacity-80">
                {user?.email || '加载中...'}
              </p>
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="space-y-1 px-2 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-[11px]">{user?.email || '–'}</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px]">角色：{user?.role || '用户'}</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-muted-foreground">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px]">账户状态：正常</span>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          </div>
        </div>

        {/* Quick actions */}
        <div className="border-t border-border px-2 py-3">
          <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
            快捷操作
          </p>
          <div className="space-y-0.5">
            <a
              href="https://docs.1037solo.com/#/docs/studysolo-intro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              查看使用手册
              <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/30" />
            </a>
            <a
              href="https://github.com/AIMFllys/StudySolo/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              反馈问题
              <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/30" />
            </a>
          </div>
        </div>

        {/* Version info */}
        <div className="border-t border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-foreground">StudySolo</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">v0.2.001 · MVP</p>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              <span className="text-[10px] font-medium text-primary">在线</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
