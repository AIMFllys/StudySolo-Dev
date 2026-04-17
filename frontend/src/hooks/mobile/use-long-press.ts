'use client';

import { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  threshold?: number;
  onStart?: () => void;
  onFinish?: () => void;
  onCancel?: () => void;
}

interface Position {
  x: number;
  y: number;
}

export function useLongPress(
  callback: () => void,
  options: UseLongPressOptions = {}
) {
  const { threshold = 500, onStart, onFinish, onCancel } = options;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<Position | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Get position for touch or mouse event
      const clientX =
        'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY =
        'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      startPosRef.current = { x: clientX, y: clientY };
      setIsPressing(true);
      onStart?.();

      timerRef.current = setTimeout(() => {
        callback();
        onFinish?.();
        setIsPressing(false);
      }, threshold);
    },
    [callback, threshold, onStart, onFinish]
  );

  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!timerRef.current || !startPosRef.current) return;

      const clientX =
        'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY =
        'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      const dx = Math.abs(clientX - startPosRef.current.x);
      const dy = Math.abs(clientY - startPosRef.current.y);

      // Cancel if moved more than 10px
      if (dx > 10 || dy > 10) {
        cancel();
      }
    },
    []
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    setIsPressing(false);
    onCancel?.();
  }, [onCancel]);

  return {
    onMouseDown: start as (e: React.MouseEvent) => void,
    onMouseMove: move as (e: React.MouseEvent) => void,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start as (e: React.TouchEvent) => void,
    onTouchMove: move as (e: React.TouchEvent) => void,
    onTouchEnd: cancel,
    isPressing,
  };
}
