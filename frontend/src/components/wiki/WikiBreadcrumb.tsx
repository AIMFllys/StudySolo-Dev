import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { flattenNavigation, getNavigation } from '@/lib/wiki';

interface WikiBreadcrumbProps {
  slug: string;
}

export default function WikiBreadcrumb({ slug }: WikiBreadcrumbProps) {
  const current = flattenNavigation(getNavigation()).find((item) => item.slug === slug);

  if (!current) return null;

  return (
    <nav className="not-prose wiki-breadcrumb" aria-label="面包屑">
      <Link href="/wiki" className="inline-flex items-center gap-1.5">
        <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>文档中心</span>
      </Link>
      {current.breadcrumbs.map((label) => (
        <span key={label}>/ {label}</span>
      ))}
      <span>/ {current.title}</span>
    </nav>
  );
}
