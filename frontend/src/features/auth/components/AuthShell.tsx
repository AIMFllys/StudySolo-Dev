import type { ReactNode } from 'react';
import { AuthBrandPanel } from './AuthBrandPanel';
import { AuthLogo } from './AuthLogo';
import { AuthSocialButtons } from './AuthSocialButtons';
import ThemeToggle from '@/components/layout/ThemeToggle';

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  showSocial?: boolean;
}

const floatingTexts = [
  { text: '智能大纲辅助计算', top: '15%', left: '60%', rotate: 'rotate-3', mobileHidden: false },
  { text: '核心知识提炼网络', top: '75%', left: '15%', rotate: '-rotate-6', mobileHidden: false },
  { text: '高维度总结与归纳', top: '45%', left: '65%', rotate: '-rotate-2', mobileHidden: true },
  { text: '间隔重复闪卡生成', top: '80%', left: '55%', rotate: 'rotate-12', mobileHidden: true },
  { text: '构建结构化思维', top: '25%', left: '10%', rotate: '-rotate-12', mobileHidden: false },
  { text: '化繁为简', top: '60%', left: '5%', rotate: 'rotate-6', mobileHidden: false },
];

export function AuthShell({
  title,
  description,
  children,
  footer,
  showSocial = true,
}: AuthShellProps) {
  return (
    <div className="h-screen relative flex bg-background text-foreground antialiased font-sans overflow-hidden">
      
      {/* 极简网格背景 (全局可见：桌面左侧 + 手机全屏) */}
      <div 
        className="absolute inset-0 opacity-[0.6] pointer-events-none z-0"
        style={{
          backgroundImage: 'linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)',
          backgroundSize: '1.5rem 1.5rem',
        }}
      />

      {/* 散乱的书香气息文字元素 (全局可见) */}
      {floatingTexts.map((item, index) => (
        <div
          key={index}
          className={`absolute text-muted-foreground/50 font-serif text-lg tracking-widest opacity-30 select-none pointer-events-none transform z-0 ${item.rotate} ${item.mobileHidden ? 'hidden md:block' : ''}`}
          style={{ top: item.top, left: item.left }}
        >
          {item.text}
        </div>
      ))}

      {/* 红线 (纸质比喻 - 移动端显示在更靠左边界) */}
      <div className="absolute top-0 bottom-0 left-4 md:left-6 lg:left-12 w-[2px] bg-red-400/20 z-0 pointer-events-none" />
      <div className="absolute top-0 bottom-0 left-[20px] md:left-[28px] lg:left-[52px] w-px bg-red-400/20 z-0 pointer-events-none" />

      {/* 底部信息：引言与备案 (全局可见：桌面靠左，移动端居底) */}
      <div className="absolute bottom-4 w-full md:w-1/2 flex flex-col md:items-start items-center justify-center gap-1 md:pl-16 lg:pl-32 z-10 pb-4 md:pb-8 pointer-events-none">
        <div className="text-xs md:text-sm text-muted-foreground font-serif opacity-70">
          &quot;Knowledge is recognizing the connections.&quot;
        </div>
        <a 
          href="https://beian.miit.gov.cn/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[10px] md:text-xs text-muted-foreground/80 hover:text-foreground transition-colors pointer-events-auto"
        >
          黑ICP备2025046407号-3
        </a>
      </div>

      {/* 桌面端左侧品牌标语区 */}
      <div className="relative z-10 hidden md:flex w-1/2">
        <AuthBrandPanel />
      </div>
      
      {/* 表单容器：桌面端白色遮挡网格，移动端透明显示网格背景 */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 relative z-10 overflow-y-auto bg-transparent md:bg-card md:border-l md:border-border/50 md:shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
        
        {/* Theme Toggle Top Right */}
        <div className="absolute top-6 right-6 z-50">
          <ThemeToggle />
        </div>

        {/* 移动端如果背景透明，用 backdrop-blur 和轻微渐变白底保证表单可读性 */}
        <div className="absolute inset-0 md:hidden bg-card/70 backdrop-blur-[2px] z-[-1]" />

        <div className="w-full max-w-[360px] relative z-10 pb-16 md:pb-0">
          <div className="flex items-center mb-10 md:hidden bg-card/60 w-fit p-3 rounded-xl border border-border shadow-sm">
            <AuthLogo size="sm" />
          </div>
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
            <p className="text-sm font-serif text-muted-foreground mt-2">{description}</p>
          </div>

          {showSocial ? (
            <>
              <div className="mb-6">
                <AuthSocialButtons />
              </div>
              <div className="flex items-center gap-3 mb-8 mt-6">
                <div className="flex-1 border-t border-border/80 dark:border-border/40 md:border-border" />
                <span className="text-xs text-muted-foreground font-medium tracking-wide">或使用邮箱登录</span>
                <div className="flex-1 border-t border-border/80 dark:border-border/40 md:border-border" />
              </div>
            </>
          ) : null}

          {children}
          
          <div className="mt-8 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
