import type { PaginatedUserList, UserListItem } from '@/types/admin';
import {
  EmptyState,
  Pagination,
  TableSkeletonRows,
  formatDateTime,
  maskEmail,
} from '@/features/admin/shared';
import { StatusBadgeWithDot, TierBadge } from './user-shared';

interface UsersTableProps {
  data: PaginatedUserList | null;
  loading: boolean;
  page: number;
  selectedUserId: string | null;
  onSelectUser: (user: UserListItem) => void;
  onPageChange: (page: number) => void;
}

export function UsersTable({
  data,
  loading,
  page,
  selectedUserId,
  onSelectUser,
  onPageChange,
}: UsersTableProps) {
  if (!loading && (!data || data.users.length === 0)) {
    return <EmptyState title="暂无用户数据" description="当前筛选条件下没有用户记录。" />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#2e2e2e] bg-[#171717]">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#2e2e2e] bg-[#171717]">
              {['邮箱', '会员等级', '状态', '注册时间', '最后登录'].map((header) => (
                <th key={header} className="px-6 py-3.5 text-[12px] font-medium tracking-wider text-[#666] uppercase">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e2e2e]">
            {loading ? (
              <TableSkeletonRows rows={8} cols={5} />
            ) : (
              data?.users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => onSelectUser(user)}
                  className={`cursor-pointer transition-colors group ${
                    selectedUserId === user.id ? 'bg-[#232323]' : 'hover:bg-[#1f1f1f]'
                  }`}
                >
                  <td className="px-6 py-4 text-[13px] font-medium text-[#ededed]">{maskEmail(user.email)}</td>
                  <td className="px-6 py-4">
                    <TierBadge tier={user.tier} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadgeWithDot isActive={user.is_active} />
                  </td>
                  <td className="px-6 py-4 text-[13px] text-[#8f8f8f]">{formatDateTime(user.created_at)}</td>
                  <td className="px-6 py-4 text-[13px] text-[#8f8f8f]">{formatDateTime(user.last_login)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={data?.total_pages ?? 1}
        total={data?.total}
        loading={loading}
        onPageChange={onPageChange}
      />
    </div>
  );
}
