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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-md border border-[#2e2e2e] bg-[#171717] p-6">
          <div className="flex items-center gap-2 mb-6 border-b border-[#2e2e2e] pb-4">
            <span className="material-symbols-outlined text-[20px] text-[#666]">person</span>
            <h2 className="text-[14px] font-semibold text-[#ededed]">用户信息</h2>
          </div>
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

        <div className="rounded-md border border-[#2e2e2e] bg-[#171717] p-6">
          <div className="flex items-center gap-2 mb-6 border-b border-[#2e2e2e] pb-4">
            <span className="material-symbols-outlined text-[20px] text-[#666]">card_membership</span>
            <h2 className="text-[14px] font-semibold text-[#ededed]">订阅信息</h2>
          </div>
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
            <div className="flex flex-col items-center justify-center py-8 text-[#8f8f8f]">
              <span className="material-symbols-outlined text-4xl mb-2 text-[#555]">credit_card_off</span>
              <p className="text-[13px]">暂无订阅记录</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-md border border-[#2e2e2e] bg-[#171717] p-6">
          <div className="flex items-center gap-2 mb-6 border-b border-[#2e2e2e] pb-4">
            <span className="material-symbols-outlined text-[20px] text-[#666]">gpp_good</span>
            <h2 className="text-[14px] font-semibold text-[#ededed]">账号状态</h2>
          </div>
          <p className="flex items-center gap-2 text-[13px] text-[#8f8f8f] mb-6">
            当前状态：<StatusBadgeWithDot isActive={user.is_active} />
          </p>
          <button
            onClick={onToggleStatus}
            disabled={statusLoading}
            className={`w-full py-2.5 rounded-md text-[13px] font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              user.is_active
                ? 'bg-red-950/30 text-red-400 border border-red-800/40 hover:bg-red-950/50'
                : 'bg-emerald-950/30 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-950/50'
            }`}
          >
            {statusLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                处理中...
              </span>
            ) : user.is_active ? (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">block</span>
                停用用户
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                启用用户
              </span>
            )}
          </button>
        </div>

        <div className="rounded-md border border-[#2e2e2e] bg-[#171717] p-6">
          <div className="flex items-center gap-2 mb-6 border-b border-[#2e2e2e] pb-4">
            <span className="material-symbols-outlined text-[20px] text-[#666]">admin_panel_settings</span>
            <h2 className="text-[14px] font-semibold text-[#ededed]">调整会员等级</h2>
          </div>
          <p className="flex items-center gap-2 text-[13px] text-[#8f8f8f] mb-6">
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
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-[#3ecf8e] text-[#171717] hover:bg-[#2db87a] text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e] min-w-[120px]"
            >
              {roleLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  应用中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  应用变更
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
