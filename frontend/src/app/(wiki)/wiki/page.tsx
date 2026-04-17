import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { NavItem } from '@/lib/wiki';
import { getDocContent, getNavigation } from '@/lib/wiki';

export const metadata = { title: '文档中心 — StudySolo' };

interface DocCard {
  title: string;
  href: string;
  description: string;
  emoji: string;
}

type DocNavItem = NavItem & { slug: string };

const SECTION_EMOJIS: Record<string, string> = {
  快速开始: '🚀',
  使用指南: '🧭',
  节点文档: '🧩',
  'API 参考': '🔌',
};

const DOC_EMOJIS: Record<string, string> = {
  'getting-started/quick-start': '⚡',
  'getting-started/concepts': '🧠',
  'guides/creating-workflows': '🛠️',
  'guides/using-nodes': '🧩',
  'guides/ai-chat': '💬',
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  快速开始: '从账号准备到创建第一个学习工作流，快速理解 StudySolo 的基本使用路径。',
  使用指南: '深入了解工作流、节点和 AI 生成能力，掌握更稳定的学习流程搭建方式。',
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
        href: `/wiki/${item.slug}`,
        description: description ?? DOC_DESCRIPTIONS[item.slug] ?? '查看这篇 StudySolo Wiki 文档的详细说明。',
        emoji: DOC_EMOJIS[item.slug] ?? '📄',
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
          <BookOpen className="h-3.5 w-3.5" />
          StudySolo Wiki
        </div>
        <h1>文档中心</h1>
        <p>StudySolo 使用文档与开发指南</p>
      </div>

      <div className="wiki-section-list">
        {sections.map((section) => (
          <section key={section.title} className="wiki-index-section">
            <div className="wiki-section-heading">
              <h2>{SECTION_EMOJIS[section.title] ?? '📚'} {section.title}</h2>
              <p>{section.description}</p>
            </div>
            <ul>
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="wiki-doc-card"
                  >
                    <span className="wiki-doc-card-emoji" aria-hidden="true">
                      {item.emoji}
                    </span>
                    <span className="wiki-doc-card-title">
                      {item.title}
                    </span>
                    <span className="wiki-doc-card-desc">
                      {item.description}
                    </span>
                    <ArrowRight className="wiki-doc-card-icon h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
