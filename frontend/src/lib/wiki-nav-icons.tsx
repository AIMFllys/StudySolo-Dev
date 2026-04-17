import type { LucideIcon } from 'lucide-react';
import {
  Brain,
  ClipboardList,
  Compass,
  FileText,
  MessageCircle,
  Plug,
  Puzzle,
  Rocket,
  SquareTerminal,
  Wrench,
  Zap,
} from 'lucide-react';

/** 侧栏 / 首页分组标题 */
export const WIKI_SECTION_ICONS: Record<string, LucideIcon> = {
  快速开始: Rocket,
  使用指南: Compass,
  节点文档: Puzzle,
  'API 参考': Plug,
};

/** 具体文档 slug → 图标 */
export const WIKI_DOC_ICONS: Record<string, LucideIcon> = {
  'getting-started/quick-start': Zap,
  'getting-started/concepts': Brain,
  'guides/creating-workflows': Wrench,
  'guides/using-nodes': Puzzle,
  'guides/ai-chat': MessageCircle,
  'api/mcp-host': Plug,
  'api/cli': SquareTerminal,
  'api/agent-skills': ClipboardList,
};

export function WikiDocNavIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon: LucideIcon = WIKI_DOC_ICONS[slug] ?? FileText;
  return <Icon className={className} aria-hidden />;
}
