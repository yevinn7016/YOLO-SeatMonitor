//카메라 이미지 위에 좌석 다각형 영역을 그리고 편집하는 코드
import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Layer, Line, Stage, Text } from 'react-konva'
import type { Point } from '@/types/seat'

export interface RoiRegion {
  id: string
  label: string
  points: Point[]
}

interface SeatRoiEditorProps {
  imageUrl: string
  regions: RoiRegion[]
  onChange: (regions: RoiRegion[]) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  drawingEnabled: boolean
  onDrawingComplete: () => void
  newRegionLabel: string
}
//좌표값이 캔버스 영역(0~1)을 벗어나지 않도록 제한
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const flattenPoints = (points: Point[], width: number, height: number) => points.flatMap((point) => [point.x * width, point.y * height])
//정규화된 ROI 좌표(0~1)를 실제 캔버스 픽셀 좌표로 변환
export function SeatRoiEditor({ imageUrl, regions, onChange, selectedId, onSelect, drawingEnabled, onDrawingComplete, newRegionLabel }: SeatRoiEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [width, setWidth] = useState(800)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [pointer, setPointer] = useState<Point | null>(null)

  //전달받은 CCTV 프레임 이미지를 로드하고, 로드 완료 후 실제 이미지 비율에 맞춰 캔버스 크기를 계산
  useEffect(() => {
    const nextImage = new window.Image()
    nextImage.onload = () => setImage(nextImage)
    nextImage.src = imageUrl
  }, [imageUrl])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (drawingEnabled) return
    const frameId = window.requestAnimationFrame(() => {
      setDraftPoints([])
      setPointer(null)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [drawingEnabled])

  const height = image ? width * (image.naturalHeight / image.naturalWidth) : width * 0.5625
  //마우스 터치 위치를 캔버스 픽셀 좌표에서 이미지 크기와 무관한 0~1 정규화 좌표로 변환
  const getPosition = (event: KonvaEventObject<MouseEvent | TouchEvent>): Point | null => {
    const position = event.target.getStage()?.getPointerPosition()
    return position ? { x: clamp(position.x / width, 0, 1), y: clamp(position.y / height, 0, 1) } : null
  }


  const finishPolygon = () => {
    if (draftPoints.length < 3) return //최소 3개의 꼭짓점이 있는 경우에만 ROI 다각형을 생성
    const region: RoiRegion = {
      id: `seat-${crypto.randomUUID()}`,
      label: newRegionLabel, //완성된 영역을 regions에 추가하고 새 영역을 선택 상태로 변경
      points: draftPoints,
    }
    onChange([...regions, region])
    onSelect(region.id)
    setDraftPoints([])
    setPointer(null)
    onDrawingComplete()
  }

  const addPoint = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.target !== event.target.getStage()) return
    if (!drawingEnabled) {
      onSelect(null)
      return
    }
    const position = getPosition(event)
    if (!position) return

    const first = draftPoints[0]
    const closeToFirst = first && Math.hypot((position.x - first.x) * width, (position.y - first.y) * height) <= 14 // 현재 위치가 첫 번째 꼭짓점과 14px 이내이고
    if (closeToFirst && draftPoints.length >= 3) { // 꼭짓점이 3개 이상이면 다각형을 닫고 ROI 생성을 완료
      finishPolygon()
      return
    }
    setDraftPoints((current) => [...current, position])
  }

  const updatePointer = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawingEnabled || draftPoints.length === 0) return
    setPointer(getPosition(event))
  }

  //선택한 ROI의 특정 꼭짓점을 드래그한 위치로 갱신
  //픽셀 좌표를 다시 0~1 정규화 좌표로 변환해 저장
  const updatePoint = (regionId: string, pointIndex: number, x: number, y: number) => {
    onChange(regions.map((region) => region.id === regionId ? {
      ...region,
      points: region.points.map((point, index) => index === pointIndex
        ? { x: clamp(x / width, 0, 1), y: clamp(y / height, 0, 1) }
        : point),
    } : region))
  }

  // ROI 전체를 드래그해서 이동할 수 있게
  const moveRegion = (regionId: string, deltaX: number, deltaY: number) => {
    const region = regions.find((item) => item.id === regionId)
    if (!region) return
    const minX = Math.min(...region.points.map((point) => point.x))
    const maxX = Math.max(...region.points.map((point) => point.x))
    const minY = Math.min(...region.points.map((point) => point.y))
    const maxY = Math.max(...region.points.map((point) => point.y))
    //전체 폴리곤이 0~1 범위 밖으로 이동하지 않도록 드래그 범위를 계산
    const normalizedX = clamp(deltaX / width, -minX, 1 - maxX)
    const normalizedY = clamp(deltaY / height, -minY, 1 - maxY)
    onChange(regions.map((item) => item.id === regionId ? {
      ...item,
      points: item.points.map((point) => ({ x: point.x + normalizedX, y: point.y + normalizedY })),
    } : item))
  }

  const draftLine = pointer && draftPoints.length > 0 ? [...draftPoints, pointer] : draftPoints

  return (
    <div ref={containerRef} className="w-full overflow-hidden bg-slate-950 touch-none">
      <Stage width={width} height={height} className={drawingEnabled ? 'cursor-crosshair' : 'cursor-default'} onClick={addPoint} onTap={addPoint} onMouseMove={updatePointer} onTouchMove={updatePointer}>
        <Layer>
          {image && <KonvaImage image={image} width={width} height={height} listening={false} />}
          {regions.map((region) => {
            const labelX = Math.min(...region.points.map((point) => point.x)) * width
            const labelY = Math.min(...region.points.map((point) => point.y)) * height
            return (
              <Group key={region.id}>
                <Group
                  draggable={!drawingEnabled}
                  onClick={() => onSelect(region.id)}
                  onTap={() => onSelect(region.id)}
                  onDragEnd={(event) => {
                    moveRegion(region.id, event.target.x(), event.target.y())
                    event.target.position({ x: 0, y: 0 })
                  }}
                >
                  <Line points={flattenPoints(region.points, width, height)} closed fill="rgba(14, 165, 233, 0.2)" stroke={selectedId === region.id ? '#f59e0b' : '#0ea5e9'} strokeWidth={selectedId === region.id ? 3 : 2} />
                  <Text x={labelX + 6} y={labelY + 6} text={region.label} fontSize={12} fontStyle="bold" fill="white" listening={false} shadowColor="black" shadowBlur={3} />
                </Group>
                {selectedId === region.id && !drawingEnabled && region.points.map((point, index) => (
                  <Circle
                    key={`${region.id}-point-${index}`}
                    x={point.x * width}
                    y={point.y * height}
                    radius={6}
                    fill="#fff"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    draggable
                    onDragMove={(event) => updatePoint(region.id, index, event.target.x(), event.target.y())}
                    onDragEnd={(event) => updatePoint(region.id, index, event.target.x(), event.target.y())}
                  />
                ))}
              </Group>
            )
          })}
          {draftLine.length > 0 && <Line points={flattenPoints(draftLine, width, height)} closed={draftPoints.length >= 3} fill="rgba(16, 185, 129, 0.18)" stroke="#10b981" strokeWidth={2} dash={[7, 5]} listening={false} />}
          {draftPoints.map((point, index) => <Circle key={`draft-${index}`} x={point.x * width} y={point.y * height} radius={index === 0 ? 7 : 5} fill={index === 0 ? '#fbbf24' : '#fff'} stroke="#10b981" strokeWidth={2} listening={false} />)}
        </Layer>
      </Stage>
      {drawingEnabled && (
        <div className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-xs text-slate-200">
          <span>{draftPoints.length < 3 ? `꼭짓점을 ${3 - draftPoints.length}개 이상 더 찍어주세요.` : '첫 점을 클릭하거나 완료 버튼을 누르세요.'}</span>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-slate-600 px-3 py-1.5 disabled:opacity-40" disabled={draftPoints.length === 0} onClick={() => setDraftPoints((current) => current.slice(0, -1))}>이전 점 취소</button>
            <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white disabled:opacity-40" disabled={draftPoints.length < 3} onClick={finishPolygon}>영역 완료</button>
          </div>
        </div>
      )}
    </div>
  )
}
