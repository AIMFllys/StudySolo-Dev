'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getConfigs, updateConfig } from '@/services/admin.service';
import type { ConfigEntry } from '@/types/admin';
import { EmptyState, PageHeader } from '@/features/admin/shared';
import { ConfigEditorTable } from './ConfigEditorTable';

export function AdminConfigPageView() {
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('{}');
  const [newDescription, setNewDescription] = useState('');

  const configCountText = useMemo(
    () => (configs.length > 0 ? `当前共 ${configs.length} 项系统配置` : '支持读取、修改和新增系统配置'),
    [configs.length]
  );

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getConfigs();
      setConfigs(result.configs);
      setDraftValues(
        Object.fromEntries(
          result.configs.map((entry) => [entry.key, JSON.stringify(entry.value, null, 2)])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载系统配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  async function handleSave(entry: ConfigEntry) {
    const confirmed = window.confirm(`确认保存配置 ${entry.key} 吗？`);
    if (!confirmed) return;

    setSavingKey(entry.key);
    try {
      const nextValue = JSON.parse(draftValues[entry.key] ?? 'null');
      await updateConfig(entry.key, nextValue, entry.description);
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败，请确认 JSON 格式正确');
    } finally {
      setSavingKey(null);
    }
  }

  async function handleCreate() {
    if (!newKey.trim()) {
      setError('请填写配置键。');
      return;
    }

    const confirmed = window.confirm(`确认新建配置 ${newKey.trim()} 吗？`);
    if (!confirmed) return;

    setSavingKey(newKey.trim());
    try {
      const parsedValue = JSON.parse(newValue);
      await updateConfig(newKey.trim(), parsedValue, newDescription.trim() || null);
      setNewKey('');
      setNewValue('{}');
      setNewDescription('');
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '新建配置失败，请确认 JSON 格式正确');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="mx-auto min-h-full max-w-[1600px] space-y-5 px-6 py-6">
      <PageHeader title="系统配置" description={configCountText} />

      {error ? (
        <div className="flex items-center justify-between rounded-md border border-red-800/40 bg-red-950/30 p-4 text-[13px] text-red-400">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-red-400">error</span>
            <span>{error}</span>
          </div>
          <button 
            onClick={() => void fetchConfigs()} 
            className="flex items-center gap-1 text-[12px] font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            重试
          </button>
        </div>
      ) : null}

      <ConfigEditorTable
        configs={configs}
        loading={loading}
        draftValues={draftValues}
        savingKey={savingKey}
        onChangeDraft={(key, value) => setDraftValues((current) => ({ ...current, [key]: value }))}
        onSave={(entry) => {
          void handleSave(entry);
        }}
      />

      <section className="rounded-md border border-[#2e2e2e] bg-[#171717] p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[20px] text-[#666]">add_box</span>
          <h2 className="text-[14px] font-semibold text-[#ededed]">新建配置</h2>
        </div>
        <p className="text-[13px] text-[#8f8f8f] mb-6">配置值需填写为合法 JSON，可直接写对象、数组、布尔值或字符串。</p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <input
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="配置键，例如 feature.admin.notice"
            className="w-full rounded-md border border-[#2e2e2e] bg-[#171717] px-4 py-2.5 text-[13px] text-[#ededed] transition-all placeholder:text-[#666] focus:border-[#3ecf8e] focus:outline-none focus:ring-1 focus:ring-[#3ecf8e]/30"
          />
          <input
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="配置说明"
            className="w-full rounded-md border border-[#2e2e2e] bg-[#171717] px-4 py-2.5 text-[13px] text-[#ededed] transition-all placeholder:text-[#666] focus:border-[#3ecf8e] focus:outline-none focus:ring-1 focus:ring-[#3ecf8e]/30"
          />
        </div>
        
        <textarea
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          rows={6}
          className="mt-4 w-full rounded-md border border-[#2e2e2e] bg-[#232323] px-4 py-3 font-mono text-[13px] text-[#8f8f8f] transition-all focus:border-[#3ecf8e] focus:bg-[#171717] focus:outline-none focus:ring-1 focus:ring-[#3ecf8e]/30"
        />

        <div className="mt-6 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-3 rounded-lg bg-amber-950/30 border border-amber-800/40 px-4 py-3 text-[13px] text-amber-400">
            <span className="material-symbols-outlined mt-0.5 text-[18px] text-amber-400">warning</span>
            <p><strong>危险操作提醒</strong>：系统配置变更会直接影响后台行为，保存前请确认键名和值符合预期。</p>
          </div>
          
          <button
            onClick={() => void handleCreate()}
            disabled={savingKey === newKey.trim()}
            className="flex shrink-0 items-center gap-2 rounded-md bg-[#3ecf8e] px-6 py-2.5 text-[13px] font-medium text-[#171717] transition-all hover:bg-[#2db87a] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e]"
          >
            {savingKey === newKey.trim() ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                创建中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">add</span>
                新建配置
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
