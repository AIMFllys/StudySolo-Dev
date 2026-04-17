'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';

interface TouchState {
  isPinching: boolean;
  isDragging: boolean;
  lastTouchDistance: number;
  lastTouchCenter: { x: number; y: number } | null;
}

interface UseCanvasTouchOptions {
  reactFlowInstance: ReactFlowInstance | null;
  enablePinchZoom?: boolean;
  enablePan?: boolean;
  onNodeLongPress?: (nodeId: string, position: { x: number; y: number }) => void;
  onCanvasLongPress?: (position: { x: number; y: number }) => void;
}

export function useCanvasTouch({
  reactFlowInstance,
  enablePinchZoom = true,
  enablePan = true,
  onNodeLongPress,
  onCanvasLongPress,
}: UseCanvasTouchOptions) {
  const touchState = useRef<TouchState>({
    isPinching: false,
    isDragging: false,
    lastTouchDistance: 0,
    lastTouchCenter: null,
  });

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [selectedNodeForMenu, setSelectedNodeForMenu] = useState<string | null>(null);

  // Calculate distance between two touch points
  const getTouchDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate center between two touch points
  const getTouchCenter = useCallback((touches: TouchList): { x: number; y: number } | null => {
    if (touches.length < 2) return null;
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  // Handle touch start
  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const touches = event.touches;

      // Handle pinch start (2 fingers)
      if (enablePinchZoom && touches.length === 2 && reactFlowInstance) {
        touchState.current.isPinching = true;
        touchState.current.lastTouchDistance = getTouchDistance(touches);
        touchState.current.lastTouchCenter = getTouchCenter(touches);
        return;
      }

      // Handle long press start (1 finger)
      if (touches.length === 1) {
        const touch = touches[0];
        touchStartPos.current = { x: touch.clientX, y: touch.clientY };

        longPressTimer.current = setTimeout(() => {
          setIsLongPressing(true);

          // Determine if touching a node or canvas
          const target = event.target as HTMLElement;
          const nodeElement = target.closest('[data-id]');
          const nodeId = nodeElement?.getAttribute('data-id');

          if (nodeId && onNodeLongPress) {
            setSelectedNodeForMenu(nodeId);
            onNodeLongPress(nodeId, { x: touch.clientX, y: touch.clientY });
          } else if (onCanvasLongPress) {
            onCanvasLongPress({ x: touch.clientX, y: touch.clientY });
          }
        }, 500); // 500ms long press
      }
    },
    [enablePinchZoom, getTouchDistance, getTouchCenter, reactFlowInstance, onNodeLongPress, onCanvasLongPress]
  );

  // Handle touch move
  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      const touches = event.touches;

      // Handle pinch zoom
      if (enablePinchZoom && touchState.current.isPinching && touches.length === 2 && reactFlowInstance) {
        event.preventDefault();

        const currentDistance = getTouchDistance(touches);
        const currentCenter = getTouchCenter(touches);
        const scale = currentDistance / touchState.current.lastTouchDistance;

        if (scale !== 1 && scale > 0) {
          const currentZoom = reactFlowInstance.getZoom();
          const newZoom = Math.max(0.2, Math.min(2, currentZoom * scale));

          if (currentCenter && touchState.current.lastTouchCenter) {
            reactFlowInstance.zoomTo(newZoom, {
              duration: 0,
            });
          }
        }

        touchState.current.lastTouchDistance = currentDistance;
        touchState.current.lastTouchCenter = currentCenter;
        return;
      }

      // Cancel long press if moved too much
      if (touches.length === 1 && touchStartPos.current && longPressTimer.current) {
        const touch = touches[0];
        const dx = Math.abs(touch.clientX - touchStartPos.current.x);
        const dy = Math.abs(touch.clientY - touchStartPos.current.y);

        if (dx > 10 || dy > 10) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    },
    [enablePinchZoom, getTouchDistance, getTouchCenter, reactFlowInstance]
  );

  // Handle touch end
  const onTouchEnd = useCallback(() => {
    // Reset pinch state
    touchState.current.isPinching = false;
    touchState.current.lastTouchDistance = 0;
    touchState.current.lastTouchCenter = null;

    // Cancel long press
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    setTimeout(() => setIsLongPressing(false), 100);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    isLongPressing,
    selectedNodeForMenu,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
