import { getNavigation } from '@/lib/wiki';
import type { NavItem } from '@/lib/wiki';
import WikiSidebarClient from './WikiSidebarClient';

interface WikiSidebarProps {
  navItems?: NavItem[];
}

export default function WikiSidebar({ navItems }: WikiSidebarProps) {
  return <WikiSidebarClient navItems={navItems ?? getNavigation()} />;
}
