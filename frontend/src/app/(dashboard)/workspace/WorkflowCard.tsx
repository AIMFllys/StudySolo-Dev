'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import type { WorkflowMeta } from '@/types/workflow';
import { Star, Heart, FileText, MoreHorizontal } from 'lucide-react';

interface WorkflowCardProps {
  workflow: WorkflowMeta;
  editingCardId: string | null;
  editingField: 'name' | 'desc' | 'tags' | null;
  setEditingCardId: (id: string | null) => void;
  statusLabel: (status: string) => { label: string; className: string };
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onToggleLike: (e: React.MouseEvent, id: string) => void;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  onEditSubmit: (id: string, field: 'name' | 'desc' | 'tags', value: string) => void;
}

export function WorkflowCard({
  workflow,
  editingCardId,
  editingField,
  setEditingCardId,
  statusLabel,
  onContextMenu,
  onToggleLike,
  onToggleFavorite,
  onEditSubmit,
}: WorkflowCardProps) {
  const { label, className } = statusLabel(workflow.status);
  const isEditingName = editingCardId === workflow.id && editingField === 'name';
  const isEditingDesc = editingCardId === workflow.id && editingField === 'desc';
  const isEditingTags = editingCardId === workflow.id && editingField === 'tags';

  // Long press detection for mobile context menu
  const touchTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchTimer.current = setTimeout(() => {
      setShowMobileMenu(true);
    }, 500); // 500ms long press
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartPos.current && touchTimer.current) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        // Moved too much, cancel long press
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  }, []);

  return (
    <div
      onContextMenu={(e) => onContextMenu(e, workflow.id)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="group relative flex flex-col p-4 rounded-[1.25rem] border border-border/80 bg-white/60 dark:bg-card shadow-sm transition-all hover:shadow-md hover:border-black/10 dark:hover:border-white/10 touch-feedback"
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
              onBlur={(e) => onEditSubmit(workflow.id, 'name', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSubmit(workflow.id, 'name', e.currentTarget.value);
                if (e.key === 'Escape') setEditingCardId(null);
              }}
            />
          ) : (
            <h2 className="text-sm font-medium text-foreground line-clamp-1 leading-tight">{workflow.name}</h2>
          )}
        </div>
        <div className="pl-[26px]">
          {isEditingDesc ? (
            <input
              autoFocus
              defaultValue={workflow.description || ''}
              placeholder="添加描述..."
              className="w-full pointer-events-auto text-[13px] text-muted-foreground bg-background border border-primary/40 rounded px-2 py-1 shadow-sm outline-none relative z-20"
              onBlur={(e) => onEditSubmit(workflow.id, 'desc', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSubmit(workflow.id, 'desc', e.currentTarget.value);
                if (e.key === 'Escape') setEditingCardId(null);
              }}
            />
          ) : (
            <p className="text-[13px] text-muted-foreground/80 line-clamp-1">{workflow.description || '暂无描述'}</p>
          )}
        </div>
      </div>

      <div className="z-10 border-t border-dashed border-border/60 my-2" />

      <div className="z-10 flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-medium pointer-events-none">
          <span className="opacity-70 font-serif">©</span>
          <span className="max-w-[100px] truncate" title={workflow.owner_name || ''}>{workflow.owner_name || '未知用户'}</span>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-3 text-[11px] pointer-events-auto">
          {/* Mobile menu button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMobileMenu(true);
            }}
            className="sm:hidden flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="更多操作"
          >
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-2 sm:gap-3 text-[12px] text-muted-foreground/80">
            <button
              onClick={(e) => onToggleLike(e, workflow.id)}
              className={`flex items-center gap-1 transition-colors hover:scale-110 active:scale-95 duration-200 touch-target ${workflow.is_liked ? 'text-rose-500' : 'hover:text-rose-400'}`}
              title={workflow.is_liked ? '取消点赞' : '点赞'}
            >
              <Heart className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${workflow.is_liked ? 'fill-rose-500' : ''}`} />
              <span className="hidden sm:inline">{workflow.likes_count}</span>
            </button>
            <button
              onClick={(e) => onToggleFavorite(e, workflow.id)}
              className={`flex items-center transition-colors hover:scale-110 active:scale-95 duration-200 touch-target ${workflow.is_favorited ? 'text-amber-500' : 'hover:text-amber-500'}`}
              title={workflow.is_favorited ? '取消收藏' : '收藏工作流'}
            >
              <Star className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${workflow.is_favorited ? 'fill-amber-500' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {isEditingTags ? (
              <input
                autoFocus
                defaultValue={workflow.tags?.join(', ') || ''}
                placeholder="自定义标签..."
                className="w-24 pointer-events-auto bg-white dark:bg-slate-800 border border-primary/40 rounded px-1.5 py-0.5 outline-none shadow-sm text-slate-700 dark:text-slate-300"
                onBlur={(e) => onEditSubmit(workflow.id, 'tags', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onEditSubmit(workflow.id, 'tags', e.currentTarget.value);
                  if (e.key === 'Escape') setEditingCardId(null);
                }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              />
            ) : (
              workflow.tags && workflow.tags.length > 0 ? (
                workflow.tags.map((t, idx) => (
                  <span key={idx} className="shrink-0 bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 rounded-full px-2.5 py-0.5 font-medium pointer-events-none">
                    {t}
                  </span>
                ))
              ) : (
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium pointer-events-none ${className}`}>{label}</span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
