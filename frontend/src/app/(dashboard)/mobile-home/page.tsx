'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Lightbulb,
  BookOpen,
  LayoutDashboard,
  Wallet,
  Puzzle,
  User,
  Plus,
  Search,
  ChevronRight,
  Sparkles,
  Clock,
  Heart,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkflowMeta } from '@/types/workflow';
import { useCreateWorkflowAction } from '@/features/workflow/hooks/use-create-workflow-action';

interface QuickAccessItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
  description: string;
}

const quickAccessItems: QuickAccessItem[] = [
  {
    id: 'workflows',
    label: '工作流',
    icon: FileText,
    href: '/workspace',
    color: 'bg-blue-500/10 text-blue-600',
    description: '查看全部',
  },
  {
    id: 'examples',
    label: '示例',
    icon: Lightbulb,
    href: '/workspace?tab=examples',
    color: 'bg-amber-500/10 text-amber-600',
    description: '快速开始',
  },
  {
    id: 'knowledge',
    label: '知识库',
    icon: BookOpen,
    href: '/settings?tab=knowledge',
    color: 'bg-emerald-500/10 text-emerald-600',
    description: '管理知识',
  },
  {
    id: 'dashboard',
    label: '仪表盘',
    icon: LayoutDashboard,
    href: '/workspace',
    color: 'bg-purple-500/10 text-purple-600',
    description: '数据概览',
  },
  {
    id: 'wallet',
    label: '钱包',
    icon: Wallet,
    href: '/settings?tab=wallet',
    color: 'bg-rose-500/10 text-rose-600',
    description: '余额充值',
  },
  {
    id: 'extensions',
    label: '插件',
    icon: Puzzle,
    href: '/settings?tab=extensions',
    color: 'bg-cyan-500/10 text-cyan-600',
    description: '扩展功能',
  },
];

interface WorkflowWithMeta extends WorkflowMeta {
  lastModified?: string;
  isFavorite?: boolean;
}

export default function MobileHomePage() {
  const router = useRouter();
  const { createWorkflow, creating } = useCreateWorkflowAction();
  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWorkflows: 0,
    runsThisWeek: 0,
    favoriteCount: 0,
  });

  useEffect(() => {
    // Fetch recent workflows
    fetch('/api/workflow/list')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRecentWorkflows(data.slice(0, 5));
          setStats((prev) => ({
            ...prev,
            totalWorkflows: data.length,
            favoriteCount: data.filter((w: WorkflowMeta) => w.is_favorite).length,
          }));
        }
      })
      .catch(() => {
        // Silent fail
      })
      .finally(() => setLoading(false));

    // Fetch run stats
    fetch('/api/workflow/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data?.runsThisWeek !== undefined) {
          setStats((prev) => ({ ...prev, runsThisWeek: data.runsThisWeek }));
        }
      })
      .catch(() => {
        // Silent fail
      });
  }, []);

  const handleCreateWorkflow = async () => {
    const newWorkflow = await createWorkflow();
    if (newWorkflow?.id) {
      router.push(`/c/${newWorkflow.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-serif font-bold text-lg">StudySolo</span>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="搜索"
          >
            <Search className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-6">
        {/* Welcome Section */}
        <section className="space-y-3">
          <h1 className="text-2xl font-bold">
            欢迎回来<span className="text-primary">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            继续你的工作流创作，或从示例开始探索。
          </p>
        </section>

        {/* Quick Create */}
        <button
          onClick={handleCreateWorkflow}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {creating ? (
            <>
              <div className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              创建中...
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" />
              新建工作流
            </>
          )}
        </button>

        {/* Quick Access Grid */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            快捷入口
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {quickAccessItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-medium block">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground">{item.description}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Stats Overview */}
        <section className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">工作流</span>
            </div>
            <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.totalWorkflows}</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">本周运行</span>
            </div>
            <span className="text-xl font-bold text-purple-700 dark:text-purple-300">{stats.runsThisWeek}</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900">
            <div className="flex items-center gap-1.5 mb-1">
              <Heart className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">收藏</span>
            </div>
            <span className="text-xl font-bold text-rose-700 dark:text-rose-300">{stats.favoriteCount}</span>
          </div>
        </section>

        {/* Recent Workflows */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              最近工作流
            </h2>
            <Link
              href="/workspace"
              className="text-xs text-primary flex items-center gap-0.5"
            >
              查看全部
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
            </div>
          ) : recentWorkflows.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl bg-muted/50">
              <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">暂无工作流</p>
              <p className="text-xs text-muted-foreground/70 mt-1">点击上方按钮新建一个</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentWorkflows.map((workflow) => (
                <Link
                  key={workflow.id}
                  href={`/c/${workflow.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{workflow.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{workflow.lastModified || '最近'}</span>
                      {workflow.is_favorite && (
                        <Heart className="h-3 w-3 text-rose-400 fill-rose-400" />
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Tips Card */}
        <section className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-100 dark:border-amber-900">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100">快速提示</h3>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                长按工作流卡片可快速收藏或分享。在画布页面双指捏合可缩放视图。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
