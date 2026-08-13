import { create } from 'zustand'

interface EditorState {
  selectedSeatId: string | null
  selectSeat: (id: string | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedSeatId: null,
  selectSeat: (selectedSeatId) => set({ selectedSeatId }),
}))
