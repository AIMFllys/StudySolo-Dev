import { LogIn, X } from 'lucide-react';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function LoginPromptDialog({ onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />
      <div className="relative bg-background border border-border rounded-xl shadow-xl px-6 py-5 max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in duration-200">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <LogIn className="h-5 w-5 text-foreground" />
          </div>
          <h3 className="text-sm font-serif font-semibold text-foreground">需要登录</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            此操作需要登录后才能使用。<br />
            是否跳转至登录页面？
          </p>
          <div className="flex items-center gap-2 mt-1 w-full">
            <button
              onClick={onCancel}
              className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              暂不登录
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-md bg-foreground text-background px-3 py-2 text-xs font-medium hover:opacity-90 transition-opacity"
            >
              前往登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
