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
    <nav className="wiki-toc">
      <p className="wiki-toc-title">
        目录
      </p>
      <ul className="wiki-toc-list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => handleClick(e, item.id)}
              className={`wiki-toc-link ${item.level === 3 ? 'wiki-toc-link-nested' : ''} ${
                activeId === item.id
                  ? 'wiki-toc-link-active'
                  : ''
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
