import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { seatApi } from '@/services/seat-api'
import type { NoShowSettings, SeatLayout, SeatState } from '@/types/seat'

export const queryKeys = {
  health: ['health'] as const,
  layout: ['layout'] as const,
  seats: ['seats'] as const,
  settings: ['settings'] as const,
}

// 서버,카메라,ROI 상태를 5초마다 확인
export function useHealthQuery() {
  return useQuery({ queryKey: queryKeys.health, queryFn: seatApi.getHealth, refetchInterval: 5_000 })
}

// 저장된 좌석 ROI 배치 정보 조회
export function useLayoutQuery() {
  return useQuery({ queryKey: queryKeys.layout, queryFn: seatApi.getLayout })
}

// 전체 좌석의 현재 상태 조회
export function useSeatsQuery() {
  return useQuery({
    queryKey: queryKeys.seats,
    queryFn: seatApi.getSeats,
  })
}

// 특정 좌석 타이머 초기화 후 반환된 좌석 정보만 캐시에 즉시 반영
export function useResetSeatTimerMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (seatId: string) => seatApi.resetSeatTimer(seatId),
    onSuccess: (resetSeat) => queryClient.setQueryData<SeatState[]>(queryKeys.seats, (current = []) => (
      current.some((seat) => seat.seat_id === resetSeat.seat_id)
        ? current.map((seat) => seat.seat_id === resetSeat.seat_id ? resetSeat : seat)
        : [...current, resetSeat]
    )),
  })
}

// 전체 좌석 타이머 초기화 후 서버가 반환한 최신 좌석 목록으로 캐시 교체
export function useResetAllSeatTimersMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: seatApi.resetAllSeatTimers,
    onSuccess: (seats) => queryClient.setQueryData(queryKeys.seats, seats),
  })
}

// 현재 노쇼 기준 시간 조회
export function useSettingsQuery() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: seatApi.getSettings })
}

// ROI 저장 성공 후 layout 캐시를 무효화해 서버의 최신 배치 정보를 다시 조회
export function useSaveLayoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (layout: SeatLayout) => seatApi.saveLayout(layout),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.layout }),
  })
}

// 노쇼 설정 저장 성공 후 settings 캐시를 무효화해 최신 설정을 다시 조회
export function useSaveSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: NoShowSettings) => seatApi.saveSettings(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  })
}
