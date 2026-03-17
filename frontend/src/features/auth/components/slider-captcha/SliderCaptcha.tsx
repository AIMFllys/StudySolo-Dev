'use client';

import { memo } from 'react';
import { AlertCircle, Check, GripVertical, RefreshCw, X } from 'lucide-react';
import { HEIGHT, WIDTH } from './constants';
import { useSliderCaptcha } from './use-slider-captcha';

interface SliderCaptchaProps {
  onVerified: (token: string) => void;
  disabled?: boolean;
  /** If true, renders inside a modal overlay */
  modal?: boolean;
  /** Close callback for modal mode */
  onClose?: () => void;
}

function SliderCaptcha({ onVerified, disabled = false, modal = false, onClose }: SliderCaptchaProps) {
  const {
    canvasRef,
    blockRef,
    sliderLeft,
    verified,
    verifying,
    failed,
    apiError,
    isDragging,
    canvasReady,
    handleDragStart,
    refresh,
  } = useSliderCaptcha({ disabled, onVerified });

  const captchaContent = (
    <div className="flex flex-col gap-2 w-full max-w-[360px]">
      <div
        className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
        style={{ width: '100%', height: HEIGHT }}
      >
        {canvasReady ? (
          <>
            <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block w-full h-full" />
            <canvas
              ref={blockRef}
              width={WIDTH}
              height={HEIGHT}
              className="absolute top-0 left-0"
              style={{
                transition: isDragging.current ? 'none' : 'left 0.3s ease',
                filter: verified
                  ? 'drop-shadow(0 0 10px rgba(16,185,129,0.5))'
                  : failed
                    ? 'drop-shadow(0 0 10px rgba(239,68,68,0.5))'
                    : 'drop-shadow(2px 0 6px rgba(0,0,0,0.3))',
              }}
            />
            {verified ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50 px-4 py-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-600">验证通过</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={refresh}
                className="absolute top-2 right-2 rounded-lg border border-slate-300 bg-white/80 p-1.5 text-slate-500 backdrop-blur-sm transition-all hover:bg-white hover:text-slate-700"
                title="刷新验证码"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center text-xs text-slate-500" style={{ height: HEIGHT }}>
            加载验证码…
          </div>
        )}
      </div>

      <div
        className={`relative h-10 select-none overflow-hidden rounded-lg border transition-all duration-300 w-full ${
          verified
            ? 'border-emerald-300 bg-emerald-50'
            : failed
              ? 'border-red-300 bg-red-50'
              : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div
          className={`absolute inset-y-0 left-0 transition-colors ${
            verified ? 'bg-emerald-100' : failed ? 'bg-red-100' : 'bg-blue-50'
          }`}
          style={{ width: sliderLeft + 40 }}
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={`text-xs font-medium transition-all ${
              verified
                ? 'text-emerald-600'
                : failed
                  ? 'text-red-500'
                  : sliderLeft > 5
                    ? 'opacity-0'
                    : 'text-slate-400'
            }`}
          >
            {verified
              ? '✓ 人机验证通过'
              : failed
                ? apiError
                  ? '验证服务异常，请稍后重试'
                  : '拼合不准确，请重试'
                : verifying
                  ? '验证中...'
                  : '拖动滑块完成拼图验证'}
          </span>
        </div>

        <div
          className={`absolute left-0 top-0 flex h-full w-10 items-center justify-center rounded-lg transition-all duration-200 ${
            verified
              ? 'cursor-default bg-emerald-500 shadow-md'
              : failed
                ? 'cursor-not-allowed bg-red-400'
                : 'cursor-grab border border-slate-300 bg-white hover:bg-slate-50 active:cursor-grabbing active:bg-blue-500 active:border-blue-500 active:shadow-md'
          } ${disabled && !verified ? 'cursor-default opacity-50' : ''}`}
          style={{
            transform: `translateX(${sliderLeft}px)`,
            transition: isDragging.current ? 'none' : 'transform 0.3s ease',
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            handleDragStart(event.clientX);
          }}
          onTouchStart={(event) => handleDragStart(event.touches[0].clientX)}
        >
          {verified ? (
            <Check className="h-4 w-4 text-white" strokeWidth={3} />
          ) : failed ? (
            <AlertCircle className="h-4 w-4 text-white" />
          ) : (
            <GripVertical className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>
    </div>
  );

  if (modal) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
        <div
          className="relative bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">安全验证</h3>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4">请拖动滑块完成拼图以确认你的身份</p>
          {captchaContent}
        </div>
      </div>
    );
  }

  return captchaContent;
}

export default memo(SliderCaptcha);
