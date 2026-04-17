import Link from 'next/link';
import { ArrowRight, BookOpen, FileText } from 'lucide-react';
import type { NavItem } from '@/lib/wiki';
import { getDocContent, getNavigation } from '@/lib/wiki';
import { WIKI_SECTION_ICONS, WikiDocNavIcon } from '@/lib/wiki-nav-icons';

export const metadata = { title: '文档中心 — StudySolo' };

interface DocCard {
  title: string;
  href: string;
  slug: string;
  description: string;
}

type DocNavItem = NavItem & { slug: string };

const SECTION_DESCRIPTIONS: Record<string, string> = {
  快速开始: '从账号准备到创建第一个学习工作流，快速理解 StudySolo 的基本使用路径。',
  使用指南: '深入了解工作流、节点和 AI 生成能力，掌握更稳定的学习流程搭建方式。',
  'API 参考': 'Personal Access Token、命令行、MCP Host 集成与 Agent Skills 说明。',
};

const DOC_DESCRIPTIONS: Record<string, string> = {
  'getting-started/quick-start': '5 分钟上手 StudySolo，创建你的第一个 AI 学习工作流。',
  'guides/creating-workflows': '深入了解 StudySolo 工作流系统，掌握节点编辑与 AI 生成技巧。',
};

function collectDocItems(items: NavItem[]): DocNavItem[] {
  return items.flatMap((item) => {
    if (item.slug) return [item as DocNavItem];
    return item.children ? collectDocItems(item.children) : [];
  });
}

async function getDocCards(items: NavItem[]): Promise<DocCard[]> {
  const docs = collectDocItems(items);

  return Promise.all(
    docs.map(async (item) => {
      let description: string | undefined;

      try {
        const doc = await getDocContent(item.slug);
        description = doc.frontmatter.description;
      } catch {
        description = undefined;
      }

      return {
        title: item.title,
        slug: item.slug,
        href: `/wiki/${item.slug}`,
        description: description ?? DOC_DESCRIPTIONS[item.slug] ?? '查看这篇 StudySolo Wiki 文档的详细说明。',
      };
    }),
  );
}

export default async function WikiIndexPage() {
  const sections = await Promise.all(
    getNavigation()
      .map(async (section) => ({
        title: section.title,
        description: SECTION_DESCRIPTIONS[section.title] ?? '阅读该分组下的 StudySolo Wiki 文档。',
        items: await getDocCards(section.slug ? [section] : section.children ?? []),
      })),
  );

  return (
    <div className="wiki-index">
      <div className="wiki-index-hero">
        <div className="wiki-index-badge">
          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
          StudySolo Wiki
        </div>
        <h1>文档中心</h1>
        <p>StudySolo 使用文档与开发指南</p>
      </div>

      <div className="wiki-section-list">
        {sections.map((section) => {
          const SectionIcon = WIKI_SECTION_ICONS[section.title] ?? FileText;
          return (
            <section key={section.title} className="wiki-index-section">
              <div className="wiki-section-heading">
                <h2>
                  <SectionIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {section.title}
                </h2>
                <p>{section.description}</p>
              </div>
              <ul>
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="wiki-doc-card"
                    >
                      <span className="wiki-doc-card-icon-wrap" aria-hidden="true">
                        <WikiDocNavIcon slug={item.slug} className="h-[1.05rem] w-[1.05rem]" />
                      </span>
                      <span className="wiki-doc-card-title">
                        {item.title}
                      </span>
                      <span className="wiki-doc-card-desc">
                        {item.description}
                      </span>
                      <ArrowRight className="wiki-doc-card-icon h-4 w-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
