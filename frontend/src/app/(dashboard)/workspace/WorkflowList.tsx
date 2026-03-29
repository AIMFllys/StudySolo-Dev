'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WorkflowMeta } from '@/types/workflow';
import { Star, Heart, FileText, Globe } from 'lucide-react';
import { SidebarContextMenu } from '@/components/layout/sidebar/SidebarContextMenu';
import { groupWorkflowsForDisplay } from '@/features/workflow/utils/group-workflows';
import {
  toggleLike as apiToggleLike,
  toggleFavorite as apiToggleFavorite,
  updateWorkflow,
  deleteWorkflow as apiDeleteWorkflow,
} from '@/services/workflow.service';

interface WorkflowListProps {
  initialWorkflows: WorkflowMeta[];
  remaining: number;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60' },
  running: { label: '运行中', className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50' },
  completed: { label: '已完成', className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50' },
  error: { label: '错误', className: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50' },
};

function statusLabel(status: string) {
  return STATUS_MAP[status] ?? { label: status, className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60' };
}

export default function WorkflowList({ initialWorkflows, remaining }: WorkflowListProps) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>(initialWorkflows);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; workflowId: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, workflowId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, workflowId });
  };

  const closeMenu = () => setContextMenu(null);

  const toggleFavoriteHandler = async (id: string) => {
    // Optimistic
    setWorkflows(prev => prev.map(w =>
      w.id === id ? { ...w, is_favorited: !w.is_favorited, favorites_count: w.favorites_count + (w.is_favorited ? -1 : 1) } : w
    ));
    closeMenu();
    try {
      const res = await apiToggleFavorite(id);
      setWorkflows(prev => prev.map(w =>
        w.id === id ? { ...w, is_favorited: res.toggled, favorites_count: res.count } : w
      ));
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
      setWorkflows(prev => prev.map(w =>
        w.id === id ? { ...w, is_liked: res.toggled, likes_count: res.count } : w
      ));
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

  const onFavoriteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavoriteHandler(id);
  };

  const { favorites, published, uncategorized } =
    groupWorkflowsForDisplay(workflows);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'desc' | 'tags' | null>(null);

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

  const renderCard = (workflow: WorkflowMeta) => {
    const { label, className } = statusLabel(workflow.status);
    const isEditingName = editingCardId === workflow.id && editingField === 'name';
    const isEditingDesc = editingCardId === workflow.id && editingField === 'desc';
    const isEditingTags = editingCardId === workflow.id && editingField === 'tags';

    return (
      <div 
        key={workflow.id} 
        onContextMenu={(e) => handleContextMenu(e, workflow.id)}
        className="group relative flex flex-col p-4 rounded-[1.25rem] border border-border/80 bg-white/60 dark:bg-card shadow-sm transition-all hover:shadow-md hover:border-black/10 dark:hover:border-white/10"
      >
        <Link href={`/c/${workflow.id}`} className="absolute inset-0 z-0" />
        
        <div className="z-10 flex flex-col mb-3 space-y-1.5 pointer-events-none">
          <div className="flex items-center gap-2">
            <FileText className="w-[18px] h-[18px] text-muted-foreground stroke-[1.5] mt-0.5" />
            {isEditingName ? (
              <input
                autoFocus
                defaultValue={workflow.name}
                className="flex-1 pointer-events-auto text-sm font-medium text-foreground bg-background border-b border-primary/40 outline-none px-1 py-0.5"
                onBlur={(e) => handleEditSubmit(workflow.id, 'name', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSubmit(workflow.id, 'name', e.currentTarget.value);
                  if (e.key === 'Escape') setEditingCardId(null);
                }}
              />
            ) : (
              <h2 className="text-sm font-medium text-foreground line-clamp-1 leading-tight">
                {workflow.name}
              </h2>
            )}
          </div>
          <div className="pl-[26px]">
            {isEditingDesc ? (
               <input
                autoFocus
                defaultValue={workflow.description || ''}
                placeholder="添加描述..."
                className="w-full pointer-events-auto text-[13px] text-muted-foreground bg-background border border-primary/40 rounded px-2 py-1 shadow-sm outline-none relative z-20"
                onBlur={(e) => handleEditSubmit(workflow.id, 'desc', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSubmit(workflow.id, 'desc', e.currentTarget.value);
                  if (e.key === 'Escape') setEditingCardId(null);
                }}
               />
            ) : (
              <p className="text-[13px] text-muted-foreground/80 line-clamp-1">
                {workflow.description || "暂无描述"}
              </p>
            )}
          </div>
        </div>
        
        <div className="z-10 border-t border-dashed border-border/60 my-2" />
        
        <div className="z-10 flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-medium pointer-events-none">
            <span className="opacity-70 font-serif">©</span>
            <span className="max-w-[100px] truncate" title={workflow.owner_name || ''}>{workflow.owner_name || '未知用户'}</span>
          </div>
          
          <div className="flex items-center justify-end gap-3 text-[11px] pointer-events-auto">
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground/80">
              <button
                onClick={(e) => toggleLikeHandler(e, workflow.id)}
                className={`flex items-center gap-1 transition-colors hover:scale-110 active:scale-95 duration-200 ${workflow.is_liked ? 'text-rose-500' : 'hover:text-rose-400'}`}
                title={workflow.is_liked ? '取消点赞' : '点赞'}
              >
                <Heart className={`w-3.5 h-3.5 ${workflow.is_liked ? 'fill-rose-500' : ''}`} />
                <span>{workflow.likes_count}</span>
              </button>
              
              <button 
                onClick={(e) => onFavoriteClick(e, workflow.id)}
                className={`flex items-center transition-colors hover:scale-110 active:scale-95 duration-200 ${workflow.is_favorited ? 'text-amber-500' : 'hover:text-amber-500'}`}
                title={workflow.is_favorited ? '取消收藏' : '收藏工作流'}
              >
                <Star className={`w-3.5 h-3.5 ${workflow.is_favorited ? 'fill-amber-500' : ''}`} />
              </button>
            </div>

            {/* Bottom Right Tags Area */}
            <div className="flex items-center gap-1.5">
              {isEditingTags ? (
                <input
                  autoFocus
                  defaultValue={workflow.tags?.join(', ') || ''}
                  placeholder="自定义标签..."
                  className="w-24 pointer-events-auto bg-white dark:bg-slate-800 border border-primary/40 rounded px-1.5 py-0.5 outline-none shadow-sm text-slate-700 dark:text-slate-300"
                  onBlur={(e) => handleEditSubmit(workflow.id, 'tags', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditSubmit(workflow.id, 'tags', e.currentTarget.value);
                    if (e.key === 'Escape') setEditingCardId(null);
                  }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                />
              ) : (
                 workflow.tags && workflow.tags.length > 0 ? (
                   workflow.tags.map((t, idx) => (
                     <span key={idx} className="shrink-0 bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 rounded-full px-2.5 py-0.5 font-medium pointer-events-none">
                       {t}
                     </span>
                   ))
                 ) : (
                   <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium pointer-events-none ${className}`}>
                     {label}
                   </span>
                 )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, list: WorkflowMeta[], icon: React.ReactNode) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-8 last:mb-0">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground mb-4">
          {icon}
          {title}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(renderCard)}
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
        {renderSection("收藏列表", favorites, <Star className="h-4 w-4 fill-amber-500 text-amber-500" />)}
        {renderSection("社区公开", published, <Globe className="h-4 w-4 text-blue-500" />)}
        {renderSection("未分类工作流", uncategorized, <FileText className="h-4 w-4 text-slate-400" />)}
      </div>

      {/* Context Menu */}
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
