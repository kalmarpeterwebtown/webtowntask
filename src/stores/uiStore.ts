import { create } from 'zustand'
import type { ModalState, ToastMessage } from '@/types/ui'

interface UiState {
  sidebarOpen: boolean
  modal: ModalState
  toasts: ToastMessage[]
  searchOpen: boolean
  notificationPanelOpen: boolean

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openModal: (type: ModalState['type'], data?: unknown) => void
  closeModal: () => void
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  removeToast: (id: string) => void
  setSearchOpen: (open: boolean) => void
  setNotificationPanelOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: true,
  modal: { type: null },
  toasts: [],
  searchOpen: false,
  notificationPanelOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  openModal: (type, data) => set({ modal: { type, data } }),
  closeModal: () => set({ modal: { type: null } }),

  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random()}`
    const duration = toast.duration ?? 4000
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration)
    }
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setSearchOpen: (open) => set({ searchOpen: open }),
  setNotificationPanelOpen: (open) => set({ notificationPanelOpen: open }),
}))

// Convenience helper: toast shortcuts
export const toast = {
  success: (message: string) =>
    useUiStore.getState().addToast({ type: 'success', message }),
  error: (message: string) =>
    useUiStore.getState().addToast({ type: 'error', message }),
  warning: (message: string) =>
    useUiStore.getState().addToast({ type: 'warning', message }),
  info: (message: string) =>
    useUiStore.getState().addToast({ type: 'info', message }),
}
