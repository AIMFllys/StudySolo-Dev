'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  createApiToken,
  deleteApiToken,
  listApiTokens,
  type ApiTokenListItem,
} from '@/services/tokens.service';

const EXPIRY_OPTIONS: { label: string; value: number | null }[] = [
  { label: '永不过期', value: null },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
  { label: '180 天', value: 180 },
  { label: '365 天', value: 365 },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function DeveloperTokens() {
  const [tokens, setTokens] = useState<ApiTokenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpiry, setNewExpiry] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiTokenListItem | null>(null);

  const hasTokens = tokens.length > 0;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listApiTokens();
      setTokens(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error('请输入 Token 名称');
      return;
    }
    setCreating(true);
    try {
      const created = await createApiToken({
        name: trimmed,
        expires_in_days: newExpiry ?? undefined,
      });
      setRevealed(created.token);
      setCreateOpen(false);
      setNewName('');
      setNewExpiry(null);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建失败';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败，请手动选中复制');
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteApiToken(target.id);
      toast.success(`已撤销：${target.name}`);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '撤销失败';
      toast.error(message);
    }
  };

  const rows = useMemo(() => {
    return tokens.map((token) => (
      <div
        key={token.id}
        className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm dark:border-white/[0.06] dark:bg-white/[0.02] light:border-slate-200 light:bg-slate-50 md:flex-row md:items-center md:justify-between"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary/80" aria-hidden />
            <span className="truncate font-medium text-foreground">{token.name}</span>
            <code className="truncate rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {token.token_prefix}…
            </code>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            创建于 {formatDate(token.created_at)} · 最近使用 {formatDate(token.last_used_at)} ·
            {token.expires_at ? ` 过期 ${formatDate(token.expires_at)}` : ' 永不过期'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPendingDelete(token)}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 md:self-center"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          撤销
        </button>
      </div>
    ));
  }, [tokens]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          用于 StudySolo CLI 与 MCP Server 的 Bearer Token。明文仅在创建时显示一次，请妥善保管。
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-glow-sm hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          新建 Token
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          加载中…
        </div>
      ) : hasTokens ? (
        <div className="space-y-2">{rows}</div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center text-xs text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.02] light:border-slate-200 light:bg-slate-50">
          你还没有任何 API Token。点击右上角「新建 Token」开始。
        </div>
      )}

      {/* Create drawer */}
      {createOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => (creating ? undefined : setCreateOpen(false))}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-token-title"
            className="relative z-10 w-[92vw] max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <h3 id="create-token-title" className="text-base font-semibold text-foreground">
              新建 API Token
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              给 Token 起一个方便识别的名字，例如 <code>my-laptop-cli</code>。
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-foreground">
                名称
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-laptop-cli"
                  maxLength={64}
                  autoFocus
                  inputMode="text"
                  autoComplete="off"
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </label>

              <label className="block text-xs font-medium text-foreground">
                有效期
                <select
                  value={String(newExpiry ?? '')}
                  onChange={(e) =>
                    setNewExpiry(e.target.value === '' ? null : Number(e.target.value))
                  }
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  style={{ colorScheme: 'dark' }}
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <option key={String(opt.value ?? 'never')} value={String(opt.value ?? '')}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                创建
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reveal-once dialog */}
      {revealed ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reveal-token-title"
            className="relative z-10 w-[92vw] max-w-lg rounded-2xl border border-amber-500/30 bg-card p-6 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-amber-500">
              <ShieldAlert className="h-5 w-5" aria-hidden />
              <h3 id="reveal-token-title" className="text-base font-semibold">
                请立即复制并保存，该 Token 不会再次显示
              </h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              关闭此窗口后，即使是管理员也无法再看到完整明文。请现在就复制它粘贴到你的 CLI / MCP 配置里。
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground">
              <code className="min-w-0 flex-1 select-all break-all">{revealed}</code>
              <button
                type="button"
                onClick={() => void handleCopy(revealed)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted/60"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                复制
              </button>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setRevealed(null)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                我已保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`撤销 Token「${pendingDelete?.name ?? ''}」？`}
        description="撤销后，使用该 Token 的 CLI / MCP 客户端将立即失去访问权限。此操作不可撤回。"
        confirmLabel="撤销"
        variant="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
