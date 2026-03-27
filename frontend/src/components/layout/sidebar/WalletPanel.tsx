'use client';

import { Copy, Eye, EyeOff, ExternalLink, ChevronRight, CheckCircle2, Plus, Unplug, BrainCircuit, User, Plug } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, getTierLabel, type UserInfo, type TierType } from '@/services/auth.service';

/** -------- 模拟数据 -------- */
interface ApiKeyInfo {
  provider: string;
  name: string;
  connected: boolean;
  prefix?: string;
}

const EXTERNAL_PROVIDERS: ApiKeyInfo[] = [
  { provider: 'openai', name: 'OpenAI', connected: true, prefix: 'sk-proj-...8a9b' },
  { provider: 'deepseek', name: 'DeepSeek', connected: false },
  { provider: 'dashscope', name: '通义千问 (DashScope)', connected: true, prefix: 'sk-dash-...210x' },
  { provider: 'moonshot', name: 'Kimi (Moonshot)', connected: false },
  { provider: 'zhipu', name: '智谱 (ZhiPu)', connected: false },
  { provider: 'volcengine', name: '火山引擎 (VolcEngine)', connected: false },
];

const MOCK_BILLING = {
  balance: 25.80,
  currency: '¥',
  monthlyUsage: 14.20,
  monthlyLimit: 50.00,
};

const getTierBorder = (tier: TierType) => {
  switch(tier) {
    case 'free': return 'border-muted-foreground/40 text-muted-foreground';
    case 'pro': return 'border-slate-500/60 text-slate-700 dark:text-slate-300';
    case 'pro_plus': return 'border-emerald-500/60 text-emerald-700 dark:text-emerald-400';
    case 'ultra': return 'border-amber-500/70 text-amber-700 dark:text-amber-500';
    default: return 'border-border/50 text-foreground';
  }
};

const getTierCardStyle = (tier: TierType) => {
  switch(tier) {
    case 'free': return 'node-paper-bg border-border/50 text-foreground';
    case 'pro': return 'node-paper-bg border-slate-300 dark:border-slate-800 text-foreground';
    case 'pro_plus': return 'node-paper-bg border-emerald-300 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-50';
    case 'ultra': return 'node-paper-bg border-amber-300 dark:border-amber-900/40 text-amber-950 dark:text-amber-50';
    default: return 'node-paper-bg border-border/50 text-foreground';
  }
}

/** -------- 子组件 -------- */
function ExternalApiItem({ item }: { item: ApiKeyInfo }) {
  const Icon = item.connected ? CheckCircle2 : Plus;

  return (
    <div className={`flex items-center justify-between p-2.5 rounded-none border-b border-border/40 border-dashed last:border-b-0 transition-colors ${item.connected ? 'bg-primary/5' : 'hover:bg-white/40 dark:hover:bg-black/40'} group`}>
      <div className="flex flex-col gap-0.5">
        <span className={`text-[12px] font-serif tracking-wide ${item.connected ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium'}`}>
          {item.name}
        </span>
        {item.connected ? (
          <span className="font-mono text-[10px] text-muted-foreground opacity-80">{item.prefix}</span>
        ) : (
          <span className="font-mono text-[9px] text-muted-foreground/50 tracking-widest">未配置</span>
        )}
      </div>
      <button
        onClick={() => !item.connected && console.log('TODO: configure', item.provider)}
        className={`flex h-6 w-6 items-center justify-center rounded transition-all focus:outline-none focus:ring-1 focus:ring-primary ${
          item.connected 
            ? 'text-primary' 
            : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground'
        }`}
        title={item.connected ? '已连接' : '配置密钥'}
      >
        <Icon className="h-3.5 w-3.5 stroke-[1.5]" />
      </button>
    </div>
  );
}

