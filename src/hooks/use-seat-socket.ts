//WebSocket 연결과 메시지 수신 및 자동 재연결 처리 코드
import { useEffect, useRef, useState } from 'react'

type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed'

export function useSeatSocket(onMessage?: (data: unknown) => void) {
  const [state, setState] = useState<ConnectionState>('idle')
  const callback = useRef(onMessage)

  useEffect(() => {
    callback.current = onMessage
  }, [onMessage])

  useEffect(() => {
    const url = import.meta.env.VITE_WS_URL
    if (!url) return

    let socket: WebSocket | undefined
    let retryId: number | undefined
    let cancelled = false

    const connect = () => {
      setState('connecting')
      socket = new WebSocket(url)
      socket.onopen = () => setState('open')
      socket.onmessage = (event) => {
        try { callback.current?.(JSON.parse(event.data)) } catch { callback.current?.(event.data) }
      }
      socket.onclose = () => {
        setState('closed')
        if (!cancelled) retryId = window.setTimeout(connect, 3_000)
      }
    }

    connect()
    return () => {
      cancelled = true
      if (retryId) window.clearTimeout(retryId)
      socket?.close()
    }
  }, [])

  return state
}
