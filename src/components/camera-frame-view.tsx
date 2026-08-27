import { cn } from '@/lib/utils'

interface CameraFrameViewProps {
  imageUrl: string | null
  naturalWidth?: number
  naturalHeight?: number
  alt: string
  className?: string
  onLoad?: () => void
  onError?: () => void
}

export function CameraFrameView({
  imageUrl,
  naturalWidth,
  naturalHeight,
  alt,
  className,
  onLoad,
  onError,
}: CameraFrameViewProps) {
  const aspectRatio = naturalWidth && naturalHeight && naturalHeight > 0
    ? `${naturalWidth} / ${naturalHeight}`
    : '16 / 9'

  return (
    <div
      className={cn('relative w-full min-h-[240px] overflow-hidden bg-slate-900', className)}
      style={{ aspectRatio }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={alt}
          className="absolute inset-0 size-full"
          onLoad={onLoad}
          onError={onError}
        />
      )}
    </div>
  )
}

export function loadImageDimensions(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('이미지 크기를 읽을 수 없습니다.'))
    image.src = url
  })
}