function InternalApiKeyDisplay() {
  const [revealed, setRevealed] = useState(false);
  const toggleReveal = useCallback(() => setRevealed((v) => !v), []);

  return (
    <div className="relative mt-2 overflow-hidden rounded-lg border-[1.5px] border-dashed border-border/60 node-paper-bg text-foreground font-mono text-[11px]">
      <div className="flex items-center justify-between border-b border-dashed border-border/40 px-2.5 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-1.5">
          <BrainCircuit className="h-3.5 w-3.5 text-primary opacity-80" />
          <span className="tracking-widest text-muted-foreground font-serif text-[11px] font-semibold">开发者私钥</span>
        </div>
        <div className="flex gap-1 text-muted-foreground">
          <button onClick={toggleReveal} className="p-1 hover:text-foreground transition-colors" title={revealed ? "隐藏密钥" : "显示密钥"}>
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button className="p-1 hover:text-foreground transition-colors" title="复制密钥">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 break-all tracking-wider font-semibold text-center bg-transparent relative">
        {revealed ? (
          <span className="text-primary selection:bg-primary/20">sk-ss-live-8f92a4bc039e71d6f51...</span>
        ) : (
          <span className="text-muted-foreground opacity-60">••••••••••••••••••••••••</span>
        )}
      </div>
    </div>
  );
}

