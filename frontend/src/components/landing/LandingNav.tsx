import Link from 'next/link';
import { PenTool, Info, LogIn, UserPlus } from 'lucide-react';

export function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#fcfbf9]/80 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6 md:px-12 lg:px-24">
        <div className="flex items-center gap-2">
          <PenTool className="w-5 h-5 text-blue-600" />
          <span className="text-lg font-bold tracking-tight text-slate-900 font-serif">
            StudySolo
          </span>
          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600 rounded-md border border-blue-200 shadow-sm flex items-center h-fit mt-1">
            Beta
          </span>
        </div>

        <div className="flex items-center h-full gap-3 md:gap-6">
          <a
            href="https://StudyFlow.1037solo.com/introduce"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            <Info className="w-4 h-4" />
            项目介绍
          </a>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            登录
          </Link>
          <Link
            href="/register"
            className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            注册
          </Link>
        </div>
      </div>
    </nav>
  );
}
