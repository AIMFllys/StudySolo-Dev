import { useRouter } from 'next/navigation';
import type { UserListItem } from '@/types/admin';
import { EmptyState, formatDateTime } from '@/features/admin/shared';
import { StatusBadgeWithDot, TierBadge } from './user-shared';

interface UserQuickPanelProps {
  user: UserListItem | null;
}

export function UserQuickPanel({ user }: UserQuickPanelProps) {
  const router = useRouter();

  if (!user) {
    return <EmptyState title="请选择用户" description="点击左侧表格中的用户后，可在此处查看快速信息。" />;
  }

  return (
    <div className="rounded-md border border-[#2e2e2e] bg-[#171717] p-6">
      <div className="flex items-center gap-2 border-b border-[#2e2e2e] pb-4">
        <span className="material-symbols-outlined text-[20px] text-[#666]">person</span>
        <h2 className="text-[14px] font-semibold text-[#ededed]">快速预览</h2>
      </div>
      
      <div className="mt-5 space-y-4">
        <div>
          <p className="text-[11px] font-medium tracking-wider text-[#666] uppercase">用户 ID</p>
          <p className="mt-1 font-mono text-[13px] font-medium text-[#8f8f8f]">{user.id}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wider text-[#666] uppercase">邮箱</p>
          <p className="mt-1 text-[13px] font-medium text-[#8f8f8f]">{user.email}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wider text-[#666] uppercase">会员等级</p>
          <div className="mt-1.5">
            <TierBadge tier={user.tier} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wider text-[#666] uppercase">账号状态</p>
          <div className="mt-1.5">
            <StatusBadgeWithDot isActive={user.is_active} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wider text-[#666] uppercase">注册时间</p>
          <p className="mt-1 text-[13px] font-medium text-[#8f8f8f]">{formatDateTime(user.created_at)}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wider text-[#666] uppercase">最后登录</p>
          <p className="mt-1 text-[13px] font-medium text-[#8f8f8f]">{formatDateTime(user.last_login)}</p>
        </div>
      </div>

      <button
        onClick={() => router.push(`/admin-analysis/users/${user.id}`)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-[#232323] px-4 py-2.5 text-[13px] font-medium text-[#3ecf8e] transition-all hover:bg-[#1f1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e]"
      >
        查看完整详情
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </button>
    </div>
  );
}
