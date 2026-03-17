import { Sparkles, Brain, FileText, Layers, Crosshair } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AuthLogo } from './AuthLogo';

const brandFeaturePills: { icon: LucideIcon; label: string; code: string }[] = [
  { icon: Sparkles, label: '大纲计算', code: 'SYS.01' },
  { icon: Brain, label: '知识提炼', code: 'SYS.02' },
  { icon: FileText, label: '总结归纳', code: 'SYS.03' },
  { icon: Layers, label: '闪卡生成', code: 'SYS.04' },
];

export function AuthBrandPanel() {
  return (
    <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-[#070707] border-r border-white/5 items-center justify-center">
      {/* 极简网格背景 */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* 噪点质感 */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      {/* 四角准星 */}
      <Crosshair className="absolute top-8 left-8 w-4 h-4 text-white/20" />
      <Crosshair className="absolute top-8 right-8 w-4 h-4 text-white/20" />
      <Crosshair className="absolute bottom-8 left-8 w-4 h-4 text-white/20" />
      <Crosshair className="absolute bottom-8 right-8 w-4 h-4 text-white/20" />

      {/* 顶部系统状态 */}
      <div className="absolute top-0 left-0 w-full h-8 border-b border-white/5 flex items-center px-4 justify-between bg-black/50 font-mono text-[10px] text-white/40">
        <span>STATUS: ONLINE</span>
        <span>AWAITING_AUTH...</span>
      </div>

      <div className="relative z-10 text-left px-12 w-full max-w-xl">
        <div className="mb-12 inline-flex items-center gap-4">
          <AuthLogo size="lg" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-black text-white leading-[1.1] mb-6 tracking-tight">
          <span className="block text-lime-400 font-mono text-sm mb-4 tracking-widest uppercase">INITIATING WORKFLOW</span>
          <span className="sr-only">AI 驱动的学习工作流平台</span>
          <span className="block text-white" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.8)', color: 'transparent' }}>
            COGNITIVE
          </span>
          <span className="block text-white">ENGINE_</span>
        </h1>
        
        <p className="font-mono text-xs text-white/50 leading-relaxed mb-12 max-w-sm border-l-2 border-lime-400 pl-4">
          一句话生成完整学习流程。<br/>
          从大纲到知识提炼，全链路 AI 极客级协作。
        </p>

        <div className="flex flex-col gap-2">
          {brandFeaturePills.map((item) => (
            <div
              key={item.label}
              className="group flex items-center justify-between px-4 py-3 bg-black border border-white/10 hover:border-lime-400/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <item.icon className="w-4 h-4 text-white/40 group-hover:text-lime-400 transition-colors" />
                <span className="text-white/80 text-sm font-medium tracking-wide">{item.label}</span>
              </div>
              <span className="font-mono text-[10px] text-lime-400/60 bg-lime-400/10 px-2 py-0.5">
                {item.code}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
