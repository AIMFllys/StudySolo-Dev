'use client';

import { useState } from 'react';
import type { WorkflowMeta } from '@/types/workflow';
import { Star, FileText, Globe } from 'lucide-react';
import { SidebarContextMenu } from '@/components/layout/sidebar/SidebarContextMenu';
import { groupWorkflowsForDisplay } from '@/features/workflow/utils/group-workflows';
import {
  toggleLike as apiToggleLike,
  toggleFavorite as apiToggleFavorite,
  updateWorkflow,
  deleteWorkflow as apiDeleteWorkflow,
} from '@/services/workflow.service';
import { WorkflowCard } from './WorkflowCard';

interface WorkflowListProps {
  initialWorkflows: WorkflowMeta[];
  remaining: number;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60' },
  running: { label: '运行中', className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50' },
  completed: { label: '已完成', className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50' },
  error: { label: '错误', className: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50' },
};

function statusLabel(status: string) {
  return STATUS_MAP[status] ?? { label: status, className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60' };
}

export default function WorkflowList({ initialWorkflows, remaining }: WorkflowListProps) {
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>(initialWorkflows);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; workflowId: string } | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'desc' | 'tags' | null>(null);

  const handleContextMenu = (e: React.MouseEvent, workflowId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, workflowId });
  };

  const closeMenu = () => setContextMenu(null);

  const toggleFavoriteHandler = async (id: string) => {
    setWorkflows(prev => prev.map(w =>
      w.id === id ? { ...w, is_favorited: !w.is_favorited, favorites_count: w.favorites_count + (w.is_favorited ? -1 : 1) } : w
    ));
    closeMenu();
    try {
      const res = await apiToggleFavorite(id);
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_favorited: res.toggled, favorites_count: res.count } : w));
    } catch { /* revert on error handled by next refresh */ }
  };

  const toggleLikeHandler = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setWorkflows(prev => prev.map(w =>
      w.id === id ? { ...w, is_liked: !w.is_liked, likes_count: w.likes_count + (w.is_liked ? -1 : 1) } : w
    ));
    try {
      const res = await apiToggleLike(id);
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_liked: res.toggled, likes_count: res.count } : w));
    } catch { /* noop */ }
  };

  const togglePublishHandler = async (id: string) => {
    const wf = workflows.find(w => w.id === id);
    if (!wf) return;
    const newPublic = !wf.is_public;
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_public: newPublic } : w));
    closeMenu();
    try {
      await updateWorkflow(id, { is_public: newPublic });
      if (newPublic) window.open(`/s/${id}`, '_blank', 'noopener');
    } catch { /* noop */ }
  };

  const deleteWorkflowHandler = async (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
    closeMenu();
    try { await apiDeleteWorkflow(id); } catch { /* noop */ }
  };

  const handleEditSubmit = async (id: string, field: 'name' | 'desc' | 'tags', newValue: string) => {
    const trimmed = newValue.trim();
    if (!trimmed && field === 'name') return;
    if (field === 'name') {
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, name: trimmed } : w));
      try { await updateWorkflow(id, { name: trimmed }); } catch { /* noop */ }
    } else if (field === 'desc') {
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, description: trimmed } : w));
      try { await updateWorkflow(id, { description: trimmed }); } catch { /* noop */ }
    } else if (field === 'tags') {
      const tags = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, tags } : w));
      try { await updateWorkflow(id, { tags }); } catch { /* noop */ }
    }
    setEditingCardId(null);
    setEditingField(null);
  };

  const startEdit = (id: string, field: 'name' | 'desc' | 'tags') => {
    setEditingCardId(id);
    setEditingField(field);
    closeMenu();
  };

  const { favorites, published, uncategorized } = groupWorkflowsForDisplay(workflows);

  const renderSection = (title: string, list: WorkflowMeta[], icon: React.ReactNode) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-8 last:mb-0">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground mb-4">{icon}{title}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              editingCardId={editingCardId}
              editingField={editingField}
              setEditingCardId={setEditingCardId}
              statusLabel={statusLabel}
              onContextMenu={handleContextMenu}
              onToggleLike={toggleLikeHandler}
              onToggleFavorite={(e, id) => { e.preventDefault(); e.stopPropagation(); void toggleFavoriteHandler(id); }}
              onEditSubmit={handleEditSubmit}
            />
          ))}
        </div>
      </div>
    );
  };

  if (workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-sm font-medium">还没有工作流</p>
        {remaining > 0 ? (
          <p className="mt-1 text-xs">点击右上角新建工作流开始</p>
        ) : (
          <p className="mt-1 text-xs text-rose-500">工作流容量已满，请升级会员或购买增值包</p>
        )}
      </div>
    );
  }

  const contextW = workflows.find(w => w.id === contextMenu?.workflowId);

  return (
    <>
      <div className="space-y-2">
        {renderSection('收藏列表', favorites, <Star className="h-4 w-4 fill-amber-500 text-amber-500" />)}
        {renderSection('社区公开', published, <Globe className="h-4 w-4 text-blue-500" />)}
        {renderSection('未分类工作流', uncategorized, <FileText className="h-4 w-4 text-slate-400" />)}
      </div>

      {contextMenu && (
        <SidebarContextMenu
          contextMenu={contextMenu}
          processingWorkflowId={null}
          workflow={contextW}
          onClose={closeMenu}
          onRename={(id) => startEdit(id, 'name')}
          onDelete={deleteWorkflowHandler}
          onToggleFavorite={toggleFavoriteHandler}
          onTogglePublish={togglePublishHandler}
          onEditDescription={(id) => startEdit(id, 'desc')}
          onEditTags={(id) => startEdit(id, 'tags')}
        />
      )}
    </>
  );
}
