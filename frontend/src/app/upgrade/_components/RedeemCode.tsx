'use client';

import { useState } from 'react';
import { Ticket, ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { redeemCode } from '@/services/auth.service';

/**
 * Broadcast a custom event so sidebar components can re-fetch user info
 * without a full page reload.
 */
function broadcastTierRefresh() {
  window.dispatchEvent(new CustomEvent('studysolo:tier-refresh'));
}

export default function RedeemCode() {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultState, setResultState] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setIsSubmitting(true);
    setResultState('idle');

    try {
      const result = await redeemCode(trimmed);

      setResultState('success');
      setCode('');

      // Notify sidebar panels to re-fetch user info
      broadcastTierRefresh();

      toast.success('兑换成功', { description: result.message });

      setTimeout(() => setResultState('idle'), 4000);
    } catch (err: unknown) {
      setResultState('error');
      const msg = err instanceof Error ? err.message : '兑换码无效或已过期';
      toast.error('兑换失败', { description: msg });
      setTimeout(() => setResultState('idle'), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconNode = () => {
    if (isSubmitting) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (resultState === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (resultState === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
    return <ArrowRight className="w-4 h-4" />;
  };

  return (
    <div className="w-full max-w-sm mx-auto mb-10 flex flex-col items-center gap-2">
      <form onSubmit={handleSubmit} className="relative w-full flex items-center group">
        {/* Ticket icon */}
        <div className="absolute left-3 text-[#4a5568] group-focus-within:text-[#2c5282] transition-colors pointer-events-none">
          <Ticket className="w-4 h-4" />
        </div>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="输入兑换码 / Redemption Code"
          disabled={isSubmitting}
          className="w-full pl-10 pr-12 py-2.5 bg-white border border-[#e2e2d5] text-sm text-[#1a202c] font-mono tracking-widest placeholder:text-[#a0aec0] placeholder:tracking-normal focus:outline-none focus:border-[#2c5282] focus:ring-1 focus:ring-[#2c5282]/20 transition-all rounded shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={!code.trim() || isSubmitting}
          className="absolute right-2 p-1.5 text-[#4a5568] hover:bg-[#f5f3ef] hover:text-[#2c5282] rounded transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
          aria-label="验证兑换码"
        >
          {iconNode()}
        </button>
      </form>

      <p className="text-[10px] font-mono text-[#a0aec0] tracking-widest">
        每位用户每个兑换码限用一次
      </p>
    </div>
  );
}
