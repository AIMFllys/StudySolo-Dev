import { TerminalSquare } from 'lucide-react';

interface AuthLogoProps {
  size?: 'sm' | 'lg';
}

export function AuthLogo({ size = 'lg' }: AuthLogoProps) {
  const isLarge = size === 'lg';
  return (
    <div className="flex items-center gap-2 border border-white/10 bg-black pr-4 py-1 pl-2">
      <div className="bg-lime-400 p-1.5 flex items-center justify-center">
        <TerminalSquare className={`${isLarge ? 'w-5 h-5' : 'w-4 h-4'} text-black`} strokeWidth={2.5} />
      </div>
      <span
        className={`${isLarge ? 'text-lg' : 'text-base'} font-black tracking-widest text-white uppercase`}
      >
        STUDY<span className="text-lime-400">/</span>SOLO<span className="text-lime-400 animate-pulse">_</span>
      </span>
    </div>
  );
}
