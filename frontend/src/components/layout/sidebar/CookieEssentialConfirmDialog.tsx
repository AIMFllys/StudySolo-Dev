import { Cookie } from 'lucide-react';

interface Props {
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CookieEssentialConfirmDialog({ saving, onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-2xl border-[1.5px] border-border/50 node-paper-bg shadow-2xl p-5">
        <div className="flex items-start gap-2.5 mb-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 border border-amber-200/60">
            <Cookie className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground tracking-wide">仅使用必要 Cookie？</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">此操作将影响部分体验功能</p>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-amber-50/50 border border-amber-200/40 px-3 py-2.5 text-[10px] text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground text-[10px] mb-1.5">以下功能可能受到影响：</p>
          <div className="flex items-start gap-1.5">
            <span className="text-amber-500 mt-px">•</span>
            <span>访问数据与会话行为分析将被禁用</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-amber-500 mt-px">•</span>
            <span>偏好记忆（如主题、布局）可能在跨设备间不同步</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-amber-500 mt-px">•</span>
            <span>部分第三方集成功能（如内嵌内容）可能无法正常工作</span>
          </div>
        </div>

        <p className="mb-4 text-[10px] text-muted-foreground leading-relaxed bg-background/50 rounded-lg border border-border/40 px-3 py-2">
          📋 我们承诺：无论您的选择如何，我们均会严格遵照{' '}
          <a
            href="https://docs.1037solo.com/#/docs/studysolo-cookie"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline underline-offset-2 font-medium"
          >
            Cookie 政策
          </a>
          {' '}及 GDPR 等相关法规采集、使用 Cookie 数据，绝不将数据用于授权范围之外的用途。
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-8 rounded-lg border-[1.5px] border-border/50 bg-background/50 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 h-8 rounded-lg bg-amber-500 text-white text-[10px] font-medium hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {saving ? '保存中...' : '确认，仅必要 Cookie'}
          </button>
        </div>
      </div>
    </div>
  );
}
