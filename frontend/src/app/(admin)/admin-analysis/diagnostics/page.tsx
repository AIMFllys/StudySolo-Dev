'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  runDiagnostics,
  groupComponentsByCategory,
  copyToClipboard,
  downloadAsFile,
  formatLatency,
  formatTimestamp,
  type DiagnosticsResponse,
} from '@/services/diagnostics';
import { ComponentRow } from '@/features/admin/diagnostics/ComponentRow';

export default function DiagnosticsPage() {
  const [result, setResult] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  const handleRunDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await runDiagnostics();
      setResult(data);
      toast.success(`检测完成: ${data.summary.healthy}/${data.summary.total} 项通过`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '检测失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleComponent = useCallback((id: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const handleCopyMarkdown = useCallback(async () => {
    if (!result) return;
    toast.success(await copyToClipboard(result.reports.markdown) ? 'Markdown 报告已复制' : '复制失败');
  }, [result]);

  const handleCopyText = useCallback(async () => {
    if (!result) return;
    toast.success(await copyToClipboard(result.reports.text) ? '纯文本报告已复制' : '复制失败');
  }, [result]);

  const handleCopyJson = useCallback(async () => {
    if (!result) return;
    toast.success(await copyToClipboard(result.reports.json) ? 'JSON 报告已复制' : '复制失败');
  }, [result]);

  const handleDownloadJson = useCallback(() => {
    if (!result) return;
    const filename = `diagnostics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    downloadAsFile(result.reports.json, filename, 'application/json');
    toast.success('JSON 报告已下载');
  }, [result]);

  const categoryGroups = result ? groupComponentsByCategory(result.components) : [];
  const totalLatency = result ? result.components.reduce((sum, c) => sum + c.latency_ms, 0) : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">系统诊断面板</h1>
            <p className="mt-1 text-sm text-muted-foreground">一键检测所有系统组件健康状态</p>
          </div>
          <button
            onClick={handleRunDiagnostics}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">
              {loading ? 'progress_activity' : 'play_arrow'}
            </span>
            {loading ? '检测中...' : '运行全检'}
          </button>
        </div>

        {result && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${result.overall_healthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <span className="material-symbols-outlined text-[16px]">
                  {result.overall_healthy ? 'check_circle' : 'error'}
                </span>
                {result.overall_healthy ? '系统健康' : '存在故障'}
              </span>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{result.summary.healthy}/{result.summary.total}</span>{' '}项通过
                {result.summary.unhealthy > 0 && <span className="ml-1 text-red-600">({result.summary.unhealthy} 项故障)</span>}
              </div>
              <div className="text-sm text-muted-foreground">
                总耗时: <span className="font-medium text-foreground">{formatLatency(totalLatency)}</span>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">上次检测: {formatTimestamp(result.timestamp)}</div>
            </div>
          </div>
        )}

        {result && categoryGroups.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryGroups.map((group) => (
              <div key={group.category} className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${group.unhealthy === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <span className={`material-symbols-outlined text-[20px] ${group.unhealthy === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {group.unhealthy === 0 ? group.icon : 'error'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{group.label}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={group.unhealthy === 0 ? 'text-green-600' : 'text-red-600'}>{group.healthy}/{group.total}</span>
                      <span>项通过</span>
                      {group.unhealthy > 0 && <span className="text-red-600">({group.unhealthy} 项故障)</span>}
                    </div>
                  </div>
                </div>
                {group.unhealthy > 0 && (
                  <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {group.components.find((c) => c.status === 'unhealthy')?.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold text-foreground">详细检测结果</h2>
            </div>
            <div className="divide-y divide-border">
              {result.components.map((component) => (
                <ComponentRow
                  key={component.id}
                  component={component}
                  expanded={expandedComponents.has(component.id)}
                  onToggle={() => toggleComponent(component.id)}
                />
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">复制报告:</span>
            {[
              { icon: 'markdown', label: 'Markdown', handler: handleCopyMarkdown },
              { icon: 'article', label: '纯文本', handler: handleCopyText },
              { icon: 'code', label: 'JSON', handler: handleCopyJson },
              { icon: 'download', label: '下载 JSON', handler: handleDownloadJson },
            ].map(({ icon, label, handler }) => (
              <button key={label} onClick={handler} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                <span className="material-symbols-outlined text-[16px]">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        )}

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <span className="material-symbols-outlined text-[28px] text-muted-foreground">stethoscope</span>
            </div>
            <h3 className="mt-4 font-medium text-foreground">尚未运行检测</h3>
            <p className="mt-1 text-sm text-muted-foreground">点击右上角「运行全检」按钮开始系统诊断</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16">
            <div className="flex h-12 w-12 animate-spin items-center justify-center rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">正在检测系统组件...</p>
          </div>
        )}
      </div>
    </div>
  );
}
