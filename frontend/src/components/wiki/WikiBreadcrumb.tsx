import Link from 'next/link';
import { flattenNavigation, getNavigation } from '@/lib/wiki';

interface WikiBreadcrumbProps {
  slug: string;
}

export default function WikiBreadcrumb({ slug }: WikiBreadcrumbProps) {
  const current = flattenNavigation(getNavigation()).find((item) => item.slug === slug);

  if (!current) return null;

  return (
    <nav className="not-prose wiki-breadcrumb">
      <Link href="/wiki">📚 文档中心</Link>
      {current.breadcrumbs.map((label) => (
        <span key={label}>/ {label}</span>
      ))}
      <span>/ {current.title}</span>
    </nav>
  );
}
