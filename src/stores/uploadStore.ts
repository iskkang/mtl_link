import { create } from 'zustand'

export type UploadPhase =
  | 'parsing'
  | 'embedding'
  | 'done'
  | 'cancelled'
  | 'failed'

interface UploadState {
  active:      boolean
  uploadId:    string | null
  fileName:    string | null
  title:       string | null
  phase:       UploadPhase | null
  current:     number
  total:       number
  message:     string
  controller:  AbortController | null

  start:          (p: { uploadId: string; fileName: string; title: string; controller: AbortController }) => void
  updateProgress: (p: { phase: UploadPhase; current: number; total: number; message: string }) => void
  cancel:         () => void
  finish:         (phase: 'done' | 'cancelled' | 'failed') => void
  reset:          () => void
}

const INITIAL: Omit<UploadState, 'start' | 'updateProgress' | 'cancel' | 'finish' | 'reset'> = {
  active:     false,
  uploadId:   null,
  fileName:   null,
  title:      null,
  phase:      null,
  current:    0,
  total:      0,
  message:    '',
  controller: null,
}

export const useUploadStore = create<UploadState>((set, get) => ({
  ...INITIAL,

  start: ({ uploadId, fileName, title, controller }) =>
    set({
      active: true,
      uploadId,
      fileName,
      title,
      controller,
      phase:   'parsing',
      current: 0,
      total:   1,
      message: '준비 중...',
    }),

  updateProgress: ({ phase, current, total, message }) =>
    set({ phase, current, total, message }),

  cancel: () => {
    get().controller?.abort()
  },

  finish: (phase) =>
    set({ phase, active: false, controller: null }),

  reset: () => set(INITIAL),
}))
