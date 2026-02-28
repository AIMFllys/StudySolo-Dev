'use client';

import { useRouter } from 'next/navigation';
import Navbar from './Navbar';
import MobileNav from './MobileNav';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleNewWorkflow = async () => {
    try {
      const res = await fetch('/api/workflow/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '未命名工作流' }),
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || '创建失败');
      }
      const data = await res.json();
      router.push(`/workspace/${data.id}`);
    } catch (err) {
      console.error('创建工作流失败:', err);
      alert(err instanceof Error ? err.message : '创建工作流失败，请重试');
    }
  };

  return (
    <>
      <Navbar onNewWorkflow={handleNewWorkflow} />
      {children}
      <MobileNav onNewWorkflow={handleNewWorkflow} />
    </>
  );
}
