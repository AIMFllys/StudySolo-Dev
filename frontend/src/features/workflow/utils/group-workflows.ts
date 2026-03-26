import type { WorkflowMeta } from '@/types/workflow';

export interface WorkflowDisplayGroups {
  favorites: WorkflowMeta[];
  published: WorkflowMeta[];
  uncategorized: WorkflowMeta[];
}

/**
 * Group workflows for display.
 *
 * Rules:
 * - Favorited workflows always appear in the favorites section.
 * - Public workflows always appear in the public section.
 * - A workflow that is both favorited and public appears in both sections.
 * - Uncategorized only contains workflows that are neither favorited nor public.
 */
export function groupWorkflowsForDisplay(
  workflows: WorkflowMeta[],
): WorkflowDisplayGroups {
  return {
    favorites: workflows.filter((workflow) => workflow.is_favorited),
    published: workflows.filter((workflow) => workflow.is_public),
    uncategorized: workflows.filter(
      (workflow) => !workflow.is_favorited && !workflow.is_public,
    ),
  };
}
