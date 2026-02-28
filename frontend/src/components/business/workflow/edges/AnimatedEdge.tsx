'use client';

import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

/**
 * Custom animated edge with primary color gradient and pulse animation.
 * Active edges (animated=true) get a flowing gradient effect.
 */
function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  animated,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const gradientId = `edge-gradient-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366F1" stopOpacity={animated ? 0.8 : 0.3} />
          <stop offset="50%" stopColor="#818CF8" stopOpacity={animated ? 1 : 0.4} />
          <stop offset="100%" stopColor="#10B981" stopOpacity={animated ? 0.8 : 0.3} />
        </linearGradient>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: `url(#${gradientId})`,
          strokeWidth: 2,
          ...style,
        }}
        className={animated ? 'edge-animated-pulse' : ''}
      />
      {/* Glow layer for active edges */}
      {animated && (
        <path
          d={edgePath}
          fill="none"
          stroke="#6366F1"
          strokeWidth={6}
          strokeOpacity={0.15}
          className="edge-animated-pulse"
        />
      )}
    </>
  );
}

export default memo(AnimatedEdge);
