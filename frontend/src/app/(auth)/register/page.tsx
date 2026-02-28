'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { register } from '@/services/auth.service';

/* ─── Starfield + Code Rain CSS (same as login page) ─── */
const animationStyles = `
@keyframes twinkle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes drift {
  0% { transform: translateY(0); }
  100% { transform: translateY(4px); }
}
@keyframes codeRain {
  0% { transform: translateY(-100%); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(calc(100vh)); opacity: 0; }
}
`;

/* Generate deterministic star positions */
const stars = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: `${(i * 17 + 7) % 100}%`,
  top: `${(i * 23 + 13) % 100}%`,
  size: i % 3 === 0 ? 2 : 1,
  delay: `${(i * 0.3) % 4}s`,
  duration: `${2 + (i % 3)}s`,
}));

/* Code rain columns */
const codeChars = ['0', '1', '{', '}', '<', '>', '/', '=', ';', 'fn', 'if', '()'];
const rainColumns = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: `${5 + i * 10}%`,
  char: codeChars[i % codeChars.length],
  delay: `${(i * 0.7) % 5}s`,
  duration: `${4 + (i % 3) * 2}s`,
}));

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register(email, password);
      router.push('/workspace');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      <div className="min-h-screen flex bg-[#020617]">
        {/* ─── Left: Brand Area (hidden on mobile) ─── */}
        <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-[#050B1D] items-center justify-center">
          {/* Starfield */}
          <div className="absolute inset-0" aria-hidden="true">
            {stars.map((star) => (
              <div
                key={star.id}
                className="absolute rounded-full bg-white"
                style={{
                  left: star.left,
                  top: star.top,
                  width: star.size,
                  height: star.size,
                  animation: `twinkle ${star.duration} ease-in-out ${star.delay} infinite, drift ${star.duration} ease-in-out ${star.delay} infinite alternate`,
                }}
              />
            ))}
          </div>

          {/* Code Rain */}
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            {rainColumns.map((col) => (
              <span
                key={col.id}
                className="absolute text-[10px] font-mono text-primary/20 select-none"
                style={{
                  left: col.left,
                  top: 0,
                  animation: `codeRain ${col.duration} linear ${col.delay} infinite`,
                }}
              >
                {col.char}
              </span>
            ))}
          </div>

          {/* Decorative glow */}
          <div
            className="absolute top-1/4 left-1/3 w-[300px] h-[300px] rounded-full opacity-20 pointer-events-none"
            style={{ background: 'rgba(99, 102, 241, 0.3)', filter: 'blur(100px)' }}
            aria-hidden="true"
          />

          {/* Brand content */}
          <div className="relative z-10 text-center px-12 max-w-md">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                bolt
              </span>
              <span className="text-4xl font-bold bg-gradient-to-r from-primary to-[#818CF8] bg-clip-text text-transparent">
                StudySolo
              </span>
            </div>

            {/* Tagline */}
            <h1 className="text-2xl md:text-3xl font-bold text-white/90 leading-tight mb-4">
              AI 驱动的学习工作流平台
            </h1>
            <p className="text-sm text-white/50 leading-relaxed mb-8">
              一句话，生成完整的学习工作流。从大纲到知识提炼，从总结到闪卡，全程 AI 驱动。
            </p>

            {/* Feature pills */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: 'auto_awesome', label: '智能大纲' },
                { icon: 'psychology', label: '知识提炼' },
                { icon: 'summarize', label: '总结归纳' },
                { icon: 'style', label: '闪卡生成' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/60 text-xs"
                >
                  <span className="material-symbols-outlined text-sm text-primary/70">
                    {item.icon}
                  </span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Right: Register Form ─── */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-[#020617]">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-8 md:hidden">
              <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                bolt
              </span>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-[#818CF8] bg-clip-text text-transparent">
                StudySolo
              </span>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">创建账号</h2>
              <p className="text-sm text-[#94A3B8] mt-1">开始你的 AI 学习之旅</p>
            </div>

            {/* Social Register */}
            <div className="flex gap-3 mb-6">
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-[#0F172A]/80 border border-white/[0.08] text-sm text-white/80 hover:bg-[#1E293B]/80 hover:border-white/[0.12] transition-all active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </button>
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white/80 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-xs text-[#94A3B8]">或使用邮箱注册</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium text-white/80">
                  姓名
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的名字"
                  className="h-10 rounded-lg bg-[#0F172A]/50 border border-white/[0.08] px-3 text-sm text-white placeholder:text-[#94A3B8]/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-white/80">
                  邮箱
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 rounded-lg bg-[#0F172A]/50 border border-white/[0.08] px-3 text-sm text-white placeholder:text-[#94A3B8]/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-white/80">
                  密码
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位"
                  minLength={8}
                  className="h-10 rounded-lg bg-[#0F172A]/50 border border-white/[0.08] px-3 text-sm text-white placeholder:text-[#94A3B8]/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-white/80">
                  确认密码
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  minLength={8}
                  className="h-10 rounded-lg bg-[#0F172A]/50 border border-white/[0.08] px-3 text-sm text-white placeholder:text-[#94A3B8]/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 h-10 rounded-lg bg-primary text-white text-sm font-medium hover:bg-[#4F46E5] shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? '注册中...' : '创建账号'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#94A3B8]">
              已有账号？{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
