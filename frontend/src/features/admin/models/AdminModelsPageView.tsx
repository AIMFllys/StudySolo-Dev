'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ConfirmDialog,
  EmptyState,
  KpiCard,
  PageHeader,
  TableSkeletonRows,
} from '@/features/admin/shared';
import { getAdminModelCatalog, updateAdminModelCatalogItem } from '@/services/admin.service';
import type { CatalogSku } from '@/types/ai-catalog';
import type { TierType } from '@/services/auth.service';

interface CatalogDraft {
  display_name: string;
  required_tier: TierType;
  is_enabled: boolean;
  is_visible: boolean;
  is_user_selectable: boolean;
  is_fallback_only: boolean;
  input_price_cny_per_million: number;
  output_price_cny_per_million: number;
  price_source: string;
  sort_order: number;
}

function buildDraft(item: CatalogSku): CatalogDraft {
  return {
    display_name: item.display_name,
    required_tier: item.required_tier,
    is_enabled: item.is_enabled,
    is_visible: item.is_visible,
    is_user_selectable: item.is_user_selectable,
    is_fallback_only: item.is_fallback_only,
    input_price_cny_per_million: item.input_price_cny_per_million,
    output_price_cny_per_million: item.output_price_cny_per_million,
    price_source: item.price_source ?? '',
    sort_order: item.sort_order,
  };
}

function isDraftDirty(draft: CatalogDraft, original: CatalogSku): boolean {
  return (
    draft.display_name !== original.display_name ||
    draft.required_tier !== original.required_tier ||
    draft.is_enabled !== original.is_enabled ||
    draft.is_visible !== original.is_visible ||
    draft.is_user_selectable !== original.is_user_selectable ||
    draft.is_fallback_only !== original.is_fallback_only ||
    draft.input_price_cny_per_million !== original.input_price_cny_per_million ||
    draft.output_price_cny_per_million !== original.output_price_cny_per_million ||
    draft.price_source !== (original.price_source ?? '') ||
    draft.sort_order !== original.sort_order
  );
}

