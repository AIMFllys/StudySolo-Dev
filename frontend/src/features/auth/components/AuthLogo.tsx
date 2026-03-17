import { PenTool } from 'lucide-react';

interface AuthLogoProps {
  size?: 'sm' | 'lg';
}

export function AuthLogo({ size = 'lg' }: AuthLogoProps) {
  const isLarge = size === 'lg';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 ${isLarge ? 'p-2' : 'p-1.5'}`}>
        <PenTool className={`${isLarge ? 'w-5 h-5' : 'w-4 h-4'} stroke-[2]`} />
      </div>
      <span
        className={`${isLarge ? 'text-xl' : 'text-lg'} font-bold tracking-tight text-slate-900`}
      >
        StudySolo
      </span>
    </div>
  );
}
