'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin } from '@/services/admin.service';
import { useAdminStore } from '@/stores/use-admin-store';

const LOCK_FAILS_KEY = 'admin_lock_fails';
const LOCK_WINDOW_MS = 3 * 60 * 1000;
const LOCK_LIMIT = 5;

function loadRecentFails() {
  const now = Date.now();
  const fails = JSON.parse(localStorage.getItem(LOCK_FAILS_KEY) || '[]') as number[];
  const recentFails = fails.filter((timestamp) => now - timestamp < LOCK_WINDOW_MS);
  localStorage.setItem(LOCK_FAILS_KEY, JSON.stringify(recentFails));
  return recentFails;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdmin } = useAdminStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keepSession, setKeepSession] = useState(false);

  useEffect(() => {
    try {
      if (loadRecentFails().length >= LOCK_LIMIT) {
        window.location.replace('/404');
      }
    } catch {
      // Ignore malformed storage payloads.
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const data = await adminLogin(username, password);
      localStorage.removeItem(LOCK_FAILS_KEY);
      setAdmin(data.admin);
      router.push(data.admin.force_change_password ? '/admin-analysis/change-password' : '/admin-analysis');
    } catch {
      const fails = JSON.parse(localStorage.getItem(LOCK_FAILS_KEY) || '[]') as number[];
      fails.push(Date.now());
      localStorage.setItem(LOCK_FAILS_KEY, JSON.stringify(fails));
      window.location.replace('/404');
    }
  };

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-50">
      {/* ─── Left decorative panel ─── */}
      <section className="relative hidden w-[52%] overflow-hidden lg:flex lg:flex-col lg:justify-between bg-slate-900">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Indigo glow blob */}
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -bottom-32 right-0 h-[360px] w-[360px] rounded-full bg-indigo-500/10 blur-[100px]" />

        {/* Logo mark */}
        <div className="relative z-10 px-14 pt-14">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg ring-1 ring-white/10">
            <span className="font-bold text-xl text-white tracking-tight">S</span>
          </div>
          <p className="mt-3 text-[11px] font-bold tracking-[0.3em] text-slate-500 uppercase">
            StudySolo · Admin
          </p>
        </div>

        {/* Main copy */}
        <div className="relative z-10 px-14 pb-20 space-y-10">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold leading-tight tracking-tight text-white">
              数据主权
              <br />
              <span className="text-indigo-400">学术自由的基础</span>
            </h1>
            <p className="max-w-xs text-base leading-relaxed text-slate-400">
              后台强调最小权限、可追踪治理与稳定的研究工作流，为每一次管理操作提供清晰的审计边界。
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-6">
            {[
              { label: '安全协议', value: 'AES-256', sub: '端到端加密' },
              { label: '访问权限', value: '受限节点', sub: '学术专属' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              >
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">{item.label}</p>
                <p className="mt-2 text-base font-semibold text-white">{item.value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/5 px-14 py-5">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-[11px] font-semibold tracking-wider text-slate-500">系统加密在线</span>
          </div>
          <span className="material-symbols-outlined text-slate-600">shield_lock</span>
        </div>
      </section>

      {/* ─── Right login panel ─── */}
      <section className="relative flex w-full flex-col items-center justify-center bg-slate-50 px-8 lg:w-[48%] lg:px-16">
        <div className="w-full max-w-md">
          {/* Header */}
          <header className="mb-10 space-y-2">
            <p className="text-[11px] font-bold tracking-[0.25em] text-slate-400 uppercase">
              身份验证管理单元
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">访问授权登录</h2>
            <p className="text-sm text-slate-500">仅限授权管理员登录，所有操作均被审计记录。</p>
          </header>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700">
                管理账号
              </label>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
                  person
                </span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={loading}
                  required
                  placeholder="输入管理员账号"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                登录密码
              </label>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  required
                  placeholder="请输入登录密码"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  tabIndex={-1}
                  className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400 transition-colors hover:text-slate-700"
                >
                  {showPassword ? 'visibility' : 'visibility_off'}
                </button>
              </div>
            </div>

            {/* Keep session */}
            <label className="flex cursor-pointer items-center gap-3 select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={keepSession}
                  onChange={(e) => setKeepSession(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-5 w-5 rounded-md border-2 border-slate-300 bg-white transition-all peer-checked:border-indigo-600 peer-checked:bg-indigo-600" />
                {keepSession && (
                  <span className="material-symbols-outlined pointer-events-none absolute left-0.5 top-0.5 text-[14px] font-bold text-white" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
                    check
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-slate-600">保持活跃会话</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition-all hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  身份校验中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    fingerprint
                  </span>
                  进入后台
                  <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="mt-10 text-center text-[11px] leading-relaxed text-slate-400">
            本系统访问行为将被完整记录到审计日志。
            <br />
            未经授权的访问尝试将被限制并追踪。
          </p>
        </div>
      </section>
    </div>
  );
}
