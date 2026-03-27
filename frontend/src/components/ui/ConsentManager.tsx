'use client';

import { useEffect, useState } from 'react';
import { Cookie, Shield } from 'lucide-react';
import { fetchConsentStatus, updateCookieConsent, resignConsent, type CookieConsentLevel } from '@/services/consent.service';

// ─── Cookie Banner ────────────────────────────────────────────────────────────

function CookieBanner({ onDone }: { onDone: () => void }) {
  const [saving, setSaving] = useState(false);

  async function handleConsent(level: CookieConsentLevel) {
    setSaving(true);
    try {
      await updateCookieConsent(level);
      onDone(); // 只在成功或完成时关闭
    } catch {
      // 若失败则允许重试，不关闭
      setSaving(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Cookie 同意"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[calc(100%-2rem)] node-paper-bg rounded-2xl border-[1.5px] border-border/50 shadow-lg p-4"
    >
      <div className="flex items-start gap-3">
        <Cookie className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground tracking-wide">
            🍪 本站使用 Cookie 保障服务运行
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
            必要 Cookie 用于维持登录安全，你也可以选择接受全部 Cookie 以获得完整使用体验。{' '}
            <a
              href="https://docs.1037solo.com/#/docs/studysolo-cookie"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline underline-offset-2 transition-colors"
            >
              了解详情
            </a>
          </p>

          <div className="flex gap-2 mt-3 w-full">
            <button
              onClick={() => handleConsent('essential')}
              disabled={saving}
              className="flex-1 px-3 py-1.5 rounded-lg border-[1.5px] border-border/50 bg-background/50 hover:bg-background text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              仅必要
            </button>
            <button
              onClick={() => handleConsent('all')}
              disabled={saving}
              className="flex-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {saving ? '保存中...' : '全部接受'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ToS Re-sign Modal ────────────────────────────────────────────────────────

function ToSResignModal({ onDone }: { onDone: () => void }) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!agreedToTerms || !agreedToPrivacy) return;
    setSaving(true);
    try {
      await resignConsent({ agreedToTerms: true, agreedToPrivacy: true });
      onDone();
    } catch {
      // 允许重试
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-2xl border-[1.5px] border-border/50 node-paper-bg shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border-[1.5px] border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground tracking-wide">条款已更新</h2>
            <p className="text-xs text-muted-foreground mt-0.5">请重新阅读并确认同意</p>
          </div>
        </div>

        <div className="flex flex-col gap-3.5 p-3.5 rounded-xl bg-background/40 border-[1.5px] border-border/50 mb-5 shadow-inner">
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-[3px] w-[14px] h-[14px] shrink-0 rounded border-border/60 text-primary focus:ring-primary/20 cursor-pointer shadow-sm transition-all group-hover:border-primary/50"
            />
            <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
              我已阅读并同意{' '}
              <a
                href="https://docs.1037solo.com/#/docs/studysolo-terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline underline-offset-2"
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
              className="mt-[3px] w-[14px] h-[14px] shrink-0 rounded border-border/60 text-primary focus:ring-primary/20 cursor-pointer shadow-sm transition-all group-hover:border-primary/50"
            />
            <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
              我已阅读并同意{' '}
              <a
                href="https://docs.1037solo.com/#/docs/studysolo-privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                隐私政策
              </a>
            </span>
          </label>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!agreedToTerms || !agreedToPrivacy || saving}
          className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:translate-y-[-1px] hover:shadow-md disabled:hover:translate-y-0 disabled:hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? '保存中...' : '确认同意，继续使用'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export function ConsentManager() {
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [showToSModal, setShowToSModal] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Only run after client mount — avoids SSR issues
    fetchConsentStatus()
      .then((status) => {
        // ToS re-sign takes priority: block with modal first
        if (status.needs_tos || status.needs_privacy) {
          setShowToSModal(true);
        } else if (status.needs_cookie_consent) {
          setShowCookieBanner(true);
        }
        setChecked(true);
      })
      .catch(() => {
        // Not logged in or request failed — silently skip
        setChecked(true);
      });
  }, []);

  function handleToSDone() {
    setShowToSModal(false);
    // After ToS, check if cookie consent is also needed
    fetchConsentStatus()
      .then((s) => { if (s.needs_cookie_consent) setShowCookieBanner(true); })
      .catch(() => {});
  }

  if (!checked) return null;

  return (
    <>
      {showToSModal && <ToSResignModal onDone={handleToSDone} />}
      {showCookieBanner && !showToSModal && (
        <CookieBanner onDone={() => setShowCookieBanner(false)} />
      )}
    </>
  );
}
