import { useEffect, useState } from 'react'
import { getCameraFrameUrl } from '@/lib/api-client'

export interface CameraFrame {
  url: string
  width: number
  height: number
}

export function useCameraFrame(intervalMs = 500) {
  const [frame, setFrame] = useState<CameraFrame | null>(null)
  const [hasLoadError, setHasLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadFrame = () => {
      const nextUrl = getCameraFrameUrl()
      const image = new window.Image()

      image.onload = () => {
        if (cancelled) return
        setHasLoadError(false)
        setFrame({
          url: nextUrl,
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      }

      image.onerror = () => {
        if (cancelled) return
        setHasLoadError(true)
      }

      image.src = nextUrl
    }

    loadFrame()
    const timer = window.setInterval(loadFrame, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [intervalMs])

  return { frame, hasLoadError }
}
