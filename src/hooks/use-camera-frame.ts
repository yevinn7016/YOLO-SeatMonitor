import { useEffect, useState } from 'react'
import { getCameraFrameUrl } from '@/lib/api-client'

export function useCameraFrame(intervalMs = 500) {
  const [url, setUrl] = useState(() => getCameraFrameUrl())

  useEffect(() => {
    const timer = window.setInterval(() => setUrl(getCameraFrameUrl()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return url
}
