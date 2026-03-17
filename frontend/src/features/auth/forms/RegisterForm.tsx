'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendVerificationCode, register } from '@/services/auth.service';
import { useVerificationCountdown } from '@/hooks/use-verification-countdown';
import { AuthShell, SliderCaptcha } from '@/features/auth/components';
import { ArrowRight } from 'lucide-react';

export function RegisterForm() {
  const router = useRouter();
  const countdown = useVerificationCountdown(60);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCaptchaVerified = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  async function handleSendCode() {
    if (!email) {
      setError('REQ: _enter.email@domain');
      return;
    }

    if (!captchaToken) {
      setError('REQ: CAPTCHA_VERIFICATION_REQUIRED');
      return;
    }

    setError('');
    setSendingCode(true);
    try {
      await sendVerificationCode(email, captchaToken);
      setCodeSent(true);
      countdown.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ERR_TRANSMISSION_FAILED');
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('ERR_PASSWORDS_DO_NOT_MATCH');
      return;
    }

    if (!verificationCode) {
      setError('REQ: VERIFICATION_CODE');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, verificationCode, name);
      router.push('/login?registered=true&confirmed=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ERR_REGISTRATION_FAILED');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="INITIATE_REGISTRATION"
      description="INITIALIZE AI WORKFLOW ACCESS"
      footer={
        <>
          ACCOUNT_EXISTS?{' '}
          <Link href="/login" className="text-lime-400 hover:text-white transition-colors underline decoration-lime-400/30 underline-offset-4">
            EXECUTE_LOGIN
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 font-mono">
        <div className="flex flex-col gap-2">
          <label htmlFor="register-name" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
            <span>[AGENT_NAME]</span>
            <span className="text-lime-400/50">REQ</span>
          </label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="USER_ALIAS"
            className="h-12 bg-black border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="register-email" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
            <span>[EMAIL_ADDRESS]</span>
            <span className="text-lime-400/50">REQ</span>
          </label>
          <input
            id="register-email"
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
          <label className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
            <span>[HUMAN_VERIFICATION]</span>
            <span className="text-lime-400/50">REQ</span>
          </label>
          {/* We assume SliderCaptcha itself handles its UI or can be wrapped if need be */}
          <div className="border border-white/10 bg-black p-2 filter grayscale-[0.8] contrast-125 focus-within:filter-none transition-all">
            <SliderCaptcha onVerified={handleCaptchaVerified} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="register-code" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
            <span>[PIN_CODE]</span>
            <span className="text-lime-400/50">REQ</span>
          </label>
          <div className="flex gap-2">
            <input
              id="register-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="----"
              className="flex-1 h-12 bg-black border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none tracking-widest text-center"
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sendingCode || countdown.isActive || !captchaToken}
              className="shrink-0 px-4 h-12 bg-[#111111] border border-white/10 text-xs font-mono text-white/80 hover:border-white/30 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors uppercase tracking-wider whitespace-nowrap"
            >
              {sendingCode ? 'TRANSMITTING...' : countdown.isActive ? `TL:${countdown.secondsLeft}s` : codeSent ? 'RESEND_SIGNAL' : 'DISPATCH_PIN'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="register-password" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
            <span>[PASSWORD]</span>
            <span className="text-lime-400/50">REQ</span>
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            className="h-12 bg-black border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="register-confirm-password" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
            <span>[CONFIRM_PASSWORD]</span>
            <span className="text-lime-400/50">REQ</span>
          </label>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="********"
            className="h-12 bg-black border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none"
          />
        </div>

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
            {loading ? 'PROCESSING...' : 'EXECUTE_REGISTRATION'}
            {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
          </div>
        </button>
      </form>
    </AuthShell>
  );
}
