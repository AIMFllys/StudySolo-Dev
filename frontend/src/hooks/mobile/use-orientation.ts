'use client';

import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>('portrait');

  useEffect(() => {
    const handleOrientationChange = () => {
      const angle = window.screen.orientation?.angle ?? 0;
      setOrientation(angle === 90 || angle === 270 ? 'landscape' : 'portrait');
    };

    // Initial check
    handleOrientationChange();

    // Listen for orientation changes
    window.screen.orientation?.addEventListener('change', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.screen.orientation?.removeEventListener('change', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return orientation;
}

export function useIsLandscape(): boolean {
  const orientation = useOrientation();
  return orientation === 'landscape';
}
