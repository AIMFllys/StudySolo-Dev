'use client';

import { Heart, Star, GitFork, Pencil, X, Share } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { ApiError, toggleLike, toggleFavorite, forkWorkflow } from '@/services/workflow.service';
import type { WorkflowPublicView } from '@/types/workflow';
import { LoginPromptDialog } from './LoginPromptDialog';

const ReadOnlyCanvas = dynamic(
  () => import('@/features/workflow/components/canvas/ReadOnlyCanvas'),
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
  const [liking, setLiking] = useState(false);
  const [faving, setFaving] = useState(false);
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
    if (liking) return;
    setLiking(true);
    try {
      const res = await toggleLike(workflow.id);
      setLiked(res.toggled);
      setLikes(res.count);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        promptLogin();
      } else {
        toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试');
      }
    } finally {
      setLiking(false);
    }
  }

  async function handleFavorite() {
    if (faving) return;
    setFaving(true);
    try {
      const res = await toggleFavorite(workflow.id);
      setFaved(res.toggled);
      setFavs(res.count);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        promptLogin();
      } else {
        toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试');
      }
    } finally {
      setFaving(false);
    }
  }

  async function handleFork() {
    setForking(true);
    try {
      const forked = await forkWorkflow(workflow.id);
      toast.success('已 Fork 到我的工作空间');
      router.push(`/c/${forked.id}`);
    } catch (err) {
      setForking(false);
      if (err instanceof ApiError && err.status === 401) {
        promptLogin();
      } else {
        toast.error(err instanceof Error ? err.message : 'Fork 失败，请稍后重试');
      }
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
                disabled={liking}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider font-bold transition-colors disabled:opacity-60 ${
                  liked ? 'text-red-600 bg-red-50/50 hover:bg-red-50' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Heart className={`h-3 w-3 ${liked ? 'fill-current' : ''}`} />
                {likes}
              </button>
              <div className="w-px bg-border" />
              <button
                onClick={handleFavorite}
                disabled={faving}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider font-bold transition-colors disabled:opacity-60 ${
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

      {/* Share Floating Card — bottom-anchored, non-blocking */}
      {showShare && (
        <div
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 pointer-events-auto w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <div className="relative bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl px-5 py-4">
            <button
              onClick={() => setShowShare(false)}
              className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <h2 className="text-sm font-serif font-bold text-foreground flex items-center gap-2">
              <Share className="h-4 w-4" />
              分享此工作流
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1 font-serif leading-relaxed">
              任何人都可以通过此链接访问只读画布预览。
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-muted/60 border border-border px-3 py-1.5 rounded-lg text-[11px] font-mono text-foreground truncate select-all">
                {shareUrl || `/s/${workflow.id}`}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl || `${window.location.origin}/s/${workflow.id}`);
                  toast.success('链接已复制到剪贴板');
                }}
                className="bg-foreground text-background px-4 py-1.5 rounded-lg text-xs font-bold font-serif hover:opacity-90 transition-opacity shrink-0 shadow-sm"
              >
                复制
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
