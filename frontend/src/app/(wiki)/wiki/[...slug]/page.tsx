import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import type { ReactNode } from 'react';
import remarkGfm from 'remark-gfm';
import {
  createHeadingId,
  getAllDocSlugs,
  getDocContent,
  parseTableOfContents,
} from '@/lib/wiki';
import WikiBreadcrumb from '@/components/wiki/WikiBreadcrumb';
import WikiCodeBlock from '@/components/wiki/WikiCodeBlock';
import WikiPagination from '@/components/wiki/WikiPagination';
import WikiTOC from '@/components/wiki/WikiTOC';
import { Sparkles } from 'lucide-react';

interface Props { params: Promise<{ slug: string[] }>; }

/**
 * 生成所有静态路径
 * 用于生产构建时预渲染所有文档页面
 */
export async function generateStaticParams() {
  return getAllDocSlugs();
}

function getTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return getTextContent((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

function RichList({ ordered, children }: { ordered?: boolean; children?: ReactNode }) {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className={ordered ? 'wiki-rich-list wiki-rich-list-ordered' : 'wiki-rich-list'}>{children}</Tag>;
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
  const headingIds = new Map<string, number>();

  return (
    <div className={toc.length > 0 ? 'wiki-doc-grid' : 'wiki-doc-grid-no-toc'}>
      <article className="wiki-article">
        <header className="wiki-doc-header">
          <WikiBreadcrumb slug={slugPath} />
          <p className="wiki-index-badge">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
            StudySolo Wiki
          </p>
          <h1>
            {doc.frontmatter.title}
          </h1>
          {doc.frontmatter.description && (
            <p>
              {doc.frontmatter.description}
            </p>
          )}
          {doc.frontmatter.lastUpdated && (
            <span>
              最后更新：{doc.frontmatter.lastUpdated}
            </span>
          )}
        </header>
        <div className="wiki-markdown prose max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2({ children }) {
                const id = createHeadingId(getTextContent(children), headingIds);
                return <h2 id={id}>{children}</h2>;
              },
              h3({ children }) {
                const id = createHeadingId(getTextContent(children), headingIds);
                return <h3 id={id}>{children}</h3>;
              },
              code({ className, children, ...props }) {
                const match = className?.match(/language-(\w+)/);
                const rawCode = String(children);
                if (match || rawCode.includes('\n')) {
                  return <WikiCodeBlock code={rawCode.replace(/\n$/, '')} lang={match?.[1]} />;
                }
                return <code {...props}>{children}</code>;
              },
              ul({ children }) {
                return <RichList>{children}</RichList>;
              },
              ol({ children }) {
                return <RichList ordered>{children}</RichList>;
              },
            }}
          >
            {doc.content}
          </ReactMarkdown>
        </div>
        <WikiPagination slug={slugPath} />
      </article>
      {toc.length > 0 && (
        <aside className="wiki-toc-panel">
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
  let description;
  try {
    const doc = await getDocContent(slugPath);
    title = doc.frontmatter.title;
    description = doc.frontmatter.description;
  } catch {
    title = slug[slug.length - 1]
      ?.replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ?? '文档';
  }

  return {
    title: `${title} — StudySolo Wiki`,
    description,
  };
}
