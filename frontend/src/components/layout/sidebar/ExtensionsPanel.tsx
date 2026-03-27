'use client';

import { Pin, Puzzle, FileText, GraduationCap, BarChart3, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { usePanelStore, PINNABLE_PANELS, type SidebarPanel } from '@/stores/use-panel-store';
import type { LucideIcon } from 'lucide-react';

// ─── Phase 1 Mock 数据（Phase 2 替换为 GET /api/extensions/） ─────────────────

interface MockExtension {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  version: string;
  tier_required: 'free' | 'pro' | 'max';
  installed: boolean;
}

const MOCK_EXTENSIONS: MockExtension[] = [
  {
    id: 'doc_preview',
    name: '文档预览',
    description: '在浏览器内直接预览 Word/PDF 文件，无需下载',
    icon: FileText,
    version: '1.0.0',
    tier_required: 'free',
    installed: false,
  },
  {
    id: 'anki_export',
    name: 'Anki 导出',
    description: '将闪卡节点导出为 Anki 卡组格式 (.apkg)',
    icon: GraduationCap,
    version: '0.9.0',
    tier_required: 'pro',
    installed: false,
  },
  {
    id: 'study_report',
    name: '学习报表',
    description: '工作流历史数据可视化，追踪学习进度',
    icon: BarChart3,
    version: '0.5.0',
    tier_required: 'pro',
    installed: false,
  },
];

// ─── 内置可 Pin 面板的元信息（仅用于 Extensions Panel 展示） ─────────────────

const BUILTIN_PANEL_META: Record<string, { name: string; description: string }> = {
  workflows:          { name: '工作流列表', description: '管理和切换你的所有工作流' },
  'workflow-examples':{ name: '工作流样例', description: '浏览官方工作流模板库' },
  dashboard:          { name: '仪表盘',     description: '查看使用统计和账户概览' },
  wallet:             { name: '钱包设置',   description: '管理余额、充值和消费记录' },
};

// ─── 子组件：Section 标题 ─────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/70 font-serif">
        {title}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-[9px] font-mono text-muted-foreground/50">({count})</span>
      )}
    </div>
  );
}

// ─── 子组件：被 Unpin 的内置面板卡片 ─────────────────────────────────────────
function UnpinnedPanelCard({
  panelId,
  onPin,
}: {
  panelId: SidebarPanel;
  onPin: () => void;
}) {
  const meta = BUILTIN_PANEL_META[panelId];
  if (!meta) return null;

  return (
    <div className="node-paper-bg rounded-xl border-[1.5px] border-border/50 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-border/60 bg-background shadow-sm">
            <Puzzle className="h-3 w-3 stroke-[1.5] text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold font-serif text-foreground">
              {meta.name}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onPin}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium tracking-wide border-[1.5px] border-primary/30 bg-primary/5 text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:shadow active:translate-y-[1px] active:shadow-none"
        >
          <Pin className="h-2.5 w-2.5 stroke-[2]" />
          固定到侧边栏
        </button>
      </div>
      <p className="mt-2 pt-2 border-t border-dashed border-border/50 text-[10px] text-muted-foreground/80">
        {meta.description}
      </p>
    </div>
  );
}

// ─── 子组件：官方拓展卡片 ────────────────────────────────────────────────────
function ExtensionCard({ ext }: { ext: MockExtension }) {
  const Icon = ext.icon;
  const isPro = ext.tier_required !== 'free';

  return (
    <div className="node-paper-bg rounded-xl border-[1.5px] border-border/50 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-border/60 bg-background shadow-sm">
            <Icon className="h-3 w-3 stroke-[1.5] text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs font-semibold font-serif text-foreground">
                {ext.name}
              </p>
              {isPro && (
                <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/30 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                  <Crown className="h-2 w-2" />
                  Pro
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono tracking-wide text-muted-foreground">
              v{ext.version}
            </p>
          </div>
        </div>

        {/* Phase 2 接真实 API 后，disabled 状态将根据用户 tier 动态判断 */}
        <button
          type="button"
          disabled={isPro}
          title={isPro ? '此功能需要 Pro 订阅' : undefined}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium tracking-wide border-[1.5px] shadow-sm transition-all ${
            isPro
              ? 'border-border/30 bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
              : 'border-border/60 bg-background hover:bg-muted/50 text-foreground hover:-translate-y-0.5 hover:shadow active:translate-y-[1px] active:shadow-none'
          }`}
          onClick={() => {
            if (!isPro) {
              // Phase 2: POST /api/extensions/{id}/install
              toast.info(`Phase 2 将接通真实 API：安装 ${ext.name}`);
            }
          }}
        >
          安装
        </button>
      </div>
      <p className="mt-2 pt-2 border-t border-dashed border-border/50 text-[10px] text-muted-foreground/80">
        {ext.description}
      </p>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function ExtensionsPanel() {
  const { pinnedPanels, pinPanel } = usePanelStore();

  // 被 unpin 的内置可移动面板（PINNABLE_PANELS 中不在 pinnedPanels 的那些）
  const unpinnedBuiltins = PINNABLE_PANELS.filter(
    (p) => !pinnedPanels.includes(p)
  ) as SidebarPanel[];

  function handlePin(panel: SidebarPanel) {
    const meta = BUILTIN_PANEL_META[panel];
    pinPanel(panel);
    toast.success(`${meta?.name ?? panel} 已固定到侧边栏`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="scrollbar-hide flex-1 overflow-y-auto px-2 py-3 space-y-5">

        {/* ── Section A: 被 Unpin 的内置面板 ───────────────────────────────── */}
        {unpinnedBuiltins.length > 0 && (
          <section>
            <SectionHeader title="已移出侧边栏" count={unpinnedBuiltins.length} />
            <div className="space-y-2">
              {unpinnedBuiltins.map((panelId) => (
                <UnpinnedPanelCard
                  key={panelId}
                  panelId={panelId}
                  onPin={() => handlePin(panelId)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Section B: 已安装官方拓展（Phase 1 为空，Phase 2 接 API） ──── */}
        {/* Phase 2: GET /api/extensions/installed */}

        {/* ── Section C: 可安装的官方拓展 ──────────────────────────────────── */}
        <section>
          <SectionHeader title="官方拓展" count={MOCK_EXTENSIONS.length} />
          <div className="space-y-2">
            {MOCK_EXTENSIONS.map((ext) => (
              <ExtensionCard key={ext.id} ext={ext} />
            ))}
          </div>
        </section>

        {/* 底部提示 */}
        <p className="text-center text-[10px] text-muted-foreground/50 py-2">
          更多拓展即将推出
        </p>
      </div>
    </div>
  );
}
