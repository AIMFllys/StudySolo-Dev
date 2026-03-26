import { describe, expect, it } from 'vitest';
import { groupWorkflowsForDisplay } from '@/features/workflow/utils/group-workflows';
import type { WorkflowMeta } from '@/types/workflow';

function buildWorkflow(overrides: Partial<WorkflowMeta>): WorkflowMeta {
  return {
    id: overrides.id ?? 'wf-1',
    name: overrides.name ?? '测试工作流',
    description: overrides.description ?? null,
    status: overrides.status ?? 'draft',
    tags: overrides.tags ?? [],
    is_public: overrides.is_public ?? false,
    is_featured: overrides.is_featured ?? false,
    is_official: overrides.is_official ?? false,
    likes_count: overrides.likes_count ?? 0,
    favorites_count: overrides.favorites_count ?? 0,
    owner_name: overrides.owner_name ?? '测试用户',
    is_liked: overrides.is_liked ?? false,
    is_favorited: overrides.is_favorited ?? false,
    created_at: overrides.created_at ?? '2026-03-26T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-03-26T00:00:00.000Z',
  };
}

describe('workflow display grouping', () => {
  it('shows a workflow in both favorites and public when both flags are true', () => {
    const workflow = buildWorkflow({
      id: 'wf-both',
      is_favorited: true,
      is_public: true,
    });

    const grouped = groupWorkflowsForDisplay([workflow]);

    expect(grouped.favorites.map((item) => item.id)).toEqual(['wf-both']);
    expect(grouped.published.map((item) => item.id)).toEqual(['wf-both']);
    expect(grouped.uncategorized).toEqual([]);
  });

  it('keeps uncategorized limited to workflows that are neither favorited nor public', () => {
    const grouped = groupWorkflowsForDisplay([
      buildWorkflow({ id: 'wf-favorite', is_favorited: true }),
      buildWorkflow({ id: 'wf-public', is_public: true }),
      buildWorkflow({ id: 'wf-both', is_favorited: true, is_public: true }),
      buildWorkflow({ id: 'wf-plain' }),
    ]);

    expect(grouped.favorites.map((item) => item.id)).toEqual([
      'wf-favorite',
      'wf-both',
    ]);
    expect(grouped.published.map((item) => item.id)).toEqual([
      'wf-public',
      'wf-both',
    ]);
    expect(grouped.uncategorized.map((item) => item.id)).toEqual(['wf-plain']);
  });
});
