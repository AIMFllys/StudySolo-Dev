'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import {
  clearRememberedCredentials,
  loadRememberedCredentials,
  saveRememberedCredentials,
} from '@/services/auth-credentials.service';
import { login } from '@/services/auth.service';
import { AuthShell } from '@/features/auth/components';
import { LogIn } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/workspace';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const justRegistered = searchParams.get('registered') === 'true';
  const resetSuccess = searchParams.get('reset') === 'success';

  useEffect(() => {
    const savedCredentials = loadRememberedCredentials();
    if (!savedCredentials) {
      return;
    }

    setEmail(savedCredentials.email);
    setRemember(savedCredentials.remember);
  }, []);

  useEffect(() => {
    if (!remember) {
      clearRememberedCredentials();
    }
  }, [remember]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password, remember);
      const supabase = createClient();
      await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });

      if (remember) {
        saveRememberedCredentials(email);
      } else {
        clearRememberedCredentials();
      }

      toast.success('登录成功', {
        description: '欢迎回来，正在进入学习空间...',
        duration: 2500,
      });

      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号密码后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="登录账号"
      description="欢迎使用 StudySolo，继续构建你的知识网络"
      footer={
        <>
          还没有专属空间？{' '}
          <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium hover:underline underline-offset-4 transition-all">
            开始你的学习笔记
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
            绑定邮箱
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
            访问密码
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center justify-between mt-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="peer w-4 h-4 border-slate-300 rounded text-blue-600 focus:ring-blue-500/20 cursor-pointer accent-blue-600"
              />
            </div>
            <span className="text-sm text-slate-600 select-none">记住我</span>
          </label>
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 hover:underline underline-offset-4 font-medium transition-colors">
            忘记密码？
          </Link>
        </div>

        {justRegistered ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-2">
            注册成功，请登录你的账号。
          </div>
        ) : null}

        {resetSuccess ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-2">
            密码重置成功，请使用新密码登录。
          </div>
        ) : null}

        {error ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg break-all">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="group relative mt-2 h-11 w-full bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
        >
          {loading ? '正在验证身份...' : '登录空间'}
          {!loading && <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
        </button>
      </form>
    </AuthShell>
  );
}
