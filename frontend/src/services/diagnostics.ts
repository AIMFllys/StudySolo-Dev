/** Diagnostics service for system health checks and report generation. */

import { buildApiUrl, credentialsFetch } from './api-client';

export type ComponentCategory = 'database' | 'ai_model' | 'agent' | 'external_api' | 'internal_service';
export type ComponentStatus = 'healthy' | 'unhealthy';

export interface ComponentCheckResult {
  id: string;
  name: string;
  category: ComponentCategory;
  status: ComponentStatus;
  latency_ms: number;
  error: string | null;
  details: Record<string, unknown> | null;
}

export interface DiagnosticsSummary {
  total: number;
  healthy: number;
  unhealthy: number;
}

export interface DiagnosticsReports {
  markdown: string;
  text: string;
  json: string;
}

export interface DiagnosticsResponse {
  timestamp: string;
  overall_healthy: boolean;
  summary: DiagnosticsSummary;
  components: ComponentCheckResult[];
  reports: DiagnosticsReports;
}

export interface CategoryGroup {
  category: ComponentCategory;
  label: string;
  icon: string;
  total: number;
  healthy: number;
  unhealthy: number;
  components: ComponentCheckResult[];
}

/**
 * Run full system diagnostics.
 * Requires admin authentication.
 */
export async function runDiagnostics(): Promise<DiagnosticsResponse> {
  const response = await credentialsFetch(buildApiUrl('/api/admin/diagnostics/full'), {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Group components by category for UI display.
 */
export function groupComponentsByCategory(components: ComponentCheckResult[]): CategoryGroup[] {
  const categoryLabels: Record<ComponentCategory, string> = {
    database: '数据库',
    ai_model: 'AI 模型',
    agent: '子 Agents',
    external_api: '外部 API',
    internal_service: '内部服务',
  };

  const categoryIcons: Record<ComponentCategory, string> = {
    database: 'database',
    ai_model: 'neurology',
    agent: 'smart_toy',
    external_api: 'cloud',
    internal_service: 'settings',
  };

  const groups = new Map<ComponentCategory, CategoryGroup>();

  for (const component of components) {
    const existing = groups.get(component.category);
    if (existing) {
      existing.total++;
      if (component.status === 'healthy') {
        existing.healthy++;
      } else {
        existing.unhealthy++;
      }
      existing.components.push(component);
    } else {
      groups.set(component.category, {
        category: component.category,
        label: categoryLabels[component.category],
        icon: categoryIcons[component.category],
        total: 1,
        healthy: component.status === 'healthy' ? 1 : 0,
        unhealthy: component.status === 'unhealthy' ? 1 : 0,
        components: [component],
      });
    }
  }

  // Sort by predefined order
  const order: ComponentCategory[] = ['database', 'ai_model', 'agent', 'external_api', 'internal_service'];
  return order
    .filter((cat) => groups.has(cat))
    .map((cat) => groups.get(cat)!);
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download content as a file.
 */
export function downloadAsFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format latency for display.
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format timestamp for display.
 */
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get status color for UI.
 */
export function getStatusColor(status: ComponentStatus): string {
  return status === 'healthy' ? 'text-green-600' : 'text-red-600';
}

/**
 * Get status background color for UI.
 */
export function getStatusBgColor(status: ComponentStatus): string {
  return status === 'healthy' ? 'bg-green-50' : 'bg-red-50';
}

/**
 * Get status icon for UI.
 */
export function getStatusIcon(status: ComponentStatus): string {
  return status === 'healthy' ? 'check_circle' : 'error';
}
