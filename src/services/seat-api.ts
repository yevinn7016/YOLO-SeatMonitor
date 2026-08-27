//백엔드 API 모음 파일?
import { apiRequest } from '@/lib/api-client'
import type { HealthStatus, LayoutSuggestionResponse, NoShowSettings, SeatLayout, SeatState } from '@/types/seat'

function suggestionImageName(image: Blob) {
  if (image.type === 'image/png') return 'frame.png'
  if (image.type === 'image/webp') return 'frame.webp'
  return 'frame.jpg'
}

export const seatApi = {
  //서버, 카메라, ROI 설정 상태 확인
  getHealth: () => apiRequest<HealthStatus>('/health'),

  //저장된 좌석 ROI 배치 정보 조회
  getLayout: () => apiRequest<SeatLayout>('/layout'),

  //관리자가 설정한 좌석 ROI 배치 정보를 서버에 저장
  saveLayout: (layout: SeatLayout) => apiRequest<SeatLayout | void>('/layout', {
    method: 'PUT',
    body: JSON.stringify(layout),
  }),

  //캡처한 카메라 이미지로 AI 좌석 ROI 후보를 생성
  createLayoutSuggestion: (image: Blob, additionalInstructions?: string) => {
    const formData = new FormData()
    formData.append('image', image, suggestionImageName(image))
    if (additionalInstructions) formData.append('additional_instructions', additionalInstructions)
    return apiRequest<LayoutSuggestionResponse>('/layout/suggestions', {
      method: 'POST',
      body: formData,
    })
  },

  //전체 좌석의 현재 상태 조회
  getSeats: () => apiRequest<SeatState[]>('/seats'),

  //특정 좌석의 자리 노쇼 타이머 초기화
  resetSeatTimer: (seatId: string) => apiRequest<SeatState>(`/seats/${encodeURIComponent(seatId)}/reset`, {
    method: 'POST',
  }),

  //모든 좌석의 자리 노쇼 타이머 일괄 초기화
  resetAllSeatTimers: () => apiRequest<SeatState[]>('/seats/reset', {
    method: 'POST',
  }),

  // 현재 설정된 노쇼 기준 시간 조회
  getSettings: () => apiRequest<NoShowSettings>('/settings'),

  // 관리자가 변경한 노쇼 기준 시간을 서버에 저장
  saveSettings: (settings: NoShowSettings) => apiRequest<NoShowSettings | void>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),
}
