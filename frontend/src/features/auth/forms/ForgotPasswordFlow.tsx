'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { sendVerificationCode, resetPasswordWithCode } from '@/services/auth.service';
import { useVerificationCountdown } from '@/hooks/use-verification-countdown';
import { AuthShell } from '@/features/auth/components';
import {
  CodeStep,
  EmailStep,
  PasswordStep,
  ResetSuccess,
} from './ForgotPasswordSteps';

type Step = 'email' | 'code' | 'password' | 'success';

export function ForgotPasswordFlow() {
  const countdown = useVerificationCountdown(60);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCaptchaVerified = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  async function sendCode() {
    if (!email) {
      setError('REQ: _enter.email@domain');
      return;
    }
    if (!captchaToken) {
      setError('REQ: CAPTCHA_VERIFICATION_REQUIRED');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await sendVerificationCode(email, captchaToken, 'reset_password');
      countdown.start();
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ERR_TRANSMISSION_FAILED');
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (countdown.isActive || !captchaToken) {
      return;
    }

    setError('');
    setLoading(true);
    try {
      await sendVerificationCode(email, captchaToken, 'reset_password');
      countdown.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ERR_TRANSMISSION_FAILED');
    } finally {
      setLoading(false);
    }
  }

  function handleCodeSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (verificationCode.length !== 6) {
      setError('REQ: 6_DIGIT_PIN_REQUIRED');
      return;
    }

    setError('');
    setStep('password');
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('REQ: MIN_LENGTH_8_CHARS');
      return;
    }
    if (password !== confirmPassword) {
      setError('ERR_PASSWORDS_DO_NOT_MATCH');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithCode(email, verificationCode, password);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ERR_PASSKEY_RESET_FAILED');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="RESET_PASSKEY"
      description="INITIATE PASSKEY OVERRIDE PROTOCOL"
      footer={
        <Link href="/login" className="font-bold text-lime-400 hover:text-white transition-colors underline decoration-lime-400/30 underline-offset-4 tracking-widest uppercase">
          {step === 'success' ? 'EXECUTE_LOGIN' : 'RETURN_TO_LOGIN'}
        </Link>
      }
      showSocial={false}
    >
      {step === 'email' ? (
        <EmailStep
          email={email}
          loading={loading}
          captchaToken={captchaToken}
          error={error}
          onEmailChange={setEmail}
          onCaptchaVerified={handleCaptchaVerified}
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        />
      ) : null}

      {step === 'code' ? (
        <CodeStep
          email={email}
          verificationCode={verificationCode}
          loading={loading}
          error={error}
          countdown={countdown}
          onCodeChange={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
          onSubmit={handleCodeSubmit}
          onBackToEmail={() => {
            setStep('email');
            setError('');
          }}
          onResend={() => {
            void resendCode();
          }}
        />
      ) : null}

      {step === 'password' ? (
        <PasswordStep
          password={password}
          confirmPassword={confirmPassword}
          loading={loading}
          error={error}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handleResetPassword}
        />
      ) : null}

      {step === 'success' ? <ResetSuccess /> : null}
    </AuthShell>
  );
}
