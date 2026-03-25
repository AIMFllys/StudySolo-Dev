'use client';

import { toast } from 'sonner';
import { PanelLeft, PanelRight } from 'lucide-react';
import { FeedbackChannel } from '@/features/settings/components';
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
                  className={`node-paper-bg h-7 w-7 rounded-full border-[1.5px] transition-all shadow-sm ${
                    accentColor === opt.value ? 'scale-110 border-primary/50 ring-2 ring-primary/20 ring-offset-1 ring-offset-background' : 'border-border/50 hover:scale-105 hover:shadow-md'
                  }`}
                  style={{
                    backgroundColor: opt.color,
                  }}
                />
                <span className={`text-[9px] font-medium tracking-wide mt-1.5 ${accentColor === opt.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* Font size */}
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

        <div className="mt-6">
          <FeedbackChannel />
        </div>
        <p className="mt-4 text-center text-[9px] text-muted-foreground/50">
          设置自动保存至浏览器本地存储
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 pb-6 border-b border-dashed border-border/50 last:border-0 last:pb-0">
      <p className="mb-3 text-[11px] font-medium tracking-[0.1em] text-muted-foreground/80">
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
      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2.5 text-xs font-medium text-foreground transition-all hover:bg-muted/40"
    >
      {label}
      <div
        className={`node-paper-bg relative h-[22px] w-[38px] rounded-full border-[1.5px] transition-all shadow-sm ${
          checked ? 'border-primary/40' : 'border-border/60'
        }`}
      >
        <div
          className={`absolute top-[1.5px] h-[15px] w-[15px] rounded-full border-[1.5px] bg-background shadow-sm transition-transform ${
            checked ? 'translate-x-[18px] border-primary' : 'translate-x-[2px] border-border/60'
          }`}
        />
      </div>
    </button>
  );
}
