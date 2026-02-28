import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl font-bold text-muted-foreground">404</span>
      <h2 className="text-lg font-semibold">页面不存在</h2>
      <p className="text-sm text-muted-foreground">你访问的页面已被删除或从未存在过。</p>
      <Link
        href="/"
        className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        返回首页
      </Link>
    </div>
  );
}
