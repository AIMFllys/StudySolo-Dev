import Link from 'next/link';
import { getNavigation, NavItem } from '@/lib/wiki';

interface WikiSidebarProps {
  currentSlug?: string;
}

function NavTree({ items, currentSlug }: { items: NavItem[]; currentSlug?: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, index) => (
        <li key={index}>
          {item.slug ? (
            <Link
              href={`/wiki/${item.slug}`}
              className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                currentSlug === item.slug
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {item.title}
            </Link>
          ) : (
            <div className="mt-2">
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {item.title}
              </p>
              {item.children && (
                <NavTree items={item.children} currentSlug={currentSlug} />
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function WikiSidebar({ currentSlug }: WikiSidebarProps) {
  const navItems = getNavigation();

  return (
    <nav className="flex flex-col gap-4">
      {navItems.map((section, index) => (
        <div key={index}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </p>
          {section.children && (
            <NavTree items={section.children} currentSlug={currentSlug} />
          )}
        </div>
      ))}
    </nav>
  );
}
