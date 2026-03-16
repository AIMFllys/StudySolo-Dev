import Link from 'next/link';
import { Zap, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center bg-background overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-accent/5 blur-[100px] pointer-events-none" />

      {/* Logo */}
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-6 h-6 text-primary fill-primary/20" />
        <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          StudySolo
        </span>
      </div>

      {/* 404 Text */}
      <div className="relative">
        <span className="text-[8rem] md:text-[12rem] font-black leading-none text-muted/60 select-none">
          404
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl md:text-2xl font-bold text-foreground">
            页面未找到
          </span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground max-w-md -mt-4">
        你访问的页面已被删除或从未存在过。请检查 URL 是否正确。
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-2">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 shadow-glow transition-all active:scale-[0.98]"
        >
          <Home className="w-4 h-4" />
          返回首页
        </Link>
        <button
          onClick={() => typeof window !== 'undefined' && window.history.back()}
          className="flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          返回上页
        </button>
      </div>
    </div>
  );
}
