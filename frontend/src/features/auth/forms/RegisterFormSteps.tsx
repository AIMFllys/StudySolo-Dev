import { ArrowLeft, CheckCircle2, Shield, UserPlus } from 'lucide-react';

type RegisterStepOneProps = {
  name: string;
  email: string;
  verificationCode: string;
  codeSent: boolean;
  sendingCode: boolean;
  countdownSeconds: number;
  countdownActive: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onVerificationCodeChange: (value: string) => void;
  onRequestCode: () => void;
  onProceed: () => void;
};

export function RegisterStepOne(props: RegisterStepOneProps) {
  const {
    name,
    email,
    verificationCode,
    codeSent,
    sendingCode,
    countdownSeconds,
    countdownActive,
    error,
    onNameChange,
    onEmailChange,
    onVerificationCodeChange,
    onRequestCode,
    onProceed,
  } = props;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          你希望如何被称呼 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="register-name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="你的名字或昵称"
          className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          邮箱地址 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="name@example.com"
          className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-code" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          邮箱数字验证码 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <div className="flex gap-2">
          <input
            id="register-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={verificationCode}
            onChange={(e) => onVerificationCodeChange(e.target.value)}
            placeholder="6 位数字"
            className="flex-1 h-11 px-4 text-center bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm tracking-[0.2em]"
          />
          <button
            type="button"
            onClick={onRequestCode}
            disabled={sendingCode || countdownActive}
            className="shrink-0 px-4 h-11 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 dark:bg-white/10 hover:border-slate-400 dark:hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm whitespace-nowrap min-w-[100px] flex items-center justify-center gap-1.5"
          >
            {sendingCode ? (
              '发送中...'
            ) : countdownActive ? (
              `${countdownSeconds}s`
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
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-lg break-all">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onProceed}
        disabled={!verificationCode || verificationCode.length < 6 || !codeSent}
        className="group relative mt-2 h-11 w-full bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
      >
        下一步：创建密码
      </button>
    </div>
  );
}

type RegisterStepTwoProps = {
  email: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
  loading: boolean;
  error: string;
  onBack: () => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onAgreedToTermsChange: (value: boolean) => void;
  onAgreedToPrivacyChange: (value: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
};

export function RegisterStepTwo(props: RegisterStepTwoProps) {
  const {
    email,
    password,
    confirmPassword,
    agreedToTerms,
    agreedToPrivacy,
    loading,
    error,
    onBack,
    onPasswordChange,
    onConfirmPasswordChange,
    onAgreedToTermsChange,
    onAgreedToPrivacyChange,
    onSubmit,
  } = props;

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
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">设置密码</span>
          <span className="text-xs text-slate-400">{email}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          创建密码 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="最少 8 个字符"
          className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-confirm-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          再次确认 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          placeholder="请再次输入上方的密码"
          className="w-full h-11 px-4 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-lg break-all">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10">
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => onAgreedToTermsChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 rounded accent-blue-600 cursor-pointer"
          />
          <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            我已阅读并同意{' '}
            <a
              href="https://docs.1037solo.com/#/docs/studysolo-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2 font-medium"
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
            onChange={(e) => onAgreedToPrivacyChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 rounded accent-blue-600 cursor-pointer"
          />
          <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            我已阅读并同意{' '}
            <a
              href="https://docs.1037solo.com/#/docs/studysolo-privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2 font-medium"
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
        className="group relative mt-2 h-11 w-full bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
      >
        {loading ? '正在注册...' : '注册'}
        {!loading && <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />}
      </button>
    </form>
  );
}
