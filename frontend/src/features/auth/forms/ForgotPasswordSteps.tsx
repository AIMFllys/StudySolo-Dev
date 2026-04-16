import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Shield } from 'lucide-react';

interface StepOneProps {
  email: string;
  setEmail: (v: string) => void;
  verificationCode: string;
  setVerificationCode: (v: string) => void;
  sendingCode: boolean;
  countdown: { isActive: boolean; secondsLeft: number };
  codeSent: boolean;
  error: string;
  onRequestCode: () => void;
  onProceed: () => void;
}

export function ForgotPasswordStepEmail({
  email, setEmail, verificationCode, setVerificationCode,
  sendingCode, countdown, codeSent, error,
  onRequestCode, onProceed,
}: StepOneProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          你要找回账号的邮箱 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-code" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          邮箱数字验证码 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <div className="flex gap-2">
          <input
            id="forgot-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 位数字"
            className="flex-1 h-11 px-4 text-center bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm tracking-[0.2em]"
          />
          <button
            type="button"
            onClick={onRequestCode}
            disabled={sendingCode || countdown.isActive}
            className="shrink-0 px-4 h-11 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-400 dark:hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm whitespace-nowrap min-w-[100px] flex items-center justify-center gap-1.5"
          >
            {sendingCode ? '发送中...' : countdown.isActive ? `${countdown.secondsLeft}s` : codeSent ? '重新发送' : (
              <><Shield className="w-3.5 h-3.5" />获取验证码</>
            )}
          </button>
        </div>
        {codeSent && (
          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
            <CheckCircle2 className="w-3 h-3" />
            验证码已发送至你的邮箱
          </p>
        )}
      </div>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-lg break-all">{error}</div>
      ) : null}

      <button
        type="button"
        onClick={onProceed}
        disabled={!verificationCode || verificationCode.length < 6 || !codeSent}
        className="group relative mt-2 h-11 w-full bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
      >
        下一步：设置新密码
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}

interface StepTwoProps {
  email: string;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  loading: boolean;
  error: string;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ForgotPasswordStepNewPassword({
  email, password, setPassword, confirmPassword, setConfirmPassword,
  loading, error, onBack, onSubmit,
}: StepTwoProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="text-slate-400 hover:text-slate-700 dark:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">设置新密码</span>
          <span className="text-xs text-slate-400">{email}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          输入新密码 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="forgot-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 8 个字符"
          className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-confirm-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          确认新密码 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="forgot-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="再输入一次"
          className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-lg break-all">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="group relative mt-2 h-11 w-full bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
      >
        {loading ? '保存密码中...' : '提交新密码'}
        {!loading && <KeyRound className="w-4 h-4 group-hover:scale-110 transition-transform" />}
      </button>
    </form>
  );
}

export function ForgotPasswordStepSuccess() {
  return (
    <div className="border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-8 text-center flex flex-col items-center shadow-sm">
      <div className="mb-6 flex justify-center text-emerald-500 bg-white dark:bg-white/5 rounded-full p-4 shadow-sm border border-emerald-100">
        <CheckCircle2 className="h-10 w-10" strokeWidth={2} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-tight">密码修改成功</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 max-w-[240px] leading-relaxed">
        新密码已经生效，您可以返回登录页面使用新密码访问 StudySolo 了。
      </p>
      <Link href="/login" className="inline-flex h-11 w-full items-center justify-center bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
        去登录
      </Link>
    </div>
  );
}
