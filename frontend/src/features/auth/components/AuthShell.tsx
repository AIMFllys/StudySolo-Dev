import type { ReactNode } from 'react';
import { AuthBrandPanel } from './AuthBrandPanel';
import { AuthLogo } from './AuthLogo';
import { AuthSocialButtons } from './AuthSocialButtons';

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  showSocial?: boolean;
}

export function AuthShell({
  title,
  description,
  children,
  footer,
  showSocial = true,
}: AuthShellProps) {
  return (
    <div className="min-h-screen flex bg-[#070707]">
      <AuthBrandPanel />
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-[#070707] relative overflow-hidden">
        {/* Subtle grid on right side as well */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="w-full max-w-[360px] relative z-10">
          <div className="flex items-center mb-8 md:hidden">
            <AuthLogo size="sm" />
          </div>
          
          <div className="mb-10 font-mono">
            <div className="text-[10px] text-lime-400 mb-2">{"// AUTH_REQUIRED"}</div>
            <h2 className="text-2xl font-bold tracking-tight text-white uppercase">{title}</h2>
            <p className="text-xs text-white/50 mt-2 uppercase">{description}</p>
          </div>

          {showSocial ? (
            <>
              <AuthSocialButtons />
              <div className="flex items-center gap-3 mb-8">
                <div className="flex-1 h-px bg-white/10" />
                <span className="font-mono text-[10px] uppercase text-white/40">OR_EMAIL_LOGIN</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </>
          ) : null}

          {children}
          
          <div className="mt-8 text-center bg-black/50 border border-white/5 p-4 text-xs text-white/40 font-mono uppercase">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
