import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
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
          <span><ArrowLeft className="h-4 w-4 shrink-0" aria-hidden /><BookOpen className="h-4 w-4 shrink-0 opacity-80" aria-hidden />上一篇</span>
          <strong>{previous.title}</strong>
        </Link>
      )}
      {next && (
        <Link href={`/wiki/${next.slug}`} className="wiki-page-link wiki-page-link-next">
          <span>下一篇<BookOpen className="h-4 w-4 shrink-0 opacity-80" aria-hidden /><ArrowRight className="h-4 w-4 shrink-0" aria-hidden /></span>
          <strong>{next.title}</strong>
        </Link>
      )}
    </nav>
  );
}
