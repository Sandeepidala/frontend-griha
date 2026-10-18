import { create } from 'zustand'

/** Whether the house style picker is open; the toolbar and the 3D view both open it. */
export const useStylePicker = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
