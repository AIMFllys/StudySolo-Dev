'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PanelRightOpen, ChevronUp, X, Play, Square } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { useWorkflowExecution } from '@/features/workflow/hooks/use-workflow-execution';
import RightPanelContent from './sidebar/RightPanelContent';

const SWIPE_THRESHOLD = 60;
const DEFAULT_HEIGHT = 45; // percentage
const EXPANDED_HEIGHT = 80; // percentage

export function MobileRightPanelTrigger({ onClick }: { onClick: () => void }) {
  const { status } = useWorkflowExecution();
  const isRunning = status === 'running';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`md:hidden fixed bottom-20 right-4 z-40 flex h-12 items-center gap-2 rounded-full px-4 shadow-lg backdrop-blur-md border transition-all active:scale-95 ${
        isRunning
          ? 'bg-primary text-primary-foreground border-primary/50'
          : 'bg-background/95 text-foreground border-border'
      }`}
      aria-label="打开执行面板"
    >
      <PanelRightOpen className="h-5 w-5" />
      <span className="text-sm font-medium">执行面板</span>
      {isRunning && (
        <span className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
      )}
    </button>
  );
}

export default function MobileRightPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(DEFAULT_HEIGHT);

  const { status, start, stop } = useWorkflowExecution();
  const isRunning = status === 'running';

  const nodes = useWorkflowStore((s) => s.nodes);
  const hasNodes = nodes.length > 0;

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = height;
  }, [height]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const deltaY = dragStartY.current - e.touches[0].clientY;
    const viewportHeight = window.innerHeight;
    const deltaPercent = (deltaY / viewportHeight) * 100;
    const newHeight = Math.max(30, Math.min(90, dragStartHeight.current + deltaPercent));

    setHeight(newHeight);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    // Snap to nearest state
    if (height < 35) {
      setIsOpen(false);
      setHeight(DEFAULT_HEIGHT);
    } else if (height > 70) {
      setHeight(EXPANDED_HEIGHT);
    } else {
      setHeight(DEFAULT_HEIGHT);
    }
  }, [height]);

  const toggleExpand = useCallback(() => {
    if (height === EXPANDED_HEIGHT) {
      setHeight(DEFAULT_HEIGHT);
    } else {
      setHeight(EXPANDED_HEIGHT);
    }
  }, [height]);

  if (!isOpen) {
    return <MobileRightPanelTrigger onClick={() => setIsOpen(true)} />;
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => {
          setIsOpen(false);
          setHeight(DEFAULT_HEIGHT);
        }}
      />

      {/* Panel */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl border-t border-border overflow-hidden transition-transform duration-200"
        style={{
          height: `${height}%`,
          transform: isDragging ? 'none' : undefined,
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={toggleExpand}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mb-2" />
          <div className="flex items-center justify-between w-full px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">执行面板</span>
              {isRunning && (
                <span className="flex items-center gap-1.5 text-xs text-primary">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  运行中
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand();
                }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronUp
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    height === EXPANDED_HEIGHT ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  setHeight(DEFAULT_HEIGHT);
                }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          {isRunning ? (
            <button
              onClick={stop}
              className="flex-1 flex items-center justify-center gap-2 bg-rose-500 text-white rounded-lg py-2.5 text-sm font-medium active:scale-[0.98] transition-transform"
            >
              <Square className="h-4 w-4 fill-current" />
              停止运行
            </button>
          ) : (
            <button
              onClick={() => start()}
              disabled={!hasNodes}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
            >
              <Play className="h-4 w-4 fill-current" />
              开始运行
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto h-[calc(100%-100px)]">
          <RightPanelContent />
        </div>
      </div>
    </div>
  );
}

