'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendVerificationCode, register } from '@/services/auth.service';
import { useVerificationCountdown } from '@/hooks/use-verification-countdown';
import { AuthShell, SliderCaptcha } from '@/features/auth/components';
import { RegisterStepOne, RegisterStepTwo } from './RegisterFormSteps';

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
      title="注册账号"
      description="加入 StudySolo，用自然语言编排你的学习工作流"
      footer={
        <>
          已有账号？{' '}
          <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium hover:underline underline-offset-4 transition-all">
            登录
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
        <RegisterStepOne
          name={name}
          email={email}
          verificationCode={verificationCode}
          codeSent={codeSent}
          sendingCode={sendingCode}
          countdownSeconds={countdown.secondsLeft}
          countdownActive={countdown.isActive}
          error={error}
          onNameChange={setName}
          onEmailChange={setEmail}
          onVerificationCodeChange={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
          onRequestCode={handleRequestCode}
          onProceed={handleProceedToStep2}
        />
      ) : (
        <RegisterStepTwo
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          agreedToTerms={agreedToTerms}
          agreedToPrivacy={agreedToPrivacy}
          loading={loading}
          error={error}
          onBack={() => {
            setStep(1);
            setError('');
          }}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onAgreedToTermsChange={setAgreedToTerms}
          onAgreedToPrivacyChange={setAgreedToPrivacy}
          onSubmit={handleSubmit}
        />
      )}
    </AuthShell>
  );
}
