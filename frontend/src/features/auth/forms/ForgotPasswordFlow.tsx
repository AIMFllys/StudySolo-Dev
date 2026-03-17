'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { sendVerificationCode, resetPasswordWithCode } from '@/services/auth.service';
import { useVerificationCountdown } from '@/hooks/use-verification-countdown';
import { AuthShell, SliderCaptcha } from '@/features/auth/components';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Shield } from 'lucide-react';

/**
 * Forgot Password flow:
 *   Step 1  → Email + Code (captcha appears as modal on "获取验证码")
 *   Step 2  → New password + confirm (appears after code is entered)
 *   Step 3  → Success
 */
export function ForgotPasswordFlow() {
  const countdown = useVerificationCountdown(60);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCaptcha, setShowCaptcha] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCaptchaVerified = useCallback(async (token: string) => {
    setCaptchaToken(token);
    setShowCaptcha(false);

    // Automatically send code after captcha verification
    setError('');
    setSendingCode(true);
    try {
      await sendVerificationCode(email, token, 'reset_password');
      setCodeSent(true);
      countdown.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送邮件失败，该邮箱可能未注册或网络异常');
    } finally {
      setSendingCode(false);
    }
  }, [email, countdown]);

  function handleRequestCode() {
    if (!email) {
      setError('请输入你要找回的邮箱地址');
      return;
    }

    // If already have a captcha token (resend case), send directly
    if (captchaToken) {
      void (async () => {
        setError('');
        setSendingCode(true);
        try {
          await sendVerificationCode(email, captchaToken, 'reset_password');
          setCodeSent(true);
          countdown.start();
        } catch (err) {
          setError(err instanceof Error ? err.message : '发送邮件失败，请稍后重试');
        } finally {
          setSendingCode(false);
        }
      })();
      return;
    }

    setError('');
    setShowCaptcha(true);
  }

  function handleProceedToStep2() {
    if (!verificationCode || verificationCode.length < 6) {
      setError('请输入完整的 6 位数字验证码');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('密码不能少于 8 个字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithCode(email, verificationCode, password);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : '密码重置失败，验证码可能已过期或不正确');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="找回密码"
      description="跟随步骤找回你在 StudySolo 的账号"
      footer={
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 hover:underline underline-offset-4 transition-colors">
          {step === 3 ? '返回继续登录' : '想起密码了？返回登录'}
        </Link>
      }
      showSocial={false}
    >
      {/* ─── Captcha Modal ─── */}
      {showCaptcha && (
        <SliderCaptcha
          modal
          onVerified={handleCaptchaVerified}
          onClose={() => setShowCaptcha(false)}
        />
      )}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="forgot-email" className="text-sm font-medium text-slate-700">
              你要找回账号的邮箱 <span className="text-red-500">*</span>
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          {/* Verification Code */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="forgot-code" className="text-sm font-medium text-slate-700">
              邮箱数字验证码 <span className="text-red-500">*</span>
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
                className="flex-1 h-11 px-4 text-center bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm tracking-[0.2em]"
              />
              <button
                type="button"
                onClick={handleRequestCode}
                disabled={sendingCode || countdown.isActive}
                className="shrink-0 px-4 h-11 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm whitespace-nowrap min-w-[100px] flex items-center justify-center gap-1.5"
              >
                {sendingCode ? (
                  '发送中...'
                ) : countdown.isActive ? (
                  `${countdown.secondsLeft}s`
                ) : codeSent ? (
                  '重新发送'
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    获取验证码
                  </>
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
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg break-all">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleProceedToStep2}
            disabled={!verificationCode || verificationCode.length < 6 || !codeSent}
            className="group relative mt-2 h-11 w-full bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
          >
            下一步：设置新密码
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
          {/* Step indicator */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-700">设置新密码</span>
              <span className="text-xs text-slate-400">{email}</span>
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="forgot-password" className="text-sm font-medium text-slate-700">
              输入新密码 <span className="text-red-500">*</span>
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
              className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="forgot-confirm-password" className="text-sm font-medium text-slate-700">
              确认新密码 <span className="text-red-500">*</span>
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
              className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

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
            {loading ? '保存密码中...' : '提交新密码'}
            {!loading && <KeyRound className="w-4 h-4 group-hover:scale-110 transition-transform" />}
          </button>
        </form>
      ) : null}

      {step === 3 ? (
        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-8 text-center flex flex-col items-center shadow-sm">
          <div className="mb-6 flex justify-center text-emerald-500 bg-white rounded-full p-4 shadow-sm border border-emerald-100">
            <CheckCircle2 className="h-10 w-10" strokeWidth={2} />
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">密码修改成功</h3>
          <p className="text-sm text-slate-600 mb-8 max-w-[240px] leading-relaxed">
            新密码已经生效，您可以返回登录页面使用新密码访问 StudySolo 了。
          </p>

          <Link href="/login" className="inline-flex h-11 w-full items-center justify-center bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
            去登录
          </Link>
        </div>
      ) : null}
    </AuthShell>
  );
}
