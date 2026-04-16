'use client';

import { useState, useCallback } from 'react';
import { Share2, Loader2, Check, Copy } from 'lucide-react';
import { toggleRunShare } from '@/services/memory.service';

function ShareConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />
      <div className="relative bg-background border border-border rounded-xl shadow-xl px-6 py-5 max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Share2 className="h-5 w-5 text-foreground" />
          </div>
          <h3 className="text-sm font-serif font-semibold text-foreground">公开分享此运行记录</h3>
          <div className="text-xs text-muted-foreground leading-relaxed text-left space-y-2">
            <p>分享后，任何拥有链接的人都可以查看：</p>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>工作流的完整画布结构和节点布局</li>
              <li>每个节点的执行输入和输出内容</li>
              <li>执行耗时、模型路由等运行详情</li>
              <li>你的用户输入文本</li>
            </ul>
            <p className="text-[11px] text-muted-foreground/80">你可以随时取消分享来撤回公开访问。</p>
          </div>
          <div className="flex items-center gap-2 mt-1 w-full">
            <button
              onClick={onCancel}
              className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-md bg-foreground text-background px-3 py-2 text-xs font-medium hover:opacity-90 transition-opacity"
            >
              确认分享
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MemoryShareToggle({ runId, initialShared }: { runId: string; initialShared: boolean }) {
  const [isShared, setIsShared] = useState(initialShared);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const doToggle = useCallback(async () => {
    setLoading(true);
    try {
      const result = await toggleRunShare(runId);
      if (result) setIsShared(result.is_shared);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  const handleShareClick = useCallback(() => {
    if (isShared) {
      doToggle();
    } else {
      setShowConfirm(true);
    }
  }, [isShared, doToggle]);

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    doToggle();
  }, [doToggle]);

  const handleCopy = useCallback(() => {
    const url = `${window.location.origin}/m/${runId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [runId]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleShareClick}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-serif font-medium transition-all border shadow-sm ${
            isShared
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'bg-background border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
          {isShared ? '已公开' : '分享'}
        </button>

        {isShared && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-serif font-medium text-muted-foreground hover:bg-muted transition-colors shadow-sm"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制链接'}
          </button>
        )}
      </div>

      {showConfirm && (
        <ShareConfirmDialog
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
