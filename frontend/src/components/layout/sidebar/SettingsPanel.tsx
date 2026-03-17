'use client';

import { toast } from 'sonner';
import { PanelLeft, PanelRight } from 'lucide-react';
import {
  useSettingsStore,
  type AccentColor,
  type FontSize,
  type ThemeMode,
  type SidebarPosition,
} from '@/stores/use-settings-store';
import {
  ACCENT_OPTIONS,
  FONT_OPTIONS,
  THEME_OPTIONS,
} from '@/features/settings/options';

function handleChange(name: string, action: () => void) {
  action();
  toast.success('设置已保存', { description: `${name} 偏好已更新`, duration: 2000 });
}

export default function SettingsPanel() {
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    fontSize,
    setFontSize,
    glassEffect,
    setGlassEffect,
    autoSave,
    setAutoSave,
    showMinimap,
    setShowMinimap,
    sidebarPosition,
    setSidebarPosition,
  } = useSettingsStore();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="scrollbar-hide flex-1 overflow-y-auto px-3 py-3">
        {/* Theme mode */}
        <Section title="外观模式">
          <div className="flex gap-1.5">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleChange('外观模式', () => setTheme(opt.value as ThemeMode))}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-[10px] transition-all ${
                  theme === opt.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/50 text-muted-foreground hover:border-primary/30'
                }`}
              >
                <opt.icon className={`h-4 w-4 ${theme === opt.value ? 'text-primary' : ''}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Accent color */}
        <Section title="主题色">
          <div className="flex flex-wrap gap-2">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleChange('主题色', () => setAccentColor(opt.value as AccentColor))}
                className="group flex flex-col items-center gap-1"
              >
                <div
                  className={`h-7 w-7 rounded-full transition-all ${
                    accentColor === opt.value ? 'scale-110 ring-2 ring-offset-1 ring-offset-background' : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: opt.color,
                    ...(accentColor === opt.value ? { boxShadow: `0 0 12px ${opt.color}50` } : {}),
                  }}
                />
                <span className={`text-[9px] ${accentColor === opt.value ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* Font size */}
        <Section title="字体大小">
          <div className="flex gap-1 rounded-lg border border-border/50 bg-white/3 p-0.5">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleChange('字体大小', () => setFontSize(opt.value as FontSize))}
                className={`flex-1 rounded-md py-1.5 text-[10px] transition-all ${
                  fontSize === opt.value
                    ? 'bg-primary font-medium text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Toggles */}
        <Section title="功能">
          <div className="space-y-2">
            <Toggle checked={glassEffect} onChange={(v) => handleChange('毛玻璃', () => setGlassEffect(v))} label="毛玻璃效果" />
            <Toggle checked={autoSave} onChange={(v) => handleChange('自动保存', () => setAutoSave(v))} label="自动保存" />
            <Toggle checked={showMinimap} onChange={(v) => handleChange('小地图', () => setShowMinimap(v))} label="显示小地图" />
          </div>
        </Section>

        {/* Sidebar position */}
        <Section title="菜单栏位置">
          <div className="flex gap-1.5">
            {([
              { value: 'left', label: '左侧', icon: PanelLeft },
              { value: 'right', label: '右侧', icon: PanelRight },
            ] as { value: SidebarPosition; label: string; icon: React.ElementType }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleChange('菜单栏位置', () => setSidebarPosition(opt.value))}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-[10px] transition-all ${
                  sidebarPosition === opt.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/50 text-muted-foreground hover:border-primary/30'
                }`}
              >
                <opt.icon className={`h-4 w-4 ${sidebarPosition === opt.value ? 'text-primary' : ''}`} />
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[9px] text-muted-foreground/50">切换后立即生效，无需刷新</p>
        </Section>

        <p className="mt-3 text-center text-[9px] text-muted-foreground/50">
          设置自动保存至浏览器本地存储
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-white/5"
    >
      {label}
      <div
        className={`relative h-4 w-7 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <div
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  );
}
