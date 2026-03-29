import {
  LayoutList, MessageSquareCode, Store, BookTemplate,
  LayoutDashboard, Puzzle, Wallet, Settings, UserCircle, PanelRightDashed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SidebarPanel } from '@/stores/use-panel-store';

export const PANEL_CONFIG: Record<SidebarPanel, { icon: LucideIcon; label: string }> = {
  'workflows':          { icon: LayoutList,        label: '工作流' },
  'ai-chat':            { icon: MessageSquareCode, label: 'AI 对话' },
  'node-store':         { icon: Store,             label: '节点商店' },
  'workflow-examples':  { icon: BookTemplate,      label: '工作流样例' },
  'dashboard':          { icon: LayoutDashboard,   label: '仪表盘' },
  'extensions':         { icon: Puzzle,            label: '功能拓展' },
  'wallet':             { icon: Wallet,            label: '钱包设置' },
  'user-panel':         { icon: UserCircle,        label: '用户面板' },
  'settings':           { icon: Settings,          label: '设置' },
  'execution':          { icon: PanelRightDashed,  label: '执行面板' },
};

export const IMMOVABLE_UPPER: SidebarPanel[] = ['ai-chat', 'node-store'];

export function getPanelLabel(panel: SidebarPanel): string {
  return PANEL_CONFIG[panel]?.label ?? '';
}
