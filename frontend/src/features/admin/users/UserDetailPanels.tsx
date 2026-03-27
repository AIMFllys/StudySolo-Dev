import type { UserDetailResponse, TierValue } from '@/types/admin';
import { AdminSelect, KpiCard, formatDateTime } from '@/features/admin/shared';
import { InfoRow, StatusBadgeWithDot, TierBadge, TIER_OPTIONS } from './user-shared';

interface UserDetailPanelsProps {
  data: UserDetailResponse;
  selectedTier: TierValue;
  statusLoading: boolean;
  roleLoading: boolean;
  onSelectTier: (tier: TierValue) => void;
  onToggleStatus: () => void;
  onApplyTier: () => void;
}

export function UserDetailPanels({
  data,
  selectedTier,
  statusLoading,
  roleLoading,
  onSelectTier,
  onToggleStatus,
  onApplyTier,
}: UserDetailPanelsProps) {
  const { user, subscription, usage_stats: usage } = data;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="总执行次数" value={usage.total_runs.toLocaleString()} />
        <KpiCard label="总 Token 消耗" value={usage.total_tokens.toLocaleString()} />
        <KpiCard label="近 30 天执行" value={usage.last_30_days_runs.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#f4f4f0] border border-[#c4c6cf] rounded-none p-5 shadow-sm">
          <h2 className="text-[#002045] text-sm font-semibold tracking-wider mb-4">用户信息</h2>
          <InfoRow label="邮箱">{user.email}</InfoRow>
          <InfoRow label="会员等级">
            <TierBadge tier={user.tier} />
          </InfoRow>
          <InfoRow label="状态">
            <StatusBadgeWithDot isActive={user.is_active} />
          </InfoRow>
          <InfoRow label="注册时间">{formatDateTime(user.created_at)}</InfoRow>
          <InfoRow label="最后登录">{formatDateTime(user.last_login)}</InfoRow>
        </div>

        <div className="bg-[#f4f4f0] border border-[#c4c6cf] rounded-none p-5 shadow-sm">
          <h2 className="text-[#002045] text-sm font-semibold tracking-wider mb-4">订阅信息</h2>
          {subscription ? (
            <>
              <InfoRow label="订阅记录 ID">{subscription.id}</InfoRow>
              <InfoRow label="会员等级">{subscription.tier}</InfoRow>
              <InfoRow label="方案类型">{subscription.plan_type ?? '未设置'}</InfoRow>
              <InfoRow label="订阅状态">{subscription.status}</InfoRow>
              <InfoRow label="创建时间">{formatDateTime(subscription.created_at)}</InfoRow>
              <InfoRow label="到期时间">{formatDateTime(subscription.expires_at)}</InfoRow>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-[#74777f]">
              <p className="text-sm">暂无订阅记录</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#f4f4f0] border border-[#c4c6cf] rounded-none p-5 shadow-sm">
          <h2 className="text-[#002045] text-sm font-semibold tracking-wider mb-4">账号状态</h2>
          <p className="text-[#74777f] text-sm mb-4">
            当前状态：<StatusBadgeWithDot isActive={user.is_active} />
          </p>
          <button
            onClick={onToggleStatus}
            disabled={statusLoading}
            className={`w-full py-2.5 rounded-none text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
              user.is_active
                ? 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {statusLoading ? '处理中...' : user.is_active ? '停用用户' : '启用用户'}
          </button>
        </div>

        <div className="bg-[#f4f4f0] border border-[#c4c6cf] rounded-none p-5 shadow-sm">
          <h2 className="text-[#002045] text-sm font-semibold tracking-wider mb-4">调整会员等级</h2>
          <p className="text-[#74777f] text-sm mb-4">
            当前等级：<TierBadge tier={user.tier} />
          </p>
          <div className="flex gap-3">
            <AdminSelect
              value={selectedTier}
              options={[...TIER_OPTIONS]}
              onChange={(event) => onSelectTier(event.target.value as TierValue)}
              className="flex-1"
            />
            <button
              onClick={onApplyTier}
              disabled={roleLoading || selectedTier === user.tier}
              className="px-5 py-2.5 rounded-none bg-[#002045] border border-[#002045] text-white hover:opacity-90 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {roleLoading ? '应用中...' : '应用变更'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
