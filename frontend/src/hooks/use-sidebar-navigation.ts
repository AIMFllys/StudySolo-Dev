import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/services/auth.service';
import {
  isSettingsRouteActive,
  isWorkflowRouteActive,
  isKnowledgeRouteActive,
} from '@/hooks/sidebar-navigation.helpers';

interface UseSidebarNavigationResult {
  pathname: string;
  settingsActive: boolean;
  knowledgeActive: boolean;
  isWorkflowActive: (workflowId: string) => boolean;
  logoutAndRedirect: () => Promise<void>;
}

export function useSidebarNavigation(): UseSidebarNavigationResult {
  const pathname = usePathname();
  const router = useRouter();

  const isWorkflowActive = useCallback(
    (workflowId: string) => isWorkflowRouteActive(pathname, workflowId),
    [pathname]
  );

  const logoutAndRedirect = useCallback(async () => {
    await logout();
    router.push('/login');
  }, [router]);

  return {
    pathname,
    settingsActive: isSettingsRouteActive(pathname),
    knowledgeActive: isKnowledgeRouteActive(pathname),
    isWorkflowActive,
    logoutAndRedirect,
  };
}
