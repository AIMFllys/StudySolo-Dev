'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { sendVerificationCode, resetPasswordWithCode } from '@/services/auth.service';
import { useVerificationCountdown } from '@/hooks/use-verification-countdown';
import { AuthShell, SliderCaptcha } from '@/features/auth/components';
import {
  ForgotPasswordStepEmail,
  ForgotPasswordStepNewPassword,
  ForgotPasswordStepSuccess,
} from './ForgotPasswordSteps';

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
    if (!email) { setError('请输入你要找回的邮箱地址'); return; }
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
    if (password.length < 8) { setError('密码不能少于 8 个字符'); return; }
    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return; }
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
        <Link href="/login" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline underline-offset-4 transition-colors">
          {step === 3 ? '返回继续登录' : '想起密码了？返回登录'}
        </Link>
      }
      showSocial={false}
    >
      {showCaptcha && (
        <SliderCaptcha modal onVerified={handleCaptchaVerified} onClose={() => setShowCaptcha(false)} />
      )}

      {step === 1 ? (
        <ForgotPasswordStepEmail
          email={email} setEmail={setEmail}
          verificationCode={verificationCode} setVerificationCode={setVerificationCode}
          sendingCode={sendingCode} countdown={countdown}
          codeSent={codeSent} error={error}
          onRequestCode={handleRequestCode}
          onProceed={handleProceedToStep2}
        />
      ) : null}

      {step === 2 ? (
        <ForgotPasswordStepNewPassword
          email={email}
          password={password} setPassword={setPassword}
          confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
          loading={loading} error={error}
          onBack={() => { setStep(1); setError(''); }}
          onSubmit={handleResetPassword}
        />
      ) : null}

      {step === 3 ? <ForgotPasswordStepSuccess /> : null}
    </AuthShell>
  );
}
