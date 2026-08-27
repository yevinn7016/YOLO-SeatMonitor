import { apiRequest, getApiUrl } from '@/lib/api-client'
import type { SeatLayout } from '@/types/seat'

export type DemoPlaybackStatus = 'idle' | 'uploaded' | 'playing' | 'completed' | 'stopped' | 'error'

export interface UploadedDemoVideo {
  video_id: string
  filename: string
  status: 'uploaded'
  duration_seconds: number
  fps: number
  total_frames: number
}

export interface DemoStatus {
  mode: 'demo' | 'camera' | string
  video_id: string | null
  status: DemoPlaybackStatus
  current_frame: number
  total_frames: number
  current_seconds: number
  duration_seconds: number
  progress: number
  error: string | null
}

let enterRequest: Promise<unknown> | null = null

export const demoApi = {
  enterDemo: () => {
    if (!enterRequest) {
      enterRequest = apiRequest('/demo/enter', { method: 'POST' }).catch((error) => {
        enterRequest = null
        throw error
      })
    }
    return enterRequest
  },
  uploadVideo: (file: File) => {
    const formData = new FormData()
    formData.append('video', file)
    return apiRequest<UploadedDemoVideo>('/demo/video', { method: 'POST', body: formData })
  },
  getLayout: () => apiRequest<SeatLayout>('/demo/layout'),
  saveLayout: (layout: SeatLayout) => apiRequest<SeatLayout | void>('/demo/layout', {
    method: 'PUT',
    body: JSON.stringify(layout),
  }),
  startDemo: (videoId: string) => apiRequest('/demo/start', {
    method: 'POST',
    body: JSON.stringify({ video_id: videoId }),
  }),
  getStatus: () => apiRequest<DemoStatus>('/demo/status'),
  stopDemo: () => apiRequest('/demo/stop', { method: 'POST' }),
  exitDemo: async () => {
    const result = await apiRequest('/demo/exit', { method: 'POST' })
    enterRequest = null
    return result
  },
  previewUrl: () => `${getApiUrl('/demo/preview.jpg')}?t=${Date.now()}`,
  streamUrl: () => `${getApiUrl('/demo/stream')}?t=${Date.now()}`,
}
