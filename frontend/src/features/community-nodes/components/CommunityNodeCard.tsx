'use client';

import { useMemo, type DragEvent } from 'react';
import { Heart, PackageOpen, Settings2 } from 'lucide-react';

import { getCommunityCategoryLabel, getCommunityIcon } from '@/features/community-nodes/constants/catalog';
import type { CommunityNodeInsertPayload, CommunityNodePublic } from '@/types';

interface CommunityNodeCardProps {
  node: CommunityNodePublic;
  onToggleLike: (node: CommunityNodePublic) => void;
  onManage?: (nodeId: string) => void;
}

export function CommunityNodeCard({
  node,
  onToggleLike,
  onManage,
}: CommunityNodeCardProps) {
  const Icon = useMemo(() => getCommunityIcon(node.icon), [node.icon]);

  const payload: CommunityNodeInsertPayload = {
    id: node.id,
    name: node.name,
    icon: node.icon,
    input_hint: node.input_hint,
    output_format: node.output_format,
    model_preference: node.model_preference,
    description: node.description,
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/studysolo-node-type', 'community_node');
    event.dataTransfer.setData('application/studysolo-community-id', node.id);
    event.dataTransfer.setData('application/studysolo-community-meta', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="rounded-xl border border-border bg-background/80 p-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-background"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40">
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="truncate text-sm font-semibold text-foreground">{node.name}</h4>
              <p className="text-xs text-muted-foreground">by {node.author_name} · v{node.version}</p>
            </div>
            <button
              type="button"
              onClick={() => onToggleLike(node)}
              className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
                node.is_liked
                  ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-950/20 dark:text-rose-300'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Heart className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {node.description}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5">
              {getCommunityCategoryLabel(node.category)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {node.likes_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <PackageOpen className="h-3 w-3" />
              {node.install_count}
            </span>
            {node.knowledge_file_name ? <span>附知识文件</span> : null}
            {node.output_format === 'json' ? <span>JSON 输出</span> : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">拖拽到画布即可使用</p>
            {node.is_owner && onManage ? (
              <button
                type="button"
                onClick={() => onManage(node.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <Settings2 className="h-3.5 w-3.5" />
                管理
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
