import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { flattenNavigation, getNavigation } from '@/lib/wiki';

interface WikiPaginationProps {
  slug: string;
}

export default function WikiPagination({ slug }: WikiPaginationProps) {
  const docs = flattenNavigation(getNavigation());
  const index = docs.findIndex((item) => item.slug === slug);
  const previous = index > 0 ? docs[index - 1] : undefined;
  const next = index >= 0 ? docs[index + 1] : undefined;

  if (!previous && !next) return null;

  return (
    <nav className="not-prose wiki-pagination">
      {previous && (
        <Link href={`/wiki/${previous.slug}`} className="wiki-page-link">
          <span><ArrowLeft className="h-4 w-4" />上一篇 📖</span>
          <strong>{previous.title}</strong>
        </Link>
      )}
      {next && (
        <Link href={`/wiki/${next.slug}`} className="wiki-page-link wiki-page-link-next">
          <span>📖 下一篇<ArrowRight className="h-4 w-4" /></span>
          <strong>{next.title}</strong>
        </Link>
      )}
    </nav>
  );
}
