import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDocContent, getAllDocSlugs, parseTableOfContents } from '@/lib/wiki';
import WikiTOC from '@/components/wiki/WikiTOC';

interface Props {
  params: Promise<{ slug: string[] }>;
}

/**
 * 生成所有静态路径
 * 用于生产构建时预渲染所有文档页面
 */
export async function generateStaticParams() {
  return getAllDocSlugs();
}

export default async function WikiDocPage({ params }: Props) {
  const { slug } = await params;
  const slugPath = slug.join('/');

  let doc;
  try {
    doc = await getDocContent(slugPath);
  } catch {
    notFound();
  }

  const toc = parseTableOfContents(doc.content);

  return (
    <div className="flex gap-8">
      <article className="prose prose-neutral dark:prose-invert max-w-none flex-1">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
      </article>
      {toc.length > 0 && (
        <aside className="hidden w-48 shrink-0 lg:block">
          <WikiTOC items={toc} />
        </aside>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const slugPath = slug.join('/');

  let title;
  try {
    const doc = await getDocContent(slugPath);
    title = doc.frontmatter.title;
  } catch {
    title = slug[slug.length - 1]
      ?.replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ?? '文档';
  }

  return { title: `${title} — StudySolo Wiki` };
}
