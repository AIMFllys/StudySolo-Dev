'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PanelLeft, PanelRight, Cookie } from 'lucide-react';
import { FeedbackChannel } from '@/features/settings/components';
import {
  useSettingsStore,
  type AccentColor,
  type FontSize,
  type ThemeMode,
  type SidebarPosition,
} from '@/stores/ui/use-settings-store';
import {
  ACCENT_OPTIONS,
  FONT_OPTIONS,
  THEME_OPTIONS,
} from '@/features/settings/options';
import {
  fetchConsentStatus,
  updateCookieConsent,
  type CookieConsentLevel,
} from '@/services/consent.service';
import { Section, Toggle } from './SettingsPanelPrimitives';
import { CookieEssentialConfirmDialog } from './CookieEssentialConfirmDialog';

function handleChange(name: string, action: () => void) {
  action();
  toast.success('设置已保存', { description: `${name} 偏好已更新`, duration: 2000 });
}

export default function SettingsPanel() {
  const {
    theme, setTheme,
    accentColor, setAccentColor,
    fontSize, setFontSize,
    glassEffect, setGlassEffect,
    autoSave, setAutoSave,
    showMinimap, setShowMinimap,
    sidebarPosition, setSidebarPosition,
  } = useSettingsStore();

  const [cookieLevel, setCookieLevel] = useState<CookieConsentLevel | null>(null);
  const [cookieSaving, setCookieSaving] = useState(false);
  const [showEssentialConfirm, setShowEssentialConfirm] = useState(false);

  useEffect(() => {
    fetchConsentStatus()
      .then((s) => setCookieLevel(s.cookie_consent_level))
      .catch(() => {});
  }, []);

  function handleCookieRequest(level: CookieConsentLevel) {
    if (level === 'essential') { setShowEssentialConfirm(true); }
    else { void handleCookieChange(level); }
  }

  async function confirmEssentialOnly() {
    await handleCookieChange('essential');
    setShowEssentialConfirm(false);
  }

  async function handleCookieChange(level: CookieConsentLevel) {
    setCookieSaving(true);
    try {
      await updateCookieConsent(level);
      setCookieLevel(level);
      toast.success('Cookie 偏好已更新');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setCookieSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="scrollbar-hide flex-1 overflow-y-auto px-3 py-3">
          <Section title="外观模式">
            <div className="flex gap-1.5">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleChange('外观模式', () => setTheme(opt.value as ThemeMode))}
                  className={`node-paper-bg flex flex-1 flex-col items-center gap-1.5 rounded-lg border-[1.5px] px-1.5 py-2 text-[10px] font-medium transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                    theme === opt.value
                      ? 'border-primary/40 text-primary scale-[1.02] ring-2 ring-primary/10'
                      : 'border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  <opt.icon className={`h-4 w-4 stroke-[1.5] ${theme === opt.value ? 'text-primary' : ''}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="主题色">
            <div className="flex flex-wrap gap-2">
              {ACCENT_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => handleChange('主题色', () => setAccentColor(opt.value as AccentColor))} className="group flex flex-col items-center gap-1">
                  <div
                    className={`node-paper-bg h-7 w-7 rounded-full border-[1.5px] transition-all shadow-sm ${
                      accentColor === opt.value ? 'scale-110 border-primary/50 ring-2 ring-primary/20 ring-offset-1 ring-offset-background' : 'border-border/50 hover:scale-105 hover:shadow-md'
                    }`}
                    style={{ backgroundColor: opt.color }}
                  />
                  <span className={`text-[9px] font-medium tracking-wide mt-1.5 ${accentColor === opt.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="字体大小">
            <div className="node-paper-bg flex gap-1.5 rounded-lg border-[1.5px] border-border/50 p-1 shadow-sm">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleChange('字体大小', () => setFontSize(opt.value as FontSize))}
                  className={`flex-1 rounded-md py-1.5 text-[10px] transition-all ${
                    fontSize === opt.value
                      ? 'font-bold bg-primary/10 text-primary border-[1.5px] border-primary/30 shadow-sm'
                      : 'font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground border-[1.5px] border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="功能">
            <div className="space-y-2">
              <Toggle checked={glassEffect} onChange={(v) => handleChange('毛玻璃', () => setGlassEffect(v))} label="毛玻璃效果" />
              <Toggle checked={autoSave} onChange={(v) => handleChange('自动保存', () => setAutoSave(v))} label="自动保存" />
              <Toggle checked={showMinimap} onChange={(v) => handleChange('小地图', () => setShowMinimap(v))} label="显示小地图" />
            </div>
          </Section>

          <Section title="菜单栏位置">
            <div className="flex gap-1.5">
              {([
                { value: 'left', label: '左侧', icon: PanelLeft },
                { value: 'right', label: '右侧', icon: PanelRight },
              ] as { value: SidebarPosition; label: string; icon: React.ElementType }[]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleChange('菜单栏位置', () => setSidebarPosition(opt.value))}
                  className={`node-paper-bg flex flex-1 flex-col items-center gap-1.5 rounded-lg border-[1.5px] px-1.5 py-2 text-[10px] font-medium transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                    sidebarPosition === opt.value
                      ? 'border-primary/40 text-primary scale-[1.02] ring-2 ring-primary/10'
                      : 'border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  <opt.icon className={`h-4 w-4 stroke-[1.5] ${sidebarPosition === opt.value ? 'text-primary' : ''}`} />
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] text-muted-foreground/50">切换后立即生效，无需刷新</p>
          </Section>

          <Section title="隐私偏好">
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5">
                {(['essential', 'all'] as CookieConsentLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleCookieRequest(level)}
                    disabled={cookieSaving || cookieLevel === level}
                    className={`node-paper-bg flex flex-1 flex-col items-start gap-1 rounded-lg border-[1.5px] px-2 py-2 text-left transition-all shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:hover:shadow-sm ${
                      cookieLevel === level ? 'border-primary/40' : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <span className={`text-[10px] font-medium ${cookieLevel === level ? 'text-primary' : 'text-foreground'}`}>
                      {level === 'essential' ? '仅必要' : '全部接受'}
                    </span>
                    <span className="text-[9px] text-muted-foreground leading-[1.2]">
                      {level === 'essential' ? '维持登录安全' : '改善体验'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-1 px-1">
                <Cookie className="w-3 h-3 text-muted-foreground/70" />
                <a href="https://docs.1037solo.com/#/docs/studysolo-cookie" target="_blank" rel="noopener noreferrer" className="text-[9px] text-muted-foreground hover:text-primary transition-colors hover:underline">
                  查看 Cookie 政策
                </a>
              </div>
            </div>
          </Section>

          <div className="mt-6"><FeedbackChannel /></div>
          <p className="mt-4 text-center text-[9px] text-muted-foreground/50">设置自动保存至浏览器本地存储</p>
        </div>
      </div>

      {showEssentialConfirm && (
        <CookieEssentialConfirmDialog
          saving={cookieSaving}
          onCancel={() => setShowEssentialConfirm(false)}
          onConfirm={confirmEssentialOnly}
        />
      )}
    </>
  );
}