/** -------- 主容器 -------- */
export default function WalletPanel() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const userTier: TierType = user?.tier ?? 'free';

  const fetchUser = () => {
    getUser().then(setUser).catch(() => null);
  };

  useEffect(() => {
    fetchUser();
    window.addEventListener('studysolo:tier-refresh', fetchUser);
    return () => window.removeEventListener('studysolo:tier-refresh', fetchUser);
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="scrollbar-hide flex-1 overflow-y-auto w-full px-3 py-4 space-y-6">
        
        {/* --- 第一部分：个人钱包与通行证 --- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground font-serif">
              身份与资源
            </span>
          </div>
          
          <div 
            onClick={() => router.push('/upgrade')}
            className={`relative flex flex-col rounded-xl border-[1.5px] p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 shadow-sm hover:shadow-md group ${getTierCardStyle(userTier)}`}
          >
            <div className="flex items-center gap-3 relative z-10">
              <div className={`node-paper-bg relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-dashed ${getTierBorder(userTier)}`}>
                <User className="h-[18px] w-[18px] stroke-[1.5]" />
                {/* 排名指示点 - 手绘墨点感 */}
                <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-[1.5px] border-background bg-current" />
              </div>
              <div className="flex flex-col flex-1 pl-1">
                <span className="text-sm font-serif font-semibold opacity-90 tracking-wide">{user?.name || '学习记录者'}</span>
                <div className="flex items-center gap-1.5 font-mono text-[10px] mt-0.5 opacity-70">
                  <span className="uppercase">等级:</span>
                  <span className="font-bold border border-current/20 px-1 py-0.5 rounded-sm leading-none tracking-widest">{getTierLabel(userTier)}</span>
                </div>
                {/* 到期日 */}
                {user?.tier_expires_at && userTier !== 'free' && (() => {
                  const exp = new Date(user.tier_expires_at);
                  const diffMs = exp.getTime() - Date.now();
                  const diffDays = Math.ceil(diffMs / 86400000);
                  const label = diffDays > 0 ? `剩余 ${diffDays} 天` : '已到期';
                  const isExpiring = diffDays <= 7 && diffDays > 0;
                  return (
                    <div className={`flex items-center gap-1 font-mono text-[9px] mt-1 tracking-wider ${
                      diffDays <= 0 ? 'opacity-60 line-through' : isExpiring ? 'text-amber-600 dark:text-amber-400' : 'opacity-50'
                    }`}>
                      <span>{label}</span>
                      <span className="opacity-50">·</span>
                      <span>{exp.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} 到期</span>
                    </div>
                  );
                })()}
              </div>
              <ChevronRight className="h-4 w-4 opacity-40 transition-transform group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <div className="mt-5 pt-4 border-t border-dashed border-current/20 flex justify-between items-end relative z-10">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-serif tracking-wider opacity-70">学习点券余额</span>
                <span className="text-xl font-mono font-bold leading-none tracking-tight">
                  {MOCK_BILLING.currency}{MOCK_BILLING.balance.toFixed(2)}
                </span>
              </div>
              
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); /* 充值逻辑 */ }}
                className="node-paper-bg rounded-lg text-[11px] font-mono font-medium tracking-wide px-3 py-1.5 border-[1.5px] border-current/30 shadow-sm hover:-translate-y-0.5 hover:shadow hover:border-current/50 transition-all text-foreground"
              >
                前往充值
              </button>
            </div>
            
            {/* 用量条 - 墨迹感 */}
            <div className="mt-4 relative z-10">
              <div className="flex justify-between text-[9px] font-mono tracking-wider opacity-70 mb-1.5">
                <span>月度额度</span>
                <span>{((MOCK_BILLING.monthlyUsage / MOCK_BILLING.monthlyLimit) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-current/10 rounded-full overflow-hidden border border-current/10">
                <div 
                  className="h-full bg-current opacity-80 rounded-r-full" 
                  style={{ width: `${(MOCK_BILLING.monthlyUsage / MOCK_BILLING.monthlyLimit) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* --- 第二部分：模型厂商 API 导入 --- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground font-serif">
              模型厂商授权
            </span>
          </div>
          
          <div className="node-paper-bg border-[1.5px] border-border/50 rounded-xl overflow-hidden shadow-sm">
            {EXTERNAL_PROVIDERS.map((item, idx) => (
              <ExternalApiItem key={item.provider} item={item} />
            ))}
          </div>
        </div>

        {/* --- 第三部分：内部开发者 Key --- */}
        <div className="space-y-2 pb-6">
          <div className="flex items-center justify-between px-1 mb-1 border-b-[1.5px] border-dashed border-border/50 pb-2">
            <span className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground font-serif">
              应用开发接入
            </span>
            <Unplug className="h-3.5 w-3.5 text-muted-foreground/60 stroke-[1.5]" />
          </div>
          
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed px-1 font-serif mt-2">
            获取您的专属密钥以通过 API 调度工作流。如非集成需要，请勿外借。
          </p>

          <InternalApiKeyDisplay />
          
          <a
            href="https://docs.1037solo.com/api"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-1.5 px-1 text-[11px] font-serif font-bold tracking-wide text-muted-foreground hover:text-primary transition-colors hover:underline underline-offset-4 decoration-dashed"
          >
            <ExternalLink className="h-3 w-3 stroke-[2]" />
            查阅 API 接入文档
          </a>
        </div>

        {/* --- 第四部分：应用能力与 MCP --- */}
        <div className="space-y-2 pb-6 pt-4 border-t border-dashed border-border/50">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground font-serif uppercase">
              MCP 集成配置
            </span>
            <Plug className="h-3.5 w-3.5 text-muted-foreground/80 stroke-[1.5]" />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed px-1 font-serif mt-2">
            集成 Model Context Protocol (MCP) 以扩展节点执行能力，支持接入外部本地数据与系统级 API。
          </p>
          <div className="node-paper-bg relative mt-2 overflow-hidden rounded-xl border-[1.5px] border-border/50 shadow-sm font-mono text-[11px]">
            <div className="flex items-center justify-between px-2.5 py-3 border-b border-dashed border-border/50">
               <span className="font-semibold text-foreground text-xs">本地 MCP 服务器</span>
               <button className="node-paper-bg flex h-6 items-center justify-center rounded-md border-[1.5px] border-border/60 px-3 text-[10px] font-medium text-foreground shadow-sm hover:-translate-y-0.5 hover:shadow transition-all active:scale-95">
                 配置
               </button>
            </div>
            <div className="p-3 text-muted-foreground tracking-wide">
              <span>状态: <span className="font-medium border-b border-muted-foreground/40 border-dashed">未连接</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
