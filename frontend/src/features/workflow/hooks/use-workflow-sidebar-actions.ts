import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  deleteWorkflow,
  renameWorkflow,
} from '@/services/workflow.service';

interface UseWorkflowSidebarActionsResult {
  processingWorkflowId: string | null;
  onRenameWorkflow: (workflowId: string, currentName: string) => Promise<void>;
  onDeleteWorkflow: (workflowId: string, currentName: string) => Promise<void>;
}

export function useWorkflowSidebarActions(
  pathname: string,
  closeContextMenu: () => void
): UseWorkflowSidebarActionsResult {
  const router = useRouter();
  const [processingWorkflowId, setProcessingWorkflowId] = useState<string | null>(
    null
  );

  const onRenameWorkflow = useCallback(
    async (workflowId: string, nextName: string) => {
      closeContextMenu();

      const normalizedName = nextName.trim();
      if (!normalizedName) {
        toast.error('名称不能为空');
        return;
      }

      setProcessingWorkflowId(workflowId);
      try {
        await renameWorkflow(workflowId, normalizedName);
        toast.success('工作流已重命名');
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '重命名工作流失败';
        toast.error(message);
      } finally {
        setProcessingWorkflowId(null);
      }
    },
    [closeContextMenu, router]
  );

  const onDeleteWorkflow = useCallback(
    async (workflowId: string, currentName: string) => {
      closeContextMenu();

      const confirmed = window.confirm(
        `确认删除工作流“${currentName}”？该操作不可恢复。`
      );
      if (!confirmed) {
        return;
      }

      setProcessingWorkflowId(workflowId);
      try {
        await deleteWorkflow(workflowId);
        if (pathname === `/workspace/${workflowId}`) {
          router.push('/workspace');
        }
        router.refresh();
        toast.success('工作流已删除');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '删除工作流失败';
        toast.error(message);
      } finally {
        setProcessingWorkflowId(null);
      }
    },
    [closeContextMenu, pathname, router]
  );

  return {
    processingWorkflowId,
    onRenameWorkflow,
    onDeleteWorkflow,
  };
}
