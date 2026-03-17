'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HEIGHT, PIECE_RADIUS, PIECE_SIZE, TOLERANCE, WIDTH } from './constants';
import { drawPath, getPieceTarget, paintBackground } from './utils';

interface SliderCaptchaApiError {
  detail?: string;
}

interface SliderCaptchaOptions {
  disabled?: boolean;
  onVerified: (token: string) => void;
}

async function readErrorDetail(response: Response) {
  try {
    return (await response.json()) as SliderCaptchaApiError;
  } catch {
    return null;
  }
}

export function useSliderCaptcha({ disabled = false, onVerified }: SliderCaptchaOptions) {
  const [seed, setSeed] = useState<number | null>(null);
  const [sliderLeft, setSliderLeft] = useState(0);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [apiError, setApiError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blockRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const originX = useRef(0);
  const challengeRef = useRef('');
  const targetXRef = useRef(0);

  const fetchChallenge = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/captcha-challenge', { method: 'POST' });
      if (!response.ok) {
        throw new Error('challenge fetch failed');
      }
      const data = await response.json();
      challengeRef.current = data.challenge;
      setSeed(data.seed);
    } catch {
      setTimeout(() => {
        void fetchChallenge();
      }, 2000);
    }
  }, []);

  useEffect(() => {
    void fetchChallenge();
  }, [fetchChallenge]);

  const draw = useCallback(() => {
    if (seed === null) return;
    const canvas = canvasRef.current;
    const block = blockRef.current;
    if (!canvas || !block) return;

    const canvasContext = canvas.getContext('2d', { willReadFrequently: true });
    const blockContext = block.getContext('2d', { willReadFrequently: true });
    if (!canvasContext || !blockContext) return;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    block.width = WIDTH;
    block.height = HEIGHT;
    block.style.left = '0px';

    const target = getPieceTarget(seed);
    targetXRef.current = target.x;

    paintBackground(canvasContext, seed);

    canvasContext.save();
    drawPath(canvasContext, target.x, target.y, 'fill');
    canvasContext.restore();

    blockContext.save();
    drawPath(blockContext, target.x, target.y, 'clip');
    blockContext.drawImage(canvas, 0, 0, WIDTH, HEIGHT);
    blockContext.restore();

    const cropStartY = target.y - PIECE_RADIUS * 2 - 1;
    const imageData = blockContext.getImageData(target.x - 3, cropStartY, PIECE_SIZE, PIECE_SIZE);
    block.width = PIECE_SIZE;
    blockContext.putImageData(imageData, 0, cropStartY);
  }, [seed]);

  useEffect(() => {
    draw();
  }, [draw]);

  const refresh = useCallback(() => {
    setSliderLeft(0);
    setVerified(false);
    setVerifying(false);
    setFailed(false);
    setApiError(false);
    setSeed(null);
    challengeRef.current = '';
    void fetchChallenge();
  }, [fetchChallenge]);

  const resetSlider = useCallback((withDelay = true) => {
    const reset = () => {
      setSliderLeft(0);
      if (blockRef.current) {
        blockRef.current.style.left = '0px';
      }
      setFailed(false);
    };
    if (withDelay) {
      setTimeout(reset, 500);
    } else {
      reset();
    }
  }, []);

  const handleDragStart = useCallback((clientX: number) => {
    if (verified || disabled || verifying || seed === null) return;
    isDragging.current = true;
    originX.current = clientX;
    setFailed(false);
    setApiError(false);
  }, [disabled, seed, verified, verifying]);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging.current) return;
    const moveX = clientX - originX.current;
    if (moveX < 0 || moveX + 38 >= WIDTH) return;

    setSliderLeft(moveX);
    const blockLeft = ((WIDTH - 40 - 20) / (WIDTH - 40)) * moveX;
    if (blockRef.current) {
      blockRef.current.style.left = `${blockLeft}px`;
    }
  }, []);

  const handleDragEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const block = blockRef.current;
    if (!block) return;

    const left = parseInt(block.style.left || '0', 10);
    if (Math.abs(left - targetXRef.current) >= TOLERANCE) {
      setFailed(true);
      resetSlider();
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch('/api/auth/captcha-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: challengeRef.current, x: left }),
      });

      if (!response.ok) {
        const data = await readErrorDetail(response);
        const detail = data?.detail ?? '';
        if (detail.includes('拼合不准确')) {
          setFailed(true);
          resetSlider();
        } else {
          setFailed(true);
          setApiError(true);
          setTimeout(refresh, 1500);
        }
        return;
      }

      const data = await response.json();
      setVerified(true);
      onVerified(data.token);
    } catch {
      setFailed(true);
      setApiError(true);
      setTimeout(refresh, 1500);
    } finally {
      setVerifying(false);
    }
  }, [onVerified, refresh, resetSlider]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => handleDragMove(event.clientX);
    const onMouseUp = () => void handleDragEnd();
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      handleDragMove(event.touches[0].clientX);
    };
    const onTouchEnd = () => void handleDragEnd();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleDragEnd, handleDragMove]);

  return {
    canvasRef,
    blockRef,
    sliderLeft,
    verified,
    verifying,
    failed,
    apiError,
    isDragging,
    canvasReady: seed !== null,
    handleDragStart,
    refresh,
  };
}