const TIER_LABELS: Record<string, string> = {
  free: '免费',
  pro: '专业版',
  pro_plus: '增强版',
  ultra: '旗舰版',
};

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export function AdminModelsPageView() {
  const [items, setItems] = useState<CatalogSku[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CatalogDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmSkuId, setConfirmSkuId] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminModelCatalog();
      const data = response.items ?? [];
      setItems(data);
      setDrafts(Object.fromEntries(data.map((item) => [item.sku_id, buildDraft(item)])));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '获取模型目录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const summary = useMemo(() => {
    const enabled = items.filter((i) => i.is_enabled).length;
    const visible = items.filter((i) => i.is_visible).length;
    const selectable = items.filter((i) => i.is_user_selectable).length;
    const native = items.filter((i) => i.billing_channel === 'native').length;
    const proxy = items.filter((i) => i.billing_channel === 'proxy').length;
    return { enabled, visible, selectable, native, proxy };
  }, [items]);

  const updateDraft = (skuId: string, patch: Partial<CatalogDraft>) => {
    setDrafts((cur) => ({ ...cur, [skuId]: { ...cur[skuId], ...patch } }));
  };

  const handleSaveConfirm = async () => {
    if (!confirmSkuId) return;
    const draft = drafts[confirmSkuId];
    if (!draft) return;
    setSavingId(confirmSkuId);
    setConfirmSkuId(null);
    setError(null);
    try {
      await updateAdminModelCatalogItem(confirmSkuId, draft);
      await fetchCatalog();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '更新模型目录失败');
    } finally {
      setSavingId(null);
    }
  };

  const confirmItem = confirmSkuId ? items.find((i) => i.sku_id === confirmSkuId) : null;
  const confirmDraft = confirmSkuId ? drafts[confirmSkuId] : null;

  return (
    <div className="mx-auto min-h-full max-w-[1600px] space-y-6 px-8 py-8 md:px-12">
      <PageHeader
        title="模型目录管理"
        description={`平台 SKU 目录与计费元数据，当前 ${items.length} 个 SKU`}
      />

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-red-500">error</span>
            <span>{error}</span>
          </div>
          <button onClick={() => void fetchCatalog()} className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 transition-colors">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            重试
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="已启用" value={String(summary.enabled)} sub={`共 ${items.length} 个 SKU`} />
        <KpiCard label="可见" value={String(summary.visible)} />
        <KpiCard label="用户可选" value={String(summary.selectable)} />
        <KpiCard label="Native" value={String(summary.native)} />
        <KpiCard label="Proxy" value={String(summary.proxy)} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-400">model_training</span>
            <h2 className="text-sm font-semibold tracking-wide text-slate-900">平台级模型 SKU 目录</h2>
          </div>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200">
            共 {items.length} 条
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {['SKU / 模型', '平台 / 厂商', '展示名 / 等级', '账单通道', '价格 (¥/百万Token)', '开关', '操作'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeletonRows rows={6} cols={7} />
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="p-8"><EmptyState title="暂无模型目录" description="当前没有可展示的模型 SKU。" /></td></tr>
              ) : (
                items.map((item) => {
                  const draft = drafts[item.sku_id] ?? buildDraft(item);
                  const dirty = isDraftDirty(draft, item);
                  const saving = savingId === item.sku_id;
                  return (
                    <tr key={item.sku_id} className="align-top transition-colors hover:bg-slate-50/50">
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-xs font-semibold text-slate-900">{item.sku_id}</div>
                        <div className="mt-1 font-mono text-[11px] text-slate-400">{item.model_id}</div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-700">
                        <div>{item.provider}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.vendor} · {item.family_name}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-2">
                          <input value={draft.display_name} onChange={(e) => updateDraft(item.sku_id, { display_name: e.target.value })} className={INPUT_CLASS} />
                          <select value={draft.required_tier} onChange={(e) => updateDraft(item.sku_id, { required_tier: e.target.value as TierType })} className={INPUT_CLASS}>
                            {Object.entries(TIER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        <div>{item.billing_channel}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.task_family}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="grid gap-2">
                          <label className="text-[10px] text-slate-400">输入</label>
                          <input type="number" step="0.0001" value={draft.input_price_cny_per_million} onChange={(e) => updateDraft(item.sku_id, { input_price_cny_per_million: Number(e.target.value) })} className={`${INPUT_CLASS} text-xs`} />
                          <label className="text-[10px] text-slate-400">输出</label>
                          <input type="number" step="0.0001" value={draft.output_price_cny_per_million} onChange={(e) => updateDraft(item.sku_id, { output_price_cny_per_million: Number(e.target.value) })} className={`${INPUT_CLASS} text-xs`} />
                          <input value={draft.price_source} onChange={(e) => updateDraft(item.sku_id, { price_source: e.target.value })} placeholder="价格来源" className={`${INPUT_CLASS} text-xs`} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="grid gap-2 text-xs text-slate-600">
                          {([['is_enabled', '启用'], ['is_visible', '可见'], ['is_user_selectable', '用户可选'], ['is_fallback_only', '仅 fallback']] as const).map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={draft[key]} onChange={(e) => updateDraft(item.sku_id, { [key]: e.target.checked })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setConfirmSkuId(item.sku_id)}
                          disabled={!dirty || saving}
                          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {saving ? (
                            <><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>保存中</>
                          ) : (
                            <><span className="material-symbols-outlined text-[14px]">save</span>保存</>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={!!confirmSkuId}
        title="确认保存模型配置"
        description={confirmItem ? `即将更新 ${confirmItem.display_name} (${confirmItem.sku_id}) 的配置，此操作将直接修改数据库并立即生效。` : ''}
        confirmLabel="确认保存"
        cancelLabel="取消"
        variant="warning"
        loading={!!savingId}
        onConfirm={() => void handleSaveConfirm()}
        onCancel={() => setConfirmSkuId(null)}
      >
        {confirmDraft && confirmItem && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            {confirmDraft.display_name !== confirmItem.display_name && <div>展示名: {confirmItem.display_name} → {confirmDraft.display_name}</div>}
            {confirmDraft.required_tier !== confirmItem.required_tier && <div>等级: {confirmItem.required_tier} → {confirmDraft.required_tier}</div>}
            {confirmDraft.is_enabled !== confirmItem.is_enabled && <div>启用: {String(confirmItem.is_enabled)} → {String(confirmDraft.is_enabled)}</div>}
            {confirmDraft.is_visible !== confirmItem.is_visible && <div>可见: {String(confirmItem.is_visible)} → {String(confirmDraft.is_visible)}</div>}
            {confirmDraft.input_price_cny_per_million !== confirmItem.input_price_cny_per_million && <div>输入价格: {confirmItem.input_price_cny_per_million} → {confirmDraft.input_price_cny_per_million}</div>}
            {confirmDraft.output_price_cny_per_million !== confirmItem.output_price_cny_per_million && <div>输出价格: {confirmItem.output_price_cny_per_million} → {confirmDraft.output_price_cny_per_million}</div>}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
