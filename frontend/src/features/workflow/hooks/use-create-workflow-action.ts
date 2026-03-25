import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface WorkflowCreateResponse {
  id: string;
}

interface UseCreateWorkflowActionResult {
  creating: boolean;
  createWorkflow: () => Promise<void>;
}

export function useCreateWorkflowAction(defaultName = '未命名工作流'): UseCreateWorkflowActionResult {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const createWorkflow = useCallback(async () => {
    if (creating) {
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/workflow', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: defaultName }),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body.detail as string | undefined) ?? '创建失败');
      }

      const data = (await response.json()) as WorkflowCreateResponse;
      router.push(`/c/${data.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建工作流失败';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }, [creating, defaultName, router]);

  return { creating, createWorkflow };
}
