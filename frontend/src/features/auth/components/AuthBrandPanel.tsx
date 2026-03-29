import { AuthLogo } from './AuthLogo';

export function AuthBrandPanel() {
  return (
    <div className="hidden md:flex md:w-1/2 flex-col justify-center px-10 lg:px-16 pointer-events-none">
      {/* 内容区域，向左靠齐，留白对称 */}
      <div className="relative z-10 w-full max-w-lg pl-8 lg:pl-16">
        <div className="mb-12 inline-flex items-center gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm pointer-events-auto">
          <AuthLogo size="lg" />
        </div>
        
        <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-slate-100 leading-[1.2] mb-6 tracking-tight">
          将繁杂的信息<br/>
          <span className="text-blue-600 dark:text-blue-400 relative inline-block mt-2">
            结构化沉淀
            <svg className="absolute w-full h-2 -bottom-2 left-0 text-blue-200 dark:text-blue-900/50 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="transparent" />
            </svg>
          </span>
        </h1>
        
        <p className="font-serif text-slate-600 dark:text-slate-400 text-lg leading-relaxed max-w-[320px]">
          一款为终身学习者打造的研究引擎。<br/>
          通过清晰的工作流，化繁为简穿透信息噪音。
        </p>
      </div>
    </div>
  );
}
