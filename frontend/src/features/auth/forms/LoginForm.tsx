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
import { ArrowRight } from 'lucide-react';

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
    setPassword(savedCredentials.password);
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
        saveRememberedCredentials(email, password);
      } else {
        clearRememberedCredentials();
      }

      toast.success('SYS.LOGIN_SUCCESS', {
        description: 'INITIATING WORKSPACE...',
        duration: 2500,
      });

      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ERR.AUTH_FAILED');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="SYSTEM_LOGIN"
      description="AUTHENTICATE TO ACCESS WORKFLOW ENGINE"
      footer={
        <>
          NO_ACCOUNT_FOUND?{' '}
          <Link href="/register" className="text-lime-400 hover:text-white transition-colors underline decoration-lime-400/30 underline-offset-4">
            INITIATE_REGISTRATION
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 font-mono">
        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
            <span>[EMAIL_ADDRESS]</span>
            <span className="text-lime-400/50">REQ</span>
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="_enter.email@domain"
            className="h-12 bg-black border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
            <span>[PASSWORD]</span>
            <span className="text-lime-400/50">REQ</span>
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            className="h-12 bg-black border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none"
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center w-4 h-4 border border-white/20 bg-black group-hover:border-lime-400 transition-colors">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="opacity-0 absolute w-full h-full cursor-pointer"
              />
              {remember && <div className="w-2 h-2 bg-lime-400" />}
            </div>
            <span className="text-white/40 uppercase tracking-wider group-hover:text-white/60 transition-colors">REMEMBER_ME</span>
          </label>
          <Link href="/forgot-password" className="text-white/40 hover:text-lime-400 transition-colors uppercase tracking-wider">
            RESET_PASSKEY?
          </Link>
        </div>

        {justRegistered ? (
          <p className="text-xs font-mono text-lime-400 bg-lime-400/10 p-3 border-l-2 border-lime-400 leading-relaxed uppercase">
            REGISTRATION_COMPLETE.<br/>PLEASE_LOGIN.
          </p>
        ) : null}

        {resetSuccess ? (
          <p className="text-xs font-mono text-lime-400 bg-lime-400/10 p-3 border-l-2 border-lime-400 leading-relaxed uppercase">
            PASSKEY_UPDATED.<br/>PLEASE_LOGIN.
          </p>
        ) : null}

        {error ? (
          <p className="text-xs font-mono text-red-400 bg-red-400/10 p-3 border-l-2 border-red-400 leading-relaxed break-all">
            [ERR]: {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="group relative mt-2 h-12 bg-lime-400 text-black text-sm font-bold uppercase tracking-widest hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            {loading ? 'AUTHENTICATING...' : 'EXECUTE_LOGIN'}
            {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
          </div>
        </button>
      </form>
    </AuthShell>
  );
}
