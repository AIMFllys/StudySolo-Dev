import { create } from 'zustand';
import type { AdminProfile } from '@/services/admin.service';

interface AdminStore {
  admin: AdminProfile | null;
  sidebarOpen: boolean;
  setAdmin: (admin: AdminProfile | null) => void;
  toggleSidebar: () => void;
  clearAdmin: () => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  admin: null,
  sidebarOpen: true,

  setAdmin: (admin) => set({ admin }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  clearAdmin: () => set({ admin: null }),
}));
