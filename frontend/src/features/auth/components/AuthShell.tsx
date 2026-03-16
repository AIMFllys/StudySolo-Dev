import type { ReactNode } from 'react';
import { authAnimationStyles } from '@/features/auth/constants';
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
    <>
      <style dangerouslySetInnerHTML={{ __html: authAnimationStyles }} />
      <div className="min-h-screen flex bg-background">
        <AuthBrandPanel />
        <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-background">
          <div className="w-full max-w-sm">
            <div className="flex items-center mb-8 md:hidden">
              <AuthLogo size="sm" />
            </div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>

            {showSocial ? (
              <>
                <AuthSocialButtons />
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">或使用邮箱继续</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            ) : null}

            {children}
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          </div>
        </div>
      </div>
    </>
  );
}
