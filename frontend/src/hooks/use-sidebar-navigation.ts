import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/services/auth.service';

export function isWorkflowRouteActive(pathname: string, workflowId: string): boolean {
  return pathname === `/c/${workflowId}`;
}

export function isSettingsRouteActive(pathname: string): boolean {
  return pathname === '/settings';
}

interface UseSidebarNavigationResult {
  pathname: string;
  settingsActive: boolean;
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
    isWorkflowActive,
    logoutAndRedirect,
  };
}
