'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CommunityNodeCard } from '@/features/community-nodes/components/CommunityNodeCard';
import { PublishNodeDialog } from '@/features/community-nodes/components/PublishNodeDialog';
import { COMMUNITY_NODE_CATEGORIES } from '@/features/community-nodes/constants/catalog';
import {
  likeCommunityNode,
  listCommunityNodes,
  unlikeCommunityNode,
} from '@/services/community-nodes.service';
import type { CommunityNodePublic } from '@/types';

export function CommunityNodeList() {
  const router = useRouter();
  const [items, setItems] = useState<CommunityNodePublic[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'likes' | 'newest'>('likes');
  const [category, setCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [openPublish, setOpenPublish] = useState(false);

  const categoryOptions = useMemo(
    () => [{ id: '', label: '全部' }, ...COMMUNITY_NODE_CATEGORIES],
    [],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
      }
    });
    void listCommunityNodes({
      page,
      perPage: 10,
      sort,
      category: category as '' | typeof COMMUNITY_NODE_CATEGORIES[number]['id'],
      search: search.trim(),
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setItems(result.items);
        setPages(result.pages);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : '加载共享节点失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [category, page, search, sort]);

  const handleToggleLike = async (node: CommunityNodePublic) => {
    try {
      const count = node.is_liked
        ? await unlikeCommunityNode(node.id)
        : await likeCommunityNode(node.id);
      setItems((current) =>
        current.map((item) =>
          item.id === node.id
            ? {
                ...item,
                is_liked: !item.is_liked,
                likes_count: count,
              }
            : item,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '点赞失败');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="space-y-3 border-b border-border px-2 py-2">
        <input
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
          placeholder="搜索共享节点..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[11px] outline-none focus:border-primary/40"
        />

        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(event) => {
              setPage(1);
              setSort(event.target.value as 'likes' | 'newest');
            }}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[11px] outline-none"
          >
            <option value="likes">最多点赞</option>
            <option value="newest">最新发布</option>
          </select>
          <select
            value={category}
            onChange={(event) => {
              setPage(1);
              setCategory(event.target.value);
            }}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[11px] outline-none"
          >
            {categoryOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
        {loading ? (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">加载共享节点中...</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">没有匹配的共享节点</p>
        ) : (
          items.map((node) => (
            <CommunityNodeCard
              key={node.id}
              node={node}
              onToggleLike={handleToggleLike}
              onManage={(nodeId) => router.push(`/workspace/community-nodes/${nodeId}`)}
            />
          ))
        )}
      </div>

      <div className="space-y-3 border-t border-border px-2 py-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
          >
            上一页
          </button>
          <span>
            第 {page} / {pages} 页
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((current) => Math.min(pages, current + 1))}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
          >
            下一页
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpenPublish(true)}
          className="w-full rounded-lg border border-primary/30 bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          发布我的节点
        </button>
      </div>

      <PublishNodeDialog
        open={openPublish}
        onClose={() => setOpenPublish(false)}
        onPublished={(node) => {
          setOpenPublish(false);
          setItems((current) => [{ ...node, is_liked: false }, ...current]);
        }}
      />
    </div>
  );
}
