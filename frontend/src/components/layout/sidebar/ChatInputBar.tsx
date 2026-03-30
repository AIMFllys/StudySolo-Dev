'use client';

/**
 * ChatInputBar — 输入栏: 模式切换 + 思考深度 + 模型选择 + 发送.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { Loader2, ArrowRight, Square, Brain, Route, MessageCircle, Wand2 } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import type { AIMode, ThinkingDepth } from './SidebarAIPanel';
import type { ChatModelOption } from '@/services/ai-catalog.service';
import type { TierType } from '@/services/auth.service';

const MODE_CONFIG: Record<AIMode, { icon: typeof Brain; label: string; hint: string; desc: string }> = {
  plan: { icon: Brain, label: '规划模式', hint: '深入分析目标并输出学习路径', desc: '不直接修改画布，仅提供深度分析和架构规划建议' },
  chat: { icon: MessageCircle, label: '对话模式', hint: '自由提问，解答学术疑惑', desc: '纯文本学术对话，支持软引导切换操作模式' },
  create: { icon: Wand2, label: '创建模式', hint: '创建、复制节点或搭建工作流', desc: '直接操作画布：支持复制节点、调整结构与连线' },
};

const DEPTH_CONFIG: Record<ThinkingDepth, { label: string; color: string }> = {
  fast: { label: '快速', color: 'text-emerald-500' },
  balanced: { label: '均衡', color: 'text-blue-500' },
  deep: { label: '深度', color: 'text-amber-500' },
};

interface ChatInputBarProps {
  input: string;
  setInput: (v: string) => void;
  mode: AIMode;
  setMode: (m: AIMode) => void;
  thinkingDepth: ThinkingDepth;
  setThinkingDepth: (d: ThinkingDepth) => void;
  loading: boolean;
  streaming: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  onSend: () => void;
  // Model selector props (Track A)
  chatModel: ChatModelOption | null;
  chatModels: ChatModelOption[];
  onModelChange: (m: ChatModelOption) => void;
  userTier: TierType;
  isModelsLoading: boolean;
  modelsError: boolean;
  onModelsRetry: () => void;
}

export function ChatInputBar({
  input, setInput, mode, setMode,
  thinkingDepth, setThinkingDepth,
  loading, streaming, error, setError, onSend,
  chatModel, chatModels, onModelChange, userTier,
  isModelsLoading, modelsError, onModelsRetry,
}: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [setInput]);

  const cycleDepth = useCallback(() => {
    setThinkingDepth(thinkingDepth === 'fast' ? 'balanced' : thinkingDepth === 'balanced' ? 'deep' : 'fast');
  }, [thinkingDepth, setThinkingDepth]);

  const supportsThinking = chatModel?.supportsThinking ?? false;

  return (
    <div className="shrink-0 p-3 pt-1">
      {error && !loading ? (
        <div className="mb-2 flex items-center justify-between px-2 py-1 rounded-md bg-destructive/10">
          <p className="text-[11px] text-destructive/80 truncate flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} className="ml-2 text-destructive/50 hover:text-destructive">
            <span className="sr-only">关闭</span>✕
          </button>
        </div>
      ) : null}

      <div className="node-paper-bg dark:bg-slate-900 flex flex-col rounded-xl border-[1.5px] border-border/50 shadow-sm focus-within:border-primary/40 focus-within:shadow-md transition-all">
        <textarea
          ref={textareaRef}
          className="min-h-[40px] max-h-[120px] w-full resize-none bg-transparent px-3.5 py-3 text-[13px] text-foreground/90 placeholder:text-muted-foreground/50 focus:outline-none font-serif"
          placeholder={MODE_CONFIG[mode].hint}
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSend(); }}
          disabled={loading}
          rows={1}
        />

        <div className="flex items-center justify-between px-2 pb-2">
          {/* Left: Mode + Thinking Depth */}
          <div className="flex items-center gap-1.5" ref={dropdownRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-[1px] border-border/40 hover:border-border/60 text-foreground/80 shadow-sm"
              >
                {(() => { const I = MODE_CONFIG[mode].icon; return <I className="h-3 w-3 text-primary/80" />; })()}
                {MODE_CONFIG[mode].label}
              </button>

              {dropdownOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden py-1 z-50 origin-bottom-left animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b-[1px] border-slate-100 dark:border-slate-800 mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 font-sans">选择对话模式</span>
                  </div>
                  {(Object.entries(MODE_CONFIG) as [AIMode, typeof MODE_CONFIG[AIMode]][]).map(([key, cfg]) => {
                    const active = mode === key;
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setMode(key); setDropdownOpen(false); }}
                        className={`w-full text-left flex items-start gap-2.5 px-3 py-2 transition-colors ${active ? 'bg-primary/5 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <div className={`mt-0.5 p-1 rounded-md ${active ? 'bg-primary/10 dark:bg-primary/30 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground'}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1">
                          <div className={`text-[12px] font-semibold font-serif leading-tight ${active ? 'text-primary' : 'text-foreground/90'}`}>{cfg.label}</div>
                          <div className="text-[10px] text-muted-foreground/80 font-serif leading-snug mt-0.5">{cfg.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {supportsThinking && (
              <>
                <div className="h-3 w-px bg-border/30 mx-1" />
                <button type="button" onClick={cycleDepth}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${DEPTH_CONFIG[thinkingDepth].color}`}
                  title={`思考深度: ${DEPTH_CONFIG[thinkingDepth].label}`}>
                  <Route className="h-3 w-3" />{DEPTH_CONFIG[thinkingDepth].label}
                </button>
              </>
            )}
          </div>

          {/* Right: Model selector + Status + Send */}
          <div className="flex items-center gap-1.5">
            <ModelSelector
              value={chatModel}
              options={chatModels}
              onChange={onModelChange}
              userTier={userTier}
              isLoading={isModelsLoading}
              isError={modelsError}
              onRetry={onModelsRetry}
            />
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${streaming ? 'text-primary bg-primary/10' : 'text-muted-foreground/40'}`}>
              {streaming ? '● 流式' : '○ 就绪'}
            </span>
            <button onClick={onSend} disabled={loading && !streaming}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${streaming ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20' : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:-translate-y-0.5'}`}
              title={streaming ? '停止' : '发送'}>
              {loading && !streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : streaming ? <Square className="h-3 w-3 fill-current" /> : <ArrowRight className="h-4 w-4" strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
