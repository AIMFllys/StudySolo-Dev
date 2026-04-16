import path from 'path';
import fs from 'fs';

/** 文档元数据 */
export interface DocMeta {
  slug: string;
  title: string;
  description?: string;
  lastUpdated?: string;
}

/** 导航项 */
export interface NavItem {
  title: string;
  slug?: string;
  order: number;
  children?: NavItem[];
}

export interface FlatNavItem {
  title: string;
  slug: string;
  breadcrumbs: string[];
}

/** TOC 标题项 */
export interface TOCItem {
  id: string;
  title: string;
  level: 2 | 3;
}

/** _meta.json 结构 */
interface MetaItem {
  title: string;
  order?: number;
}

type MetaConfig = Record<string, MetaItem>;

const WIKI_CONTENT_PATH = path.join(process.cwd(), '..', 'docs', 'wiki-content');
const ROOT_PRIVATE_DOCS = new Set(['README.md', 'WIKI-DEV-PLAN.md']);

function isPrivateWikiItem(name: string, baseSlug: string[]): boolean {
  return baseSlug.length === 0 && ROOT_PRIVATE_DOCS.has(name);
}

export function slugifyHeading(title: string, fallback = 'section'): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || fallback;
}

export function createHeadingId(title: string, seen: Map<string, number>): string {
  const baseId = slugifyHeading(title);
  const count = seen.get(baseId) ?? 0;
  seen.set(baseId, count + 1);

  return count === 0 ? baseId : `${baseId}-${count + 1}`;
}

/**
 * 读取指定文档内容 + frontmatter
 * @param slug - 如 "getting-started/quick-start"
 * @returns markdown 原文 + frontmatter
 */
export async function getDocContent(slug: string): Promise<{
  content: string;
  frontmatter: DocMeta;
}> {
  const filePath = path.join(WIKI_CONTENT_PATH, `${slug}.md`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  // 解析 frontmatter
  const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n/);
  const frontmatter: Partial<DocMeta> = {};
  let content = fileContent;

  if (frontmatterMatch) {
    const yamlContent = frontmatterMatch[1];
    content = fileContent.slice(frontmatterMatch[0].length);

    // 简单 YAML 解析
    yamlContent.split('\n').forEach((line) => {
      const match = line.match(/^([\w-]+):\s*["']?(.*?)["']?\s*$/);
      if (match) {
        const [, key, value] = match;
        if (key === 'title') frontmatter.title = value;
        if (key === 'description') frontmatter.description = value;
        if (key === 'lastUpdated') frontmatter.lastUpdated = value;
      }
    });
  }

  // 如果没有 frontmatter title，从第一个 h1 提取
  if (!frontmatter.title) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    frontmatter.title = h1Match?.[1] || slug.split('/').pop() || 'Untitled';
  }

  return {
    content,
    frontmatter: {
      slug,
      title: frontmatter.title,
      description: frontmatter.description,
      lastUpdated: frontmatter.lastUpdated,
    },
  };
}

/**
 * 扫描所有 .md 文件，返回 slug 列表
 * 用于 generateStaticParams()
 */
export function getAllDocSlugs(): { slug: string[] }[] {
  const slugs: { slug: string[] }[] = [];

  function scanDir(dirPath: string, baseSlug: string[] = []) {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.name.startsWith('_')) continue; // 跳过 _meta.json 等
      if (isPrivateWikiItem(item.name, baseSlug)) continue;

      const fullPath = path.join(dirPath, item.name);
      const itemSlug = [...baseSlug, item.name.replace(/\.md$/, '')];

      if (item.isDirectory()) {
        scanDir(fullPath, itemSlug);
      } else if (item.name.endsWith('.md')) {
        slugs.push({ slug: itemSlug });
      }
    }
  }

  if (fs.existsSync(WIKI_CONTENT_PATH)) {
    scanDir(WIKI_CONTENT_PATH);
  }

  return slugs;
}

/**
 * 读取所有 _meta.json，构建完整的导航树
 */
export function getNavigation(): NavItem[] {
  const navItems: NavItem[] = [];

  function readMeta(dirPath: string): MetaConfig | null {
    const metaPath = path.join(dirPath, '_meta.json');
    try {
      const content = fs.readFileSync(metaPath, 'utf-8');
      return JSON.parse(content) as MetaConfig;
    } catch {
      return null;
    }
  }

  function buildNav(dirPath: string, baseSlug: string[] = []): NavItem[] {
    const items: NavItem[] = [];
    const meta = readMeta(dirPath);

    const dirItems = fs.readdirSync(dirPath, { withFileTypes: true });

    // 按 meta order 排序，无 meta 的按字母序
    const sortedItems = dirItems
      .filter((item) => !item.name.startsWith('_') && !item.name.startsWith('.'))
      .filter((item) => !isPrivateWikiItem(item.name, baseSlug))
      .sort((a, b) => {
        const aKey = a.name.replace(/\.md$/, '');
        const bKey = b.name.replace(/\.md$/, '');
        const aOrder = meta?.[aKey]?.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = meta?.[bKey]?.order ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });

    for (const item of sortedItems) {
      const itemSlug = [...baseSlug, item.name.replace(/\.md$/, '')];
      const key = item.name.replace(/\.md$/, '');
      const metaItem = meta?.[key];

      if (item.isDirectory()) {
        const children = buildNav(path.join(dirPath, item.name), itemSlug);
        if (children.length > 0 || metaItem) {
          items.push({
            title: metaItem?.title || key,
            order: metaItem?.order ?? Number.MAX_SAFE_INTEGER,
            children,
          });
        }
      } else if (item.name.endsWith('.md')) {
        items.push({
          title: metaItem?.title || key,
          slug: itemSlug.join('/'),
          order: metaItem?.order ?? Number.MAX_SAFE_INTEGER,
        });
      }
    }

    return items;
  }

  if (fs.existsSync(WIKI_CONTENT_PATH)) {
    return buildNav(WIKI_CONTENT_PATH);
  }

  return navItems;
}

export function flattenNavigation(items: NavItem[]): FlatNavItem[] {
  function walk(navItems: NavItem[], parents: string[] = []): FlatNavItem[] {
    return navItems.flatMap((item) => {
      if (item.slug) {
        return [{
          title: item.title,
          slug: item.slug,
          breadcrumbs: parents,
        }];
      }

      return walk(item.children ?? [], [...parents, item.title]);
    });
  }

  return walk(items);
}

/**
 * 从 markdown 内容中提取标题，生成 TOC
 */
export function parseTableOfContents(markdown: string): TOCItem[] {
  const toc: TOCItem[] = [];
  const lines = markdown.split('\n');
  const seen = new Map<string, number>();

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length as 2 | 3;
      const title = match[2].trim();
      const id = createHeadingId(title, seen);

      toc.push({ id, title, level });
    }
  }

  return toc;
}
