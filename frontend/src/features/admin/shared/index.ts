// ============================================================
// Admin shared module — barrel re-export
// ============================================================

// Utils
export {
  formatDate,
  formatDateTime,
  formatDuration,
  truncateId,
  maskEmail,
  buildPaginationParams,
  formatNumber,
} from './utils';

// Badge constants & resolver
export {
  resolveBadgeStyle,
  TIER_BADGE,
  NOTICE_TYPE_BADGE,
  NOTICE_STATUS_BADGE,
} from './badges';
export type { BadgeStyle, BadgeMap } from './badges';

// Shared UI components
export {
  AdminSelect,
  PageHeader,
  KpiCard,
  TableSkeletonRows,
  Pagination,
  StatusBadge,
  ToastStack,
  EmptyState,
} from './components';
export type { AdminSelectOption } from './components';

// Confirm dialog
export { ConfirmDialog } from './ConfirmDialog';

// Layout components
export { AdminSidebar } from './AdminSidebar';
export { AdminTopbar } from './AdminTopbar';
