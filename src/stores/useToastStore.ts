import { create } from 'zustand'

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

export interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (variant: ToastVariant, message: string) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (variant, message) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `toast-${Date.now()}`
    set((state) => ({ toasts: [...state.toasts, { id, variant, message }] }))
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

export const toast = {
  info: (message: string) => useToastStore.getState().addToast('info', message),
  success: (message: string) => useToastStore.getState().addToast('success', message),
  warning: (message: string) => useToastStore.getState().addToast('warning', message),
  danger: (message: string) => useToastStore.getState().addToast('danger', message),
}
