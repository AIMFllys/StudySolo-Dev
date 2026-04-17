'use client';

import { ChevronRight, Copy, ExternalLink, Plug, Unplug, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { eventBus } from '@/lib/events/event-bus';
import { getTierLabel, getUser, type TierType, type UserInfo } from '@/services/auth.service';
import { DeveloperTokens } from '@/features/settings/components';

const MOCK_BILLING = {
  balance: 25.8,
  currency: '¥',
  monthlyUsage: 14.2,
  monthlyLimit: 50.0,
};

const getTierBorder = (tier: TierType) => {
  switch (tier) {
    case 'free':
      return 'border-muted-foreground/40 text-muted-foreground';
    case 'pro':
      return 'border-slate-500/60 text-slate-700 dark:text-slate-300';
    case 'pro_plus':
      return 'border-emerald-500/60 text-emerald-700 dark:text-emerald-400';
    case 'ultra':
      return 'border-amber-500/70 text-amber-700 dark:text-amber-500';
    default:
      return 'border-border/50 text-foreground';
  }
};

const getTierCardStyle = (tier: TierType) => {
  switch (tier) {
    case 'free':
      return 'node-paper-bg border-border/50 text-foreground';
    case 'pro':
      return 'node-paper-bg border-slate-300 dark:border-slate-800 text-foreground';
    case 'pro_plus':
      return 'node-paper-bg border-emerald-300 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-50';
    case 'ultra':
      return 'node-paper-bg border-amber-300 dark:border-amber-900/40 text-amber-950 dark:text-amber-50';
    default:
      return 'node-paper-bg border-border/50 text-foreground';
  }
};

/** Cursor / Claude Desktop 可直接粘贴的 MCP 配置示例（静态展示）。 */
const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "studysolo": {
      "command": "studysolo-mcp",
      "env": {
        "STUDYSOLO_API_BASE": "http://127.0.0.1:2038",
        "STUDYSOLO_TOKEN": "sk_studysolo_在上方新建并粘贴"
      }
    }
  }
}`;

function McpConfigSnippet() {
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(MCP_CONFIG_SNIPPET);
      toast.success('已复制 MCP 配置示例');
    } catch {
      toast.error('复制失败，请手动选中复制');
    }
  }, []);

  return (
    <div className="node-paper-bg relative mt-2 overflow-hidden rounded-xl border-[1.5px] border-border/50 shadow-sm font-mono text-[11px]">
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-dashed border-border/50">
        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">
          Cursor / Claude Desktop 配置示例
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="复制 MCP 配置示例"
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border/60 px-2 text-[10px] font-medium text-foreground hover:bg-muted/40"
        >
          <Copy className="h-3 w-3" aria-hidden />
          复制
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[10px] leading-relaxed text-foreground/90">
        <code>{MCP_CONFIG_SNIPPET}</code>
      </pre>
    </div>
  );
}

export default function WalletPanel() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const userTier: TierType = user?.tier ?? 'free';

  const fetchUser = useCallback(() => {
    getUser().then(setUser).catch(() => null);
  }, []);

  useEffect(() => {
    fetchUser();
    return eventBus.on('studysolo:tier-refresh', () => {
      fetchUser();
    });
  }, [fetchUser]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="scrollbar-hide flex-1 overflow-y-auto w-full px-3 py-4 space-y-6">
        {/* --- 第一部分：个人钱包与通行证 --- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground font-serif">
              身份与资源
            </span>
          </div>

          <div
            onClick={() => router.push('/upgrade')}
            className={`relative flex flex-col rounded-xl border-[1.5px] p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 shadow-sm hover:shadow-md group ${getTierCardStyle(userTier)}`}
          >
            <div className="flex items-center gap-3 relative z-10">
              <div
                className={`node-paper-bg relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-dashed ${getTierBorder(userTier)}`}
              >
                <User className="h-[18px] w-[18px] stroke-[1.5]" />
                <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-[1.5px] border-background bg-current" />
              </div>
              <div className="flex flex-col flex-1 pl-1">
                <span className="text-sm font-serif font-semibold opacity-90 tracking-wide">
                  {user?.name || '学习记录者'}
                </span>
                <div className="flex items-center gap-1.5 font-mono text-[10px] mt-0.5 opacity-70">
                  <span className="uppercase">等级:</span>
                  <span className="font-bold border border-current/20 px-1 py-0.5 rounded-sm leading-none tracking-widest">
                    {getTierLabel(userTier)}
                  </span>
                </div>
                {user?.tier_expires_at && userTier !== 'free' && (
                  <div className="mt-1 flex items-center gap-1 font-mono text-[9px] tracking-wider opacity-60">
                    <span>到期日</span>
                    <span className="opacity-50">·</span>
                    <span>
                      {new Date(user.tier_expires_at).toLocaleDateString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 opacity-40 transition-transform group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <div className="mt-5 pt-4 border-t border-dashed border-current/20 flex justify-between items-end relative z-10">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-serif tracking-wider opacity-70">学习点券余额</span>
                <span className="text-xl font-mono font-bold leading-none tracking-tight">
                  {MOCK_BILLING.currency}
                  {MOCK_BILLING.balance.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="node-paper-bg rounded-lg text-[11px] font-mono font-medium tracking-wide px-3 py-1.5 border-[1.5px] border-current/30 shadow-sm hover:-translate-y-0.5 hover:shadow hover:border-current/50 transition-all text-foreground"
              >
                前往充值
              </button>
            </div>

            <div className="mt-4 relative z-10">
              <div className="flex justify-between text-[9px] font-mono tracking-wider opacity-70 mb-1.5">
                <span>月度额度</span>
                <span>{((MOCK_BILLING.monthlyUsage / MOCK_BILLING.monthlyLimit) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-current/10 rounded-full overflow-hidden border border-current/10">
                <div
                  className="h-full bg-current opacity-80 rounded-r-full"
                  style={{ width: `${(MOCK_BILLING.monthlyUsage / MOCK_BILLING.monthlyLimit) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* --- 第二部分：开发者 / API Token（真实接入 /api/tokens） --- */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1 mb-1 border-b-[1.5px] border-dashed border-border/50 pb-2">
            <span className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground font-serif">
              开发者 / API Token
            </span>
            <Unplug className="h-3.5 w-3.5 text-muted-foreground/60 stroke-[1.5]" />
          </div>

          <p className="text-[11px] text-muted-foreground/80 leading-relaxed px-1 font-serif">
            用于 StudySolo <strong className="text-foreground font-serif">CLI</strong> 与{' '}
            <strong className="text-foreground font-serif">MCP Server</strong> 的 Bearer Token。明文仅在创建时显示一次，请立即复制到本机配置。
          </p>

          <DeveloperTokens compact />

          <div className="mt-3 flex flex-col gap-1 px-1 text-[11px] font-serif">
            <Link
              href="/wiki/api/cli"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary underline-offset-4 hover:underline decoration-dashed"
            >
              <ExternalLink className="h-3 w-3 stroke-[2]" aria-hidden />
              CLI 使用文档
            </Link>
            <Link
              href="/wiki/api/mcp-host"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary underline-offset-4 hover:underline decoration-dashed"
            >
              <ExternalLink className="h-3 w-3 stroke-[2]" aria-hidden />
              MCP Host 接入文档
            </Link>
          </div>
        </section>

        {/* --- 第三部分：MCP 集成配置示例（静态展示，演示用） --- */}
        <section className="space-y-2 pb-6 pt-4 border-t border-dashed border-border/50">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground font-serif uppercase">
              MCP 集成配置
            </span>
            <Plug className="h-3.5 w-3.5 text-muted-foreground/80 stroke-[1.5]" />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed px-1 font-serif">
            在 Cursor / Claude Desktop 的 MCP 配置中添加以下片段，将上方创建的 Token 填入{' '}
            <code className="font-mono text-[10px] text-foreground">STUDYSOLO_TOKEN</code>。
          </p>
          <McpConfigSnippet />
        </section>
      </div>
    </div>
  );
}
