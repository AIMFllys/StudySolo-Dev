'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/utils/date';
import type { WorkflowMeta } from '@/types/workflow';
import { MoreVertical, Star, Heart, FileText, Globe, Trash2, Edit3, Tag } from 'lucide-react';
import { SidebarContextMenu } from '@/components/layout/sidebar/SidebarContextMenu';

interface WorkflowListProps {
  initialWorkflows: WorkflowMeta[];
  userName?: string;
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: '草稿', className: 'bg-slate-100 text-slate-600 border border-slate-200/60' },
    running: {
      label: '运行中',
      className: 'bg-blue-50 text-blue-600 border border-blue-100',
    },
    completed: {
      label: '已完成',
      className: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    },
    error: {
      label: '错误',
      className: 'bg-rose-50 text-rose-600 border border-rose-100',
    },
  };
  return map[status] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-600 border border-slate-200/60',
  };
}

export default function WorkflowList({ initialWorkflows, userName = 'StudySolo 官方' }: WorkflowListProps) {
  // Use local state to mock interactions
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>(
    initialWorkflows.map((w, i) => ({
      ...w,
      is_favorite: w.is_favorite ?? (i === 0),
      is_published: w.is_published ?? (i === 1),
      likes_count: w.likes_count ?? (i === 1 ? 128 : 0),
    }))
  );

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; workflowId: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, workflowId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, workflowId });
  };

  const closeMenu = () => setContextMenu(null);

  const toggleFavoriteHandler = (id: string) => {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_favorite: !w.is_favorite } : w));
    closeMenu();
  };

  const togglePublishHandler = (id: string) => {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_published: !w.is_published, likes_count: !w.is_published ? (w.likes_count || 0) : w.likes_count } : w));
    closeMenu();
  };

  const deleteWorkflowHandler = (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
    closeMenu();
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavoriteHandler(id);
  };

  const deleteWorkflow = (id: string) => {
    deleteWorkflowHandler(id);
  };

  const favorites = workflows.filter(w => w.is_favorite);
  const published = workflows.filter(w => !w.is_favorite && w.is_published);
  const uncategorized = workflows.filter(w => !w.is_favorite && !w.is_published);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'desc' | 'tags' | null>(null);

  const handleEditSubmit = (id: string, field: 'name' | 'desc' | 'tags', newValue: string) => {
    if (newValue.trim() || field === 'desc' || field === 'tags') {
       if (field === 'name') {
         setWorkflows(prev => prev.map(w => w.id === id ? { ...w, name: newValue.trim() } : w));
       } else if (field === 'desc') {
         setWorkflows(prev => prev.map(w => w.id === id ? { ...w, description: newValue.trim() } : w));
       } else if (field === 'tags') {
         setWorkflows(prev => prev.map(w => w.id === id ? { ...w, tags: newValue.split(',').map(s => s.trim()).filter(Boolean) } : w));
       }
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
        <Link href={`/workspace/${workflow.id}`} className="absolute inset-0 z-0" />
        
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
               <div className="flex flex-col gap-2 relative z-20">
                 <input
                  autoFocus
                  defaultValue={workflow.description || ''}
                  placeholder="添加描述..."
                  className="w-full pointer-events-auto text-[13px] text-muted-foreground bg-background border border-primary/40 rounded px-2 py-1 shadow-sm outline-none"
                  onBlur={(e) => handleEditSubmit(workflow.id, 'desc', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditSubmit(workflow.id, 'desc', e.currentTarget.value);
                    if (e.key === 'Escape') setEditingCardId(null);
                  }}
                 />
               </div>
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
            <span className="max-w-[100px] truncate" title={userName}>{userName}</span> 
          </div>
          
          <div className="flex items-center justify-end gap-3 text-[11px] pointer-events-auto">
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground/80">
              <div className="flex items-center gap-1 cursor-default group/likes" title="点赞数">
                <Heart className="w-3.5 h-3.5 transition-colors group-hover/likes:text-rose-400 group-hover/likes:fill-rose-400/20" />
                <span>{workflow.likes_count || 0}</span>
              </div>
              
              <button 
                onClick={(e) => toggleFavorite(e, workflow.id)}
                className={`flex items-center transition-colors hover:scale-110 active:scale-95 duration-200 ${workflow.is_favorite ? 'text-amber-500' : 'hover:text-amber-500'}`}
                title={workflow.is_favorite ? "取消收藏" : "收藏工作流"}
              >
                <Star className={`w-3.5 h-3.5 ${workflow.is_favorite ? 'fill-amber-500' : ''}`} />
              </button>
            </div>

            {/* Bottom Right Tags Area */}
            <div className="flex items-center gap-1.5">
              {isEditingTags ? (
                <input
                  autoFocus
                  defaultValue={workflow.tags?.join(', ') || ''}
                  placeholder="自定义标签..."
                  className="w-24 pointer-events-auto bg-white border border-primary/40 rounded px-1.5 py-0.5 outline-none shadow-sm text-slate-700"
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
                     <span key={idx} className="shrink-0 bg-slate-100/80 text-slate-600 border border-slate-200/50 rounded-full px-2.5 py-0.5 font-medium pointer-events-none">
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
        <p className="mt-1 text-xs">点击右上角新建工作流开始</p>
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
          onDelete={deleteWorkflow}
          onToggleFavorite={toggleFavoriteHandler}
          onTogglePublish={togglePublishHandler}
          onEditDescription={(id) => startEdit(id, 'desc')}
          onEditTags={(id) => startEdit(id, 'tags')}
        />
      )}
    </>
  );
}
