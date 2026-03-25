'use client';

import { SidebarWorkflowItem } from './SidebarWorkflowItem';
import type { WorkflowMeta } from '@/types/workflow';

interface SidebarWorkflowsPanelProps {
  workflows: WorkflowMeta[];
  isWorkflowActive: (id: string) => boolean;
  handleContextMenu: (event: React.MouseEvent, workflowId: string) => void;
  editingWorkflowId: string | null;
  handleRenameSubmit: (id: string, name: string) => void;
  setEditingWorkflowId: (id: string | null) => void;
}

export function SidebarWorkflowsPanel({
  workflows,
  isWorkflowActive,
  handleContextMenu,
  editingWorkflowId,
  handleRenameSubmit,
  setEditingWorkflowId,
}: SidebarWorkflowsPanelProps) {
  if (workflows.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">暂无工作流</p>;
  }
  
  const favs = workflows.filter(w => w.is_favorited);
  const pubs = workflows.filter(w => !w.is_favorited && w.is_public);
  const uncat = workflows.filter(w => !w.is_favorited && !w.is_public);

  return (
    <>
      {favs.length > 0 && (
        <div className="mb-4">
          <div className="px-4 py-1.5 text-[10px] font-bold text-amber-600/80 uppercase tracking-wider font-serif">收藏列表</div>
          {favs.map(w => <SidebarWorkflowItem key={w.id} workflow={w} active={isWorkflowActive(w.id)} onContextMenu={handleContextMenu} isEditing={editingWorkflowId === w.id} onRenameSubmit={handleRenameSubmit} onCancelEdit={() => setEditingWorkflowId(null)} />)}
        </div>
      )}
      {pubs.length > 0 && (
        <div className="mb-4">
          <div className="px-4 py-1.5 text-[10px] font-bold text-blue-600/80 uppercase tracking-wider font-serif">社区公开</div>
          {pubs.map(w => <SidebarWorkflowItem key={w.id} workflow={w} active={isWorkflowActive(w.id)} onContextMenu={handleContextMenu} isEditing={editingWorkflowId === w.id} onRenameSubmit={handleRenameSubmit} onCancelEdit={() => setEditingWorkflowId(null)} />)}
        </div>
      )}
      {uncat.length > 0 && (
        <div className="mb-4">
          <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500/80 uppercase tracking-wider font-serif">未分类笔记</div>
          {uncat.map(w => <SidebarWorkflowItem key={w.id} workflow={w} active={isWorkflowActive(w.id)} onContextMenu={handleContextMenu} isEditing={editingWorkflowId === w.id} onRenameSubmit={handleRenameSubmit} onCancelEdit={() => setEditingWorkflowId(null)} />)}
        </div>
      )}
    </>
  );
}
