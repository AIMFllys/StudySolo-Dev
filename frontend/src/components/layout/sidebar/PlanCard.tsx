import { CheckCircle2, Circle, Loader } from 'lucide-react';
import { parsePlanResponse, type ParsedPlan, type PlanStep } from '@/features/workflow/utils/parse-plan-xml';
import { useState, useMemo } from 'react';
import { useActionExecutor } from '@/features/workflow/hooks/use-action-executor';
import { planStepsToActions } from '@/features/workflow/utils/plan-executor';

interface PlanCardProps {
  rawContent: string;
  onApply?: () => void;
}

export function PlanCard({ rawContent, onApply }: PlanCardProps) {
  const { execute } = useActionExecutor();
  const parsed = useMemo(() => parsePlanResponse(rawContent), [rawContent]);
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(() => {
    const s = new Set<string>();
    parsed.recommendations.forEach(r => { if (r.selected) s.add(r.id); });
    return s;
  });
  const [applying, setApplying] = useState(false);

  // 如果解析到了纯文本降级，则直接返回纯文本 (外部可能是使用 Markdown 渲染的)
  if (parsed.parseLevel === 'raw') {
    return <div className="whitespace-pre-wrap font-serif text-[12px]">{rawContent}</div>;
  }

  const toggleStep = (id: string) => {
    const next = new Set(selectedSteps);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSteps(next);
  };

  const handleApply = async () => {
    if (selectedSteps.size === 0) return;
    setApplying(true);
    const actions = planStepsToActions(
      parsed.recommendations.filter((r) => selectedSteps.has(r.id)),
    );

    await execute(actions);
    setApplying(false);
    if (onApply) onApply();
  };

  return (
    <div className="flex flex-col gap-3 font-serif">
      {/* Response Text */}
      {parsed.response && (
        <div className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {parsed.response.replace(/\[SUGGEST_MODE:\w+\]/g, '')}
        </div>
      )}

      {/* Analysis Section */}
      {parsed.analysis && (
        <div className="rounded-lg border-[1.5px] border-border/40 bg-muted/20 p-2.5 text-[12px]">
          <div className="mb-2 font-semibold text-foreground/80 flex items-center gap-1.5"><span className="text-[14px]">📊</span> AI 现状分析</div>
          <p className="text-muted-foreground mb-1.5 leading-relaxed">{parsed.analysis.currentState}</p>
          <div className="flex gap-3 text-[11px]">
            {parsed.analysis.strengths && <div className="flex-1"><span className="text-green-600/80 font-medium font-sans block mb-0.5">优点</span> <span className="text-muted-foreground/80">{parsed.analysis.strengths}</span></div>}
            {parsed.analysis.gaps && <div className="flex-1"><span className="text-amber-600/80 font-medium font-sans block mb-0.5">不足</span> <span className="text-muted-foreground/80">{parsed.analysis.gaps}</span></div>}
          </div>
        </div>
      )}

      {/* Recommendations Section */}
      {parsed.recommendations.length > 0 && (
        <div className="rounded-lg border-[1.5px] border-primary/20 bg-primary/5 p-2.5">
          <div className="mb-2 font-semibold text-primary/80 text-[12px] uppercase tracking-wider font-sans">建议操作</div>
          <div className="flex flex-col gap-2">
            {parsed.recommendations.map(step => (
              <label key={step.id} className="flex items-start gap-2 cursor-pointer group">
                <div className="mt-0.5" onClick={(e) => { e.preventDefault(); toggleStep(step.id); }}>
                  {selectedSteps.has(step.id) 
                    ? <CheckCircle2 className="h-4 w-4 text-primary" /> 
                    : <Circle className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary/50 transition-colors" />
                  }
                </div>
                <div className="flex-1 text-[12px] leading-relaxed">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-sans mr-1.5 font-medium ${
                    step.priority === 'high' ? 'bg-red-500/10 text-red-600/80' : 
                    step.priority === 'medium' ? 'bg-amber-500/10 text-amber-600/80' : 
                    'bg-blue-500/10 text-blue-600/80'
                  }`}>
                    {step.priority.toUpperCase()}
                  </span>
                  <span className={`${selectedSteps.has(step.id) ? 'text-foreground/90' : 'text-muted-foreground'} transition-colors`}>
                    {step.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
          
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleApply}
              disabled={selectedSteps.size === 0 || applying}
              className="flex items-center gap-1.5 rounded-md bg-primary/90 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition-all hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? <Loader className="h-3 w-3 animate-spin" /> : '选择性执行'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
