import Link from 'next/link';
import { SliderCaptcha } from '@/features/auth/components';
import { ArrowRight, CheckSquare } from 'lucide-react';

interface CountdownState {
  secondsLeft: number;
  isActive: boolean;
}

interface StepErrorProps {
  error: string;
}

export function StepError({ error }: StepErrorProps) {
  if (!error) {
    return null;
  }

  return (
    <p className="border-l-2 border-red-400 bg-red-400/10 px-3 py-2 text-xs font-mono text-red-400 leading-relaxed uppercase break-all">
      [ERR]: {error}
    </p>
  );
}

interface EmailStepProps {
  email: string;
  loading: boolean;
  captchaToken: string;
  error: string;
  onEmailChange: (value: string) => void;
  onCaptchaVerified: (token: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function EmailStep({
  email,
  loading,
  captchaToken,
  error,
  onEmailChange,
  onCaptchaVerified,
  onSubmit,
}: EmailStepProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 font-mono">
      <div className="flex flex-col gap-2">
        <label htmlFor="forgot-email" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
          <span>[EMAIL_ADDRESS]</span>
          <span className="text-lime-400/50">REQ</span>
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="_enter.email@domain"
          className="h-12 bg-black border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
          <span>[HUMAN_VERIFICATION]</span>
          <span className="text-lime-400/50">REQ</span>
        </label>
        <div className="border border-white/10 bg-black p-2 filter grayscale-[0.8] contrast-125 focus-within:filter-none transition-all">
          <SliderCaptcha onVerified={onCaptchaVerified} />
        </div>
      </div>

      <StepError error={error} />

      <button
        type="submit"
        disabled={loading || !captchaToken}
        className="group relative mt-2 h-12 bg-lime-400 text-black text-sm font-bold uppercase tracking-widest hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          {loading ? 'TRANSMITTING...' : 'DISPATCH_PIN'}
          {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
        </div>
      </button>
    </form>
  );
}

interface CodeStepProps {
  email: string;
  verificationCode: string;
  loading: boolean;
  error: string;
  countdown: CountdownState;
  onCodeChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onBackToEmail: () => void;
  onResend: () => void;
}

export function CodeStep({
  email,
  verificationCode,
  loading,
  error,
  countdown,
  onCodeChange,
  onSubmit,
  onBackToEmail,
  onResend,
}: CodeStepProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 font-mono">
      <div className="border-l-2 border-lime-400 bg-lime-400/10 px-4 py-3 text-[10px] uppercase text-white/60 leading-relaxed">
        SIGNAL_DISPATCHED_TO<br/><span className="font-bold text-lime-400 text-xs break-all">{email}</span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="forgot-code" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
          <span>[PIN_CODE]</span>
          <span className="text-lime-400/50">REQ</span>
        </label>
        <input
          id="forgot-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          autoFocus
          value={verificationCode}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="----"
          className="h-14 bg-black border border-white/10 px-4 text-center font-mono text-xl tracking-[12px] text-white placeholder:text-sm placeholder:tracking-normal placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none"
        />
      </div>

      <StepError error={error} />

      <button
        type="submit"
        disabled={verificationCode.length !== 6}
        className="group relative h-12 bg-lime-400 text-black text-sm font-bold uppercase tracking-widest hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
      >
         <div className="absolute inset-0 flex items-center justify-center gap-2">
          PROCEED_TO_NEXT_STAGE
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40 mt-2">
        <button type="button" onClick={onBackToEmail} className="hover:text-lime-400 transition-colors">
          [MODIFY_TARGET_EMAIL]
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={countdown.isActive || loading}
          className="hover:text-lime-400 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
        >
          {countdown.isActive ? `[TL:${countdown.secondsLeft}s]` : '[RESEND_SIGNAL]'}
        </button>
      </div>
    </form>
  );
}

interface PasswordStepProps {
  password: string;
  confirmPassword: string;
  loading: boolean;
  error: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function PasswordStep({
  password,
  confirmPassword,
  loading,
  error,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: PasswordStepProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 font-mono">
      <div className="flex flex-col gap-2">
        <label htmlFor="forgot-password" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
          <span>[NEW_PASSKEY]</span>
          <span className="text-lime-400/50">REQ</span>
        </label>
        <input
          id="forgot-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="********"
          className="h-12 bg-black border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="forgot-confirm-password" className="text-[10px] text-white/60 uppercase tracking-widest flex items-center justify-between">
          <span>[CONFIRM_PASSKEY]</span>
          <span className="text-lime-400/50">REQ</span>
        </label>
        <input
          id="forgot-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          placeholder="********"
          className="h-12 bg-black border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-lime-400 transition-colors rounded-none"
        />
      </div>

      <StepError error={error} />

      <button
        type="submit"
        disabled={loading}
        className="group relative mt-2 h-12 bg-lime-400 text-black text-sm font-bold uppercase tracking-widest hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          {loading ? 'EXECUTING_OVERRIDE...' : 'OVERRIDE_PASSKEY'}
          {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> }
        </div>
      </button>
    </form>
  );
}

export function ResetSuccess() {
  return (
    <div className="border border-lime-400/30 bg-lime-400/5 p-6 text-center font-mono relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-lime-400"></div>
      
      <div className="mb-6 flex justify-center mt-2">
        <div className="flex h-16 w-16 items-center justify-center bg-black border border-lime-400/50 text-lime-400">
          <CheckSquare className="h-8 w-8" strokeWidth={1.5} />
        </div>
      </div>
      
      <p className="text-lg font-black text-lime-400 uppercase tracking-widest mb-2">PASSKEY_OVERRIDE_SUCCESS</p>
      <p className="text-xs text-white/50 uppercase tracking-wide leading-relaxed">
        NEW_CREDENTIALS_ACCEPTED.<br/>SYSTEM_READY_FOR_AUTHENTICATION.
      </p>
      
      <div className="mt-8">
        <Link href="/login" className="inline-flex h-12 items-center justify-center px-6 bg-lime-400 text-black text-xs font-bold uppercase tracking-widest hover:bg-lime-300 transition-colors">
          EXECUTE_LOGIN_SEQUENCE
        </Link>
      </div>
    </div>
  );
}



