import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useCameraFrame } from '@/hooks/use-camera-frame'
import { useSeatEvents } from '@/hooks/use-seat-events'
import { useHealthQuery, useLayoutQuery, useSeatsQuery } from '@/hooks/use-seat-api'
import type { ApiSeatStatus, SeatState } from '@/types/seat'

type StatusMeta = { label: string; cardBackground: string; border: string; badgeBackground: string; badgeText: string; stroke: string; fill: string }

const statusMeta: Record<ApiSeatStatus, StatusMeta> = {
  empty: { label: '사용 가능', cardBackground: '#d1fae5', border: '#10b981', badgeBackground: '#a7f3d0', badgeText: '#065f46', stroke: '#10b981', fill: 'rgba(16,185,129,.20)' },
  occupied: { label: '사용 중', cardBackground: '#fee2e2', border: '#ef4444', badgeBackground: '#fecaca', badgeText: '#991b1b', stroke: '#ef4444', fill: 'rgba(239,68,68,.20)' },
  away: { label: '자리 비움', cardBackground: '#fef3c7', border: '#f59e0b', badgeBackground: '#fde68a', badgeText: '#92400e', stroke: '#f59e0b', fill: 'rgba(245,158,11,.20)' },
  noshow: { label: '노쇼', cardBackground: '#f3e8ff', border: '#a855f7', badgeBackground: '#e9d5ff', badgeText: '#6b21a8', stroke: '#a855f7', fill: 'rgba(168,85,247,.20)' },
}
const unknownMeta: StatusMeta = { label: '상태 미확인', cardBackground: '#f8fafc', border: '#94a3b8', badgeBackground: '#e2e8f0', badgeText: '#475569', stroke: '#64748b', fill: 'rgba(100,116,139,.18)' }

function getStatusMeta(status?: string) {
  return status && status in statusMeta ? statusMeta[status as ApiSeatStatus] : unknownMeta
}

function detectionNames(seat: SeatState) {
  return [...new Set(seat.detections.map((detection) => detection.class_name).filter(Boolean))]
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '시간 정보 없음' : date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

export function LiveCameraPanel() {
  const health = useHealthQuery()
  const layout = useLayoutQuery()
  const seats = useSeatsQuery()
  const sse = useSeatEvents()
  const { frame, hasLoadError } = useCameraFrame()
  const seatList = useMemo(() => seats.data ?? [], [seats.data])
  const seatsById = useMemo(() => new Map(seatList.map((seat) => [seat.seat_id, seat])), [seatList])
  const counts = useMemo(() => ({
    empty: seatList.filter((seat) => seat.status === 'empty').length,
    occupied: seatList.filter((seat) => seat.status === 'occupied').length,
    away: seatList.filter((seat) => seat.status === 'away').length,
    noshow: seatList.filter((seat) => seat.status === 'noshow').length,
  }), [seatList])
  const reload = () => { layout.refetch(); seats.refetch(); health.refetch() }

  return <div className="space-y-5">
    <section className="grid gap-4 sm:grid-cols-3">
      <div className="surface p-4"><span className="text-xs text-slate-400">백엔드</span><strong className={`mt-2 flex items-center gap-2 text-sm ${health.data?.status === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}>{health.data?.status === 'ok' ? <Wifi size={16} /> : <WifiOff size={16} />}{health.data?.status === 'ok' ? '연결됨' : '연결 확인 중'}</strong></div>
      <div className="surface p-4"><span className="text-xs text-slate-400">현재 모드</span><strong className="mt-2 block text-sm text-slate-800">실시간 카메라</strong></div>
      <div className="surface p-4"><span className="text-xs text-slate-400">SSE</span><strong className={`mt-2 block text-sm ${sse === 'open' ? 'text-emerald-700' : 'text-amber-600'}`}>{sse === 'open' ? '연결됨' : '재연결 중'}</strong></div>
    </section>
    <section className="camera-seat-grid grid items-start gap-5">
      <div className="surface p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">카메라 분석 화면</h2><p className="mt-1 text-xs text-slate-400">저장된 ROI {layout.data?.seats.length ?? 0}개 · 카메라 {health.data?.camera_connected ? '연결됨' : '연결 안 됨'}</p></div><Button variant="outline" onClick={reload}><RefreshCw size={15} className="mr-2" />상태 새로고침</Button></div>
        <div className="relative mt-5 aspect-video overflow-hidden rounded-xl bg-slate-950">
          {frame && <img src={frame.url} alt="실시간 카메라 프레임" className="size-full object-contain" />}
          {layout.data?.seats.map((layoutSeat) => {
            const state = seatsById.get(layoutSeat.seat_id)
            const meta = getStatusMeta(state?.status)
            const firstPoint = layoutSeat.polygon[0]
            return <svg key={layoutSeat.seat_id} className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
              <polygon points={layoutSeat.polygon.map((point) => `${point.x * 1000},${point.y * 1000}`).join(' ')} fill={meta.fill} stroke={meta.stroke} strokeWidth="4" vectorEffect="non-scaling-stroke" />
              <text x={firstPoint.x * 1000 + 5} y={Math.max(16, firstPoint.y * 1000 - 5)} fill={meta.stroke} stroke="rgba(2,6,23,.85)" strokeWidth="2.5" paintOrder="stroke" fontSize="13" fontWeight="700">{layoutSeat.seat_id}</text>
            </svg>
          })}
        </div>
        {hasLoadError && <p className="mt-3 text-sm text-rose-600">카메라 프레임을 불러오지 못했습니다.</p>}
      </div>
      <aside className="surface flex max-h-[620px] min-h-0 flex-col p-5 lg:h-full">
        <h2 className="font-bold text-slate-900">좌석 상태</h2><p className="mt-1 text-xs text-slate-400">YOLO 판정 및 최근 탐지 클래스</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold"><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">전체 {seatList.length}</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">사용 가능 {counts.empty}</span><span className="rounded-full bg-red-100 px-2 py-1 text-red-700">사용 중 {counts.occupied}</span><span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">자리 비움 {counts.away}</span><span className="rounded-full bg-purple-100 px-2 py-1 text-purple-700">노쇼 {counts.noshow}</span></div>
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {seatList.map((seat) => {
            const meta = getStatusMeta(seat.status)
            const names = detectionNames(seat)
            return <article key={seat.seat_id} className="rounded-xl border p-3" style={{ backgroundColor: meta.cardBackground, borderColor: meta.border, borderLeftColor: meta.border, borderLeftWidth: 4 }}><div className="flex items-center justify-between gap-3"><strong className="truncate text-xs text-slate-900">{seat.seat_id}</strong><span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: meta.badgeBackground, color: meta.badgeText }}>{meta.label}</span></div><div className="mt-2 space-y-1 text-[11px] text-slate-500"><p className="truncate"><span className="font-medium text-slate-600">탐지:</span> {names.length ? names.join(', ') : '없음'}</p><p><span className="font-medium text-slate-600">상태 변경:</span> {formatUpdatedAt(seat.updated_at)}</p></div></article>
          })}
          {!seats.isLoading && seatList.length === 0 && <p className="py-10 text-center text-sm text-slate-400">등록된 좌석이 없습니다.</p>}
        </div>
      </aside>
    </section>
  </div>
}
