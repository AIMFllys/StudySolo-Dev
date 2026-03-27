'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendVerificationCode, register } from '@/services/auth.service';
import { useVerificationCountdown } from '@/hooks/use-verification-countdown';
import { AuthShell, SliderCaptcha } from '@/features/auth/components';
import { UserPlus, ArrowLeft, CheckCircle2, Shield } from 'lucide-react';

/**
 * Registration flow:
 *   Step 1  → Name + Email + Code (captcha pops up as modal on "获取验证码")
 *   Step 2  → Password + Confirm (appears after code is entered and verified)
 */
export function RegisterForm() {
  const router = useRouter();
  const countdown = useVerificationCountdown(60);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');

  // Flow state
  const [step, setStep] = useState<1 | 2>(1);
  const [codeSent, setCodeSent] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const handleCaptchaVerified = useCallback(async (token: string) => {
    setCaptchaToken(token);
    setShowCaptcha(false);

    // Immediately send verification code after captcha is verified
    setError('');
    setSendingCode(true);
    try {
      await sendVerificationCode(email, token);
      setCodeSent(true);
      countdown.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请检查网络或稍后再试');
    } finally {
      setSendingCode(false);
    }
  }, [email, countdown]);

  function handleRequestCode() {
    if (!name.trim()) {
      setError('请输入你的称呼');
      return;
    }
    if (!email) {
      setError('请输入你要绑定的邮箱地址');
      return;
    }

    // If already have a captcha token (resend case), send directly
    if (captchaToken) {
      void (async () => {
        setError('');
        setSendingCode(true);
        try {
          await sendVerificationCode(email, captchaToken);
          setCodeSent(true);
          countdown.start();
        } catch (err) {
          setError(err instanceof Error ? err.message : '验证码发送失败，请检查网络或稍后再试');
        } finally {
          setSendingCode(false);
        }
      })();
      return;
    }

    // Show captcha modal
    setError('');
    setShowCaptcha(true);
  }

  function handleProceedToStep2() {
    if (!verificationCode || verificationCode.length < 6) {
      setError('请输入完整的6位验证码');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!agreedToTerms || !agreedToPrivacy) {
      setError('请阅读并勾选同意服务条款和隐私政策');
      return;
    }

    if (password.length < 8) {
      setError('密码至少需要8个字符');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次设置的密码不一致，请核对');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, verificationCode, name, {
        agreedToTerms,
        agreedToPrivacy,
      });
      router.push('/login?registered=true&confirmed=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册遇到了问题，请检查填写内容');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="创建新笔记本"
      description="开启你在 StudySolo 的专属结构化知识网络"
      footer={
        <>
          已经有专属笔记本了？{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium hover:underline underline-offset-4 transition-all">
            直接翻开
          </Link>
        </>
      }
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
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-name" className="text-sm font-medium text-slate-700">
              你希望如何被称呼 <span className="text-red-500">*</span>
            </label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的名字或昵称"
              className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-email" className="text-sm font-medium text-slate-700">
              邮箱地址 <span className="text-red-500">*</span>
            </label>
            <input
              id="register-email"
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
            <label htmlFor="register-code" className="text-sm font-medium text-slate-700">
              邮箱数字验证码 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="register-code"
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
            下一步：创建密码
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              <span className="text-sm font-medium text-slate-700">设置密码</span>
              <span className="text-xs text-slate-400">{email}</span>
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-password" className="text-sm font-medium text-slate-700">
              创建密码 <span className="text-red-500">*</span>
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="最少 8 个字符"
              className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-confirm-password" className="text-sm font-medium text-slate-700">
              再次确认 <span className="text-red-500">*</span>
            </label>
            <input
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入上方的密码"
              className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          {error ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg break-all">
              {error}
            </div>
          ) : null}

          {/* ToS + Privacy agreement — required before submit */}
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 rounded accent-blue-600 cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                我已阅读并同意{' '}
                <a
                  href="https://docs.1037solo.com/#/docs/studysolo-terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline underline-offset-2 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  服务条款
                </a>
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 rounded accent-blue-600 cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                我已阅读并同意{' '}
                <a
                  href="https://docs.1037solo.com/#/docs/studysolo-privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline underline-offset-2 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  隐私政策
                </a>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !agreedToTerms || !agreedToPrivacy}
            className="group relative mt-2 h-11 w-full bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? '网络连接处理中...' : '注册并开启笔记'}
            {!loading && <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
