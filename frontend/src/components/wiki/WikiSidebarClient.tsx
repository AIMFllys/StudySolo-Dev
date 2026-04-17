'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/wiki';

interface WikiSidebarClientProps {
  navItems: NavItem[];
}

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

function currentSlug(pathname: string): string | undefined {
  const prefix = '/wiki/';
  return pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length)) : undefined;
}

function NavTree({ items, activeSlug }: { items: NavItem[]; activeSlug?: string }) {
  return (
    <ul className="wiki-nav-tree">
      {items.map((item, index) => (
        <li key={item.slug ?? `${item.title}-${index}`}>
          {item.slug ? (
            <Link
              href={`/wiki/${item.slug}`}
              className={`wiki-nav-link ${activeSlug === item.slug ? 'wiki-nav-link-active' : ''}`}
            >
              <span aria-hidden="true">{DOC_EMOJIS[item.slug] ?? '📄'}</span>
              <span>{item.title}</span>
            </Link>
          ) : (
            <div className="wiki-nav-group">
              <p className="wiki-nav-group-title">{item.title}</p>
              {item.children && <NavTree items={item.children} activeSlug={activeSlug} />}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function WikiSidebarClient({ navItems }: WikiSidebarClientProps) {
  const activeSlug = currentSlug(usePathname());

  return (
    <nav className="wiki-nav">
      {navItems.map((section, index) => (
        <div key={section.slug ?? `${section.title}-${index}`} className="wiki-nav-section">
          <p className="wiki-nav-section-title">
            {SECTION_EMOJIS[section.title] ?? '📚'} {section.title}
          </p>
          {section.children && <NavTree items={section.children} activeSlug={activeSlug} />}
        </div>
      ))}
    </nav>
  );
}
