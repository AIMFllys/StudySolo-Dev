export type UsageSourceType = 'assistant' | 'workflow';
export type UsageSourceFilter = UsageSourceType | 'all';
export type UsageRange = '24h' | '7d' | '30d' | 'all';
export type AdminUsageRange = UsageRange;
export type UsageWindow = '5m' | '60m';

export interface UsageMetrics {
  logical_request_count: number;
  provider_call_count: number;
  successful_provider_call_count: number;
  total_tokens: number;
  total_cost_cny: number;
  error_rate: number;
  fallback_rate: number;
  p95_latency_ms: number | null;
}

export interface UsageOverviewResponse {
  range: string;
  assistant: UsageMetrics;
  workflow: UsageMetrics;
  all: UsageMetrics;
}

export interface UsageLivePoint {
  ts: string;
  logical_requests: number;
  provider_calls: number;
  successful_provider_calls: number;
  total_tokens: number;
  total_cost_cny: number;
  error_count: number;
  fallback_count: number;
}

export interface UsageLiveResponse {
  window: string;
  points: UsageLivePoint[];
  summary: UsageMetrics;
}

export interface UsageTimeseriesPoint {
  ts: string;
  assistant_calls: number;
  workflow_calls: number;
  assistant_tokens: number;
  workflow_tokens: number;
  assistant_cost_cny: number;
  workflow_cost_cny: number;
}

export interface UsageTimeseriesResponse {
  range: string;
  source: UsageSourceFilter;
  points: UsageTimeseriesPoint[];
}

export interface ModelBreakdownItem {
  sku_id: string | null;
  family_id: string | null;
  provider: string;
  vendor: string;
  model: string;
  billing_channel: string;
  task_family: string | null;
  provider_call_count: number;
  successful_provider_call_count: number;
  total_tokens: number;
  total_cost_cny: number;
  success_rate: number;
}

export interface ModelBreakdownResponse {
  range: string;
  source: UsageSourceFilter;
  items: ModelBreakdownItem[];
}

export interface RecentCallItem {
  id: string;
  request_id: string;
  source_type: UsageSourceType;
  source_subtype: string;
  sku_id: string | null;
  family_id: string | null;
  provider: string;
  vendor: string;
  model: string;
  billing_channel: string;
  node_id: string | null;
  status: string;
  is_fallback: boolean;
  latency_ms: number | null;
  total_tokens: number;
  cost_amount_cny: number;
  started_at: string;
}

export interface RecentCallsResponse {
  calls: RecentCallItem[];
}

export interface CostSplitItem {
  source_type: UsageSourceType;
  provider_call_count: number;
  total_tokens: number;
  total_cost_cny: number;
}

export interface CostSplitResponse {
  range: string;
  items: CostSplitItem[];
}
