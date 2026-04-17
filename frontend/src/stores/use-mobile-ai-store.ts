import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MobileAIState {
  isOpen: boolean;
  isMinimized: boolean;
  position: { x: number; y: number };
  
  // Actions
  toggleOpen: () => void;
  open: () => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
  setPosition: (position: { x: number; y: number }) => void;
  resetPosition: () => void;
}

const defaultPosition = { x: 20, y: window?.innerHeight ? window.innerHeight - 300 : 400 };

export const useMobileAIStore = create<MobileAIState>()(
  persist(
    (set) => ({
      isOpen: false,
      isMinimized: false,
      position: defaultPosition,

      toggleOpen: () => set((state) => ({ isOpen: !state.isOpen, isMinimized: false })),
      open: () => set({ isOpen: true, isMinimized: false }),
      close: () => set({ isOpen: false, isMinimized: false }),
      minimize: () => set({ isMinimized: true }),
      restore: () => set({ isMinimized: false }),
      setPosition: (position) => set({ position }),
      resetPosition: () => set({ position: defaultPosition }),
    }),
    {
      name: 'mobile-ai-position',
      partialize: (state) => ({ position: state.position }),
    }
  )
);
