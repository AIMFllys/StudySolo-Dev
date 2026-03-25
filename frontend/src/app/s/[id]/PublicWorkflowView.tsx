'use client';

import { Heart, Star, GitFork, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toggleLike, toggleFavorite, forkWorkflow } from '@/services/workflow.service';
import type { WorkflowPublicView } from '@/types/workflow';

interface Props {
  workflow: WorkflowPublicView;
}

export default function PublicWorkflowView({ workflow }: Props) {
  const router = useRouter();
  const [likes, setLikes] = useState(workflow.likes_count);
  const [favs, setFavs] = useState(workflow.favorites_count);
  const [liked, setLiked] = useState(workflow.is_liked ?? false);
  const [faved, setFaved] = useState(workflow.is_favorited ?? false);
  const [forking, setForking] = useState(false);

  async function handleLike() {
    try {
      const res = await toggleLike(workflow.id);
      setLiked(res.toggled);
      setLikes(res.count);
    } catch {
      /* user not logged in — silently fail or redirect */
    }
  }

  async function handleFavorite() {
    try {
      const res = await toggleFavorite(workflow.id);
      setFaved(res.toggled);
      setFavs(res.count);
    } catch {
      /* user not logged in */
    }
  }

  async function handleFork() {
    setForking(true);
    try {
      const forked = await forkWorkflow(workflow.id);
      router.push(`/c/${forked.id}`);
    } catch {
      setForking(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-serif font-bold text-foreground truncate">
              {workflow.name}
            </h1>
            {workflow.description && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {workflow.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span>by {workflow.owner_name || '未知用户'}</span>
              {workflow.is_official && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 font-medium">
                  官方
                </span>
              )}
              {workflow.is_featured && (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800 font-medium">
                  精选
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs border transition-colors ${
                liked
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} />
              <span>{likes}</span>
            </button>

            <button
              onClick={handleFavorite}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs border transition-colors ${
                faved
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${faved ? 'fill-current' : ''}`} />
              <span>{favs}</span>
            </button>

            <button
              onClick={handleFork}
              disabled={forking}
              className="flex items-center gap-1 rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <GitFork className="h-3.5 w-3.5" />
              <span>{forking ? 'Fork 中...' : 'Fork 到我的空间'}</span>
            </button>
          </div>
        </div>

        {/* Tags */}
        {workflow.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {workflow.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Canvas preview area */}
      <div className="rounded-lg border border-border bg-muted/30 p-8 min-h-[400px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ExternalLink className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">工作流预览</p>
          <p className="text-xs mt-1">
            共 {workflow.nodes_json.length} 个节点，{workflow.edges_json.length} 条连线
          </p>
        </div>
      </div>
    </div>
  );
}
