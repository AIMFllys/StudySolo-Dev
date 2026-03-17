'use client';

import { useSettingsStore } from '@/stores/use-settings-store';

/**
 * Client wrapper that applies sidebar position mirroring.
 *
 * Left (default):  [Sidebar] [main canvas] [RightPanel]
 * Right (mirrored): [RightPanel] [main canvas] [Sidebar]  → achieved via flex-row-reverse
 *
 * Note: The Sidebar itself always renders on the "left" in DOM order;
 * flex-row-reverse visually moves it to the right without changing any logic.
 */
export default function DashboardContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarPosition = useSettingsStore((s) => s.sidebarPosition);
  const isRight = sidebarPosition === 'right';

  return (
    <div
      className={`flex flex-1 overflow-hidden ${isRight ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {children}
    </div>
  );
}
