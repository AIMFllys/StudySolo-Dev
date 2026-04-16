'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, X, Mail, Trash2, Copy, Check, Link } from 'lucide-react';
import { toast } from 'sonner';
import {
  inviteCollaborator,
  fetchCollaborators,
  removeCollaborator,
  type Collaborator,
} from '@/services/collaboration.service';

interface Props {
  workflowId: string;
  isPublic: boolean;
}

export default function CollaborationPopover({ workflowId, isPublic }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadCollabs = useCallback(async () => {
    const data = await fetchCollaborators(workflowId);
    setCollabs(data);
  }, [workflowId]);

  useEffect(() => {
    if (open) loadCollabs();
  }, [open, loadCollabs]);

  async function handleInvite() {
    if (!email.trim()) return;
    setInviting(true);
    try {
      await inviteCollaborator(workflowId, email.trim(), role);
      toast.success(`已邀请 ${email.trim()}`);
      setEmail('');
      await loadCollabs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '邀请失败');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId: string, name: string | null) {
    try {
      await removeCollaborator(workflowId, userId);
      toast.success(`已移除 ${name || '协作者'}`);
      setCollabs((prev) => prev.filter((c) => c.user_id !== userId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '移除失败');
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/s/${workflowId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('已复制链接');
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="邀请协作"
      >
        <Users className="h-3 w-3" />
        <span className="hidden sm:inline">协作</span>
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

      <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-background border border-border rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
          <h3 className="text-xs font-serif font-semibold">邀请协作者</h3>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Mail className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入邮箱邀请..."
                className="w-full rounded-md border border-border bg-transparent pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-foreground/20"
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
              className="rounded-md bg-foreground text-background px-2.5 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
            >
              {inviting ? '...' : '邀请'}
            </button>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>角色：</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="role"
                checked={role === 'editor'}
                onChange={() => setRole('editor')}
                className="h-3 w-3"
              />
              可编辑
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="role"
                checked={role === 'viewer'}
                onChange={() => setRole('viewer')}
                className="h-3 w-3"
              />
              仅查看
            </label>
          </div>

          {collabs.length > 0 && (
            <div className="border-t border-dashed border-border pt-2">
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">
                已邀请的协作者
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {collabs.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs py-1 px-1.5 rounded-md hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium shrink-0">
                        {(c.nickname || c.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="truncate block text-xs">
                          {c.nickname || c.email}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                        {c.role === 'editor' ? '编辑' : '查看'}
                      </span>
                      <span
                        className={`text-[9px] ${
                          c.status === 'accepted'
                            ? 'text-green-600'
                            : c.status === 'pending'
                              ? 'text-amber-600'
                              : 'text-red-500'
                        }`}
                      >
                        {c.status === 'accepted' ? '✅' : c.status === 'pending' ? '⏳' : '❌'}
                      </span>
                      <button
                        onClick={() => handleRemove(c.user_id, c.nickname)}
                        className="p-0.5 rounded text-muted-foreground hover:text-red-500 transition-colors"
                        title="移除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-dashed border-border pt-2">
            <p className="text-[10px] text-muted-foreground mb-1.5 font-medium flex items-center gap-1">
              <Link className="h-3 w-3" />
              公开分享链接
            </p>
            {isPublic ? (
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-[9px] bg-muted px-2 py-1 rounded truncate">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/s/{workflowId}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
                  title="复制链接"
                >
                  {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            ) : (
              <p className="text-[9px] text-muted-foreground italic">
                工作流未公开，设为公开后可生成分享链接
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
