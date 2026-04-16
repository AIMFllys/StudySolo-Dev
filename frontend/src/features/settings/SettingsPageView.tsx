'use client';

import { toast } from 'sonner';
import { Settings as SettingsIcon } from 'lucide-react';
import {
  useSettingsStore,
  type AccentColor,
  type FontSize,
  type ThemeMode,
} from '@/stores/ui/use-settings-store';
import { SettingSection, ToggleItem } from '@/features/settings/components';
import {
  ACCENT_OPTIONS,
  FONT_OPTIONS,
  THEME_OPTIONS,
} from '@/features/settings/options';


export function SettingsPageView() {
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
  } = useSettingsStore();

  function handleSettingChange(name: string, action: () => void) {
    action();
    toast.success('设置已保存', {
      description: `${name} 偏好已更新`,
      duration: 2200,
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <SettingsIcon className="w-5 h-5 text-primary" />
            设置
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            自定义你的 StudySolo 使用体验
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card divide-y divide-white/[0.06] dark:border-white/[0.08] dark:divide-white/[0.06] light:border-slate-200 light:divide-slate-100">
        <div className="px-6">
          <SettingSection title="外观模式" description="选择界面的明暗主题">
            <div className="flex gap-3">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    handleSettingChange('外观模式', () =>
                      setTheme(option.value as ThemeMode)
                    )
                  }
                  className={`flex flex-1 flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-all duration-200 ${
                    theme === option.value
                      ? 'border-primary bg-primary/10 text-foreground shadow-glow-sm'
                      : 'border-white/[0.08] text-muted-foreground hover:border-white/[0.15] hover:text-foreground dark:border-white/[0.08] dark:hover:border-white/[0.15] light:border-slate-200 light:hover:border-slate-300'
                  }`}
                >
                  <option.icon
                    className={`w-6 h-6 ${
                      theme === option.value ? 'text-primary' : ''
                    }`}
                  />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </SettingSection>
        </div>

        <div className="px-6">
          <SettingSection title="主题色" description="选择整体强调色">
            <div className="flex gap-3">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    handleSettingChange('主题色', () =>
                      setAccentColor(option.value as AccentColor)
                    )
                  }
                  className="group flex flex-col items-center gap-2"
                >
                  <div
                    className={`h-10 w-10 rounded-full transition-all duration-200 ${
                      accentColor === option.value
                        ? 'scale-110 ring-2 ring-offset-2 ring-offset-background'
                        : 'hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: option.color,
                      ...(accentColor === option.value
                        ? {
                            boxShadow: `0 0 16px ${option.color}60`,
                            ringColor: option.color,
                          }
                        : {}),
                    }}
                  />
                  <span
                    className={`text-[11px] ${
                      accentColor === option.value
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </SettingSection>
        </div>

        <div className="px-6">
          <SettingSection title="字体大小" description="调整界面字体大小">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-1 dark:border-white/[0.06] dark:bg-white/[0.04] light:border-slate-200 light:bg-slate-100">
              <div className="flex gap-2">
                {FONT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      handleSettingChange('字体大小', () =>
                        setFontSize(option.value as FontSize)
                      )
                    }
                    className={`flex-1 rounded-lg py-2 text-sm transition-all duration-200 ${
                      fontSize === option.value
                        ? 'bg-primary font-medium text-white shadow-glow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </SettingSection>
        </div>

        <div className="px-6">
          <SettingSection title="视觉效果">
            <ToggleItem
              checked={glassEffect}
              onChange={(value) =>
                handleSettingChange('毛玻璃效果', () => setGlassEffect(value))
              }
              label="毛玻璃效果"
              description="启用 Glass Morphism 背景模糊效果"
            />
          </SettingSection>
        </div>

        <div className="px-6">
          <SettingSection title="工作流">
            <div className="space-y-1">
              <ToggleItem
                checked={autoSave}
                onChange={(value) =>
                  handleSettingChange('自动保存', () => setAutoSave(value))
                }
                label="自动保存"
                description="编辑工作流时自动保存到云端"
              />
              <ToggleItem
                checked={showMinimap}
                onChange={(value) =>
                  handleSettingChange('小地图', () => setShowMinimap(value))
                }
                label="显示小地图"
                description="在画布右下角显示全局缩略图"
              />
            </div>
          </SettingSection>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">StudySolo</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                AI 驱动的学习工作流平台 · v0.2.001
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-xs font-medium text-primary">MVP</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        设置自动保存至浏览器本地存储
      </p>
    </div>
  );

}
