'use client';

import { useState, useEffect } from 'react';

interface VirtualKeyboardState {
  isOpen: boolean;
  height: number;
}

export function useVirtualKeyboard(): VirtualKeyboardState {
  const [keyboardState, setKeyboardState] = useState<VirtualKeyboardState>({
    isOpen: false,
    height: 0,
  });

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Check if it's a touch device
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isTouchDevice) return;

    let initialViewportHeight = window.innerHeight;

    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDiff = initialViewportHeight - currentHeight;

      // If viewport height decreased significantly (more than 150px), keyboard is likely open
      if (heightDiff > 150) {
        setKeyboardState({ isOpen: true, height: heightDiff });
      } else {
        setKeyboardState({ isOpen: false, height: 0 });
      }
    };

    const handleFocus = () => {
      // Small delay to let the keyboard animate
      setTimeout(handleResize, 100);
    };

    const handleBlur = () => {
      setTimeout(() => {
        setKeyboardState({ isOpen: false, height: 0 });
      }, 100);
    };

    // Listen for focus events on input elements
    const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
    inputs.forEach((input) => {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
    });

    window.addEventListener('resize', handleResize);

    // Update initial height when orientation changes
    const handleOrientationChange = () => {
      setTimeout(() => {
        initialViewportHeight = window.innerHeight;
      }, 300);
    };

    window.screen.orientation?.addEventListener('change', handleOrientationChange);

    return () => {
      inputs.forEach((input) => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      });
      window.removeEventListener('resize', handleResize);
      window.screen.orientation?.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  return keyboardState;
}
