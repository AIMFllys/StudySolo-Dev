'use client';

import { Heart, Star, GitFork, Pencil, LogIn, X, Share } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { toggleLike, toggleFavorite, forkWorkflow } from '@/services/workflow.service';
import type { WorkflowPublicView } from '@/types/workflow';

const ReadOnlyCanvas = dynamic(
  () => import('@/components/workflow/ReadOnlyCanvas'),
  { ssr: false, loading: () => <CanvasPlaceholder /> }
);

function CanvasPlaceholder() {
  return (
    <div className="rounded-lg border border-border bg-muted/30 min-h-[500px] flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <div className="h-8 w-8 mx-auto mb-2 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
        <p className="text-xs">加载画布预览...</p>
      </div>
    </div>
  );
}

/** Lightweight login-redirect confirmation dialog */
function LoginPromptDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-background border border-border rounded-xl shadow-xl px-6 py-5 max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in duration-200">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <LogIn className="h-5 w-5 text-foreground" />
          </div>
          <h3 className="text-sm font-serif font-semibold text-foreground">
            需要登录
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            此操作需要登录后才能使用。<br />
            是否跳转至登录页面？
          </p>
          <div className="flex items-center gap-2 mt-1 w-full">
            <button
              onClick={onCancel}
              className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              暂不登录
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-md bg-foreground text-background px-3 py-2 text-xs font-medium hover:opacity-90 transition-opacity"
            >
              前往登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props {
  workflow: WorkflowPublicView;
}

export default function PublicWorkflowView({ workflow }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [likes, setLikes] = useState(workflow.likes_count);
  const [favs, setFavs] = useState(workflow.favorites_count);
  const [liked, setLiked] = useState(workflow.is_liked ?? false);
  const [faved, setFaved] = useState(workflow.is_favorited ?? false);
  const [forking, setForking] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showShare, setShowShare] = useState(true);

  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  const promptLogin = useCallback(() => {
    toast.error('请先登录后再操作');
    setShowLoginPrompt(true);
  }, []);

  const handleLoginRedirect = useCallback(() => {
    setShowLoginPrompt(false);
    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [router, pathname]);

  async function handleLike() {
    try {
      const res = await toggleLike(workflow.id);
      setLiked(res.toggled);
      setLikes(res.count);
    } catch {
      promptLogin();
    }
  }

  async function handleFavorite() {
    try {
      const res = await toggleFavorite(workflow.id);
      setFaved(res.toggled);
      setFavs(res.count);
    } catch {
      promptLogin();
    }
  }

  async function handleFork() {
    setForking(true);
    try {
      const forked = await forkWorkflow(workflow.id);
      toast.success('已 Fork 到我的工作空间');
      router.push(`/c/${forked.id}`);
    } catch {
      setForking(false);
      promptLogin();
    }
  }

  return (
    <div className="relative w-full h-full flex flex-col pointer-events-none">
      {/* Background Fullscreen Canvas */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <ReadOnlyCanvas
          nodes={workflow.nodes_json}
          edges={workflow.edges_json}
          className="h-full w-full"
        />
      </div>

      {/* Floating UI Container */}
      <div className="absolute inset-x-0 top-16 z-10 px-6 pt-4 pointer-events-none flex justify-between items-start">
        
        {/* Left Workflow Info Panel */}
        <div className="pointer-events-auto max-w-sm bg-background/95 backdrop-blur-md border border-border shadow-md p-5 rounded-2xl">
          <h1 className="text-xl font-serif font-bold text-foreground truncate">
            {workflow.name}
          </h1>
          {workflow.description && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {workflow.description}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-dashed border-border pt-3 text-[10px] text-muted-foreground font-serif">
            <span>By {workflow.owner_name || 'Anonymous'}</span>
            <div className="flex gap-1.5">
              <span>Nodes: {workflow.nodes_json.length}</span>
              <span>Edges: {workflow.edges_json.length}</span>
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="pointer-events-auto flex flex-col gap-2.5">
          {workflow.is_owner && (
            <button
              onClick={() => router.push(`/c/${workflow.id}`)}
              className="flex items-center gap-2 bg-background border border-border px-3.5 py-2 text-xs font-serif font-medium rounded-lg hover:bg-muted transition-colors shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              进入编辑
            </button>
          )}

          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-2 bg-background border border-border px-3.5 py-2 text-xs font-serif font-medium rounded-lg hover:bg-muted transition-colors shadow-sm"
          >
            <Share className="h-3.5 w-3.5" />
            分享
          </button>

          <div className="flex bg-background border border-border rounded-lg overflow-hidden shadow-sm mt-1">
             <button
                onClick={handleLike}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider font-bold transition-colors ${
                  liked ? 'text-red-600 bg-red-50/50 hover:bg-red-50' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Heart className={`h-3 w-3 ${liked ? 'fill-current' : ''}`} />
                {likes}
              </button>
              <div className="w-px bg-border" />
              <button
                onClick={handleFavorite}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider font-bold transition-colors ${
                  faved ? 'text-amber-600 bg-amber-50/50 hover:bg-amber-50' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Star className={`h-3 w-3 ${faved ? 'fill-current' : ''}`} />
                {favs}
              </button>
          </div>

          <button
            onClick={handleFork}
            disabled={forking}
            className="mt-1 flex items-center justify-center gap-2 bg-foreground text-background border border-foreground/90 px-3 py-2.5 text-xs font-serif font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md"
          >
            <GitFork className="h-3.5 w-3.5" />
            {forking ? 'Forking...' : '复制到我的空间'}
          </button>
        </div>
      </div>

      {/* Share Modal Dialog */}
      {showShare && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setShowShare(false)} />
          <div className="relative bg-[#FDFBF7] border border-black/80 w-full max-w-md p-6 rounded-xl shadow-xl animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowShare(false)}
              className="absolute top-4 right-4 text-black/50 hover:text-black transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-serif font-bold text-black flex items-center gap-2">
              <Share className="h-5 w-5" />
              分享此工作流
            </h2>
            <p className="text-xs text-black/60 mt-2 font-serif leading-relaxed">
              任何人都可以通过此链接访问只读版本的画布。将其发送给协作者或发布在社区中。
            </p>
            <div className="mt-5 flex items-center gap-2">
              <div className="flex-1 bg-white border border-black/20 px-3 py-2 rounded text-xs font-mono text-black truncate select-all">
                {shareUrl || `/s/${workflow.id}`}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl || `${window.location.origin}/s/${workflow.id}`);
                  toast.success('链接已复制到剪贴板');
                  setShowShare(false);
                }}
                className="bg-black text-white px-4 py-2 rounded text-xs font-bold font-serif hover:bg-black/80 transition-colors shrink-0 shadow-sm"
              >
                复制链接
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login prompt dialog */}
      {showLoginPrompt && (
        <LoginPromptDialog
          onConfirm={handleLoginRedirect}
          onCancel={() => setShowLoginPrompt(false)}
        />
      )}
    </div>
  );
}
