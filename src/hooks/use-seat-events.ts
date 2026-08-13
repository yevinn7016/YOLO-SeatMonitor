import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getApiUrl } from '@/lib/api-client'
import { queryKeys } from '@/hooks/use-seat-api'
import type { SeatState } from '@/types/seat'

export type SeatEventConnectionState = 'connecting' | 'open' | 'closed'

export function useSeatEvents() {
  const queryClient = useQueryClient()

  //SSE 연결 상태를 관리하여 서버와의 실시간 연결 여부를 확인
  const [state, setState] = useState<SeatEventConnectionState>(() => (
    typeof EventSource === 'undefined' ? 'closed' : 'connecting'
  ))

  useEffect(() => {
    //브라우저가 SSE(EventSource)를 지원하지 않는 경우 연결하지 않음
    if (typeof EventSource === 'undefined') return

    const events = new EventSource(getApiUrl('/seats/stream'))

    events.onopen = () => setState('open')

    //벡엔드 서버에서 전달받은 최신 좌석 상태를 TanStack Query 캐시에 반영
    //기존 주기적 polling 없이 상태 변경을 즉시 화면에 업데이트
    events.onmessage = (event) => {
      try {
        const seats = JSON.parse(event.data) as SeatState[]
        if (Array.isArray(seats)) queryClient.setQueryData(queryKeys.seats, seats)
      } catch {
        // Ignore malformed events and keep the last valid seat snapshot.
      }
    }
    events.onerror = () => setState('closed')

    return () => events.close()
  }, [queryClient])

  return state
}
