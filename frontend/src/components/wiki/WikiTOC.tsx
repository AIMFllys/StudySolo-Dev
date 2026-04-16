'use client';

import { useEffect, useState } from 'react';
import { TOCItem } from '@/lib/wiki';

interface WikiTOCProps {
  items: TOCItem[];
}

export default function WikiTOC({ items }: WikiTOCProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -40% 0px' }
    );

    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [items]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveId(id);
    }
  };

  if (items.length === 0) return null;

  return (
    <nav className="wiki-toc sticky top-20 max-h-[calc(100vh-120px)] overflow-y-auto">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        目录
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => handleClick(e, item.id)}
              className={`block text-sm transition-colors ${
                item.level === 3 ? 'pl-3' : ''
              } ${
                activeId === item.id
                  ? 'font-medium text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
