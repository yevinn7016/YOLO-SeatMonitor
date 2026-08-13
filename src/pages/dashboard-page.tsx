import { AlignHorizontalSpaceAround, Clock3, MapPin, RefreshCw, SlidersHorizontal, Wifi, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSeatEvents } from '@/hooks/use-seat-events'
import { useHealthQuery, useLayoutQuery, useResetAllSeatTimersMutation, useResetSeatTimerMutation, useSeatsQuery, useSettingsQuery, useSaveSettingsMutation } from '@/hooks/use-seat-api'
import type { ApiSeatStatus, SeatStatus } from '@/types/seat'

const apiStatusToUi: Record<ApiSeatStatus, SeatStatus> = {
  empty: 'available', occupied: 'occupied', away: 'away', noshow: 'noShow',
}

const statusMeta: Record<SeatStatus, { label: string; dot: string; seat: string }> = {
  available: { label: '비어 있음', dot: 'bg-emerald-500', seat: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  occupied: { label: '점유 중', dot: 'bg-brand-500', seat: 'border-blue-200 bg-blue-50 text-blue-700' },
  away: { label: '자리 비움', dot: 'bg-amber-500', seat: 'border-amber-200 bg-amber-50 text-amber-700' },
  noShow: { label: '노쇼', dot: 'bg-rose-500', seat: 'border-rose-200 bg-rose-50 text-rose-700' },
}

const DASHBOARD_SEAT_WIDTH = 0.15
const DASHBOARD_SEAT_HEIGHT = 0.12
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function createAxisClusters(values: number[], tolerance = 0.06) {
  const clusters: number[][] = []
  for (const value of [...values].sort((a, b) => a - b)) {
    const cluster = clusters.find((items) => Math.abs(items.reduce((sum, item) => sum + item, 0) / items.length - value) <= tolerance)
    if (cluster) cluster.push(value)
    else clusters.push([value])
  }
  return clusters.map((items) => items.reduce((sum, item) => sum + item, 0) / items.length)
}

function nearestAxis(value: number, axes: number[]) {
  return axes.reduce((nearest, axis) => Math.abs(axis - value) < Math.abs(nearest - value) ? axis : nearest, axes[0] ?? value)
}

export function DashboardPage() {
  const seatsQuery = useSeatsQuery()
  const seatEventsState = useSeatEvents()
  const healthQuery = useHealthQuery()
  const layoutQuery = useLayoutQuery()
  const settingsQuery = useSettingsQuery()
  const saveSettings = useSaveSettingsMutation()
  const resetSeatTimer = useResetSeatTimerMutation()
  const resetAllSeatTimers = useResetAllSeatTimersMutation()
  const [editedThresholdMinutes, setEditedThresholdMinutes] = useState<number | null>(null)
  const [isLayoutAligned, setIsLayoutAligned] = useState(true)
  const thresholdMinutes = editedThresholdMinutes
    ?? Math.ceil((settingsQuery.data?.noshow_threshold_seconds ?? 600) / 60)

  const seats = useMemo(() => (seatsQuery.data ?? []).map((seat, index) => ({
    id: seat.seat_id,
    label: seat.seat_id,
    tableId: /^T\d+$/i.test(seat.seat_id.split('-')[0]) ? seat.seat_id.split('-')[0].toUpperCase() : `T${String(Math.floor(index / 6) + 1).padStart(2, '0')}`,
    status: apiStatusToUi[seat.status],
  })), [seatsQuery.data])

  const tables = useMemo(() => [...new Set(seats.map((seat) => seat.tableId))], [seats])
  const positionedSeats = useMemo(() => {
    const layoutBySeat = new Map((layoutQuery.data?.seats ?? []).map((seat) => [seat.seat_id, seat]))
    return seats.flatMap((seat) => {
      const layoutSeat = layoutBySeat.get(seat.id)
      if (!layoutSeat || layoutSeat.polygon.length < 3) return []
      const xs = layoutSeat.polygon.map((point) => point.x)
      const ys = layoutSeat.polygon.map((point) => point.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const roiWidth = Math.max(...xs) - x
      const roiHeight = Math.max(...ys) - y
      if (roiWidth <= 0 || roiHeight <= 0) return []
      const centerX = x + roiWidth / 2
      const centerY = y + roiHeight / 2
      return [{
        ...seat,
        x: clamp(centerX - DASHBOARD_SEAT_WIDTH / 2, 0, 1 - DASHBOARD_SEAT_WIDTH),
        y: clamp(centerY - DASHBOARD_SEAT_HEIGHT / 2, 0, 1 - DASHBOARD_SEAT_HEIGHT),
        width: DASHBOARD_SEAT_WIDTH,
        height: DASHBOARD_SEAT_HEIGHT,
      }]
    })
  }, [layoutQuery.data, seats])
  const displayedSeats = useMemo(() => {
    if (!isLayoutAligned) return positionedSeats
    return tables.flatMap((table) => {
      const tableSeats = positionedSeats.filter((seat) => seat.tableId === table)
      const centerXs = tableSeats.map((seat) => seat.x + seat.width / 2)
      const centerYs = tableSeats.map((seat) => seat.y + seat.height / 2)
      const xAxes = createAxisClusters(centerXs)
      const yAxes = createAxisClusters(centerYs)
      return tableSeats.map((seat) => {
        const centerX = seat.x + seat.width / 2
        const centerY = seat.y + seat.height / 2
        return {
          ...seat,
          x: clamp(nearestAxis(centerX, xAxes) - seat.width / 2, 0, 1 - seat.width),
          y: clamp(nearestAxis(centerY, yAxes) - seat.height / 2, 0, 1 - seat.height),
        }
      })
    })
  }, [isLayoutAligned, positionedSeats, tables])
  const tableBounds = useMemo(() => tables.map((table) => {
    const tableSeats = displayedSeats.filter((seat) => seat.tableId === table)
    if (tableSeats.length === 0) return null
    const x = Math.min(...tableSeats.map((seat) => seat.x))
    const y = Math.min(...tableSeats.map((seat) => seat.y))
    const right = Math.max(...tableSeats.map((seat) => seat.x + seat.width))
    const bottom = Math.max(...tableSeats.map((seat) => seat.y + seat.height))
    return { table, count: tableSeats.length, x, y, width: right - x, height: bottom - y }
  }).filter((bounds): bounds is NonNullable<typeof bounds> => bounds !== null), [displayedSeats, tables])
  const hasCompleteLayout = seats.length > 0 && positionedSeats.length === seats.length
  const stats = (Object.keys(statusMeta) as SeatStatus[]).map((status) => ({
    status,
    count: seats.filter((seat) => seat.status === status).length,
  }))
  const connected = healthQuery.isSuccess && healthQuery.data.status === 'ok'
  const lastSeatUpdate = useMemo(() => {
    const timestamps = (seatsQuery.data ?? [])
      .map((seat) => new Date(seat.updated_at).getTime())
      .filter(Number.isFinite)
    return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null
  }, [seatsQuery.data])

  const resetOneSeat = (seatId: string) => {
    resetSeatTimer.mutate(seatId)
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-1 text-sm font-medium text-brand-600">관리자 대시보드</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">좌석 현황</h1><p className="mt-2 text-sm text-slate-500">실시간으로 도서관 좌석 상태를 확인하고 관리하세요.</p></div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}{connected ? '서버 연결됨' : '서버 연결 끊김'}
        </div>
      </header>

      {seatsQuery.isError && <div className="mt-6 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><span>좌석 정보를 불러오지 못했습니다. 백엔드 주소와 서버 상태를 확인해주세요.</span><Button variant="outline" onClick={() => seatsQuery.refetch()}><RefreshCw size={15} className="mr-2" />재시도</Button></div>}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ status, count }) => <div key={status} className="surface p-5"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{statusMeta[status].label}</span><span className={`size-2.5 rounded-full ${statusMeta[status].dot}`} /></div><strong className="mt-3 block text-3xl tracking-tight text-slate-900">{seatsQuery.isLoading ? '-' : count}</strong><span className="mt-1 block text-xs text-slate-400">전체 {seats.length}석 중</span></div>)}
      </section>

      <section className="surface mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div><h2 className="font-bold text-slate-900">좌석 배치도</h2><div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Clock3 size={13} />마지막 업데이트: {lastSeatUpdate ? lastSeatUpdate.toLocaleTimeString('ko-KR') : '-'} · 실시간 {seatEventsState === 'open' ? '연결됨' : '재연결 중'}</div></div>
          <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); saveSettings.mutate({ noshow_threshold_seconds: Math.max(1, thresholdMinutes * 60) }) }}>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600"><SlidersHorizontal size={15} /><span>노쇼</span><input aria-label="노쇼 기준 시간" type="number" min="1" value={thresholdMinutes} onChange={(event) => setEditedThresholdMinutes(Number(event.target.value))} className="w-12 bg-transparent text-right outline-none" /><span>분</span></label>
            <Button type="submit" variant="outline" disabled={saveSettings.isPending}>{saveSettings.isPending ? '저장 중' : '설정 저장'}</Button>
          </form>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-x-5 gap-y-2">{Object.entries(statusMeta).map(([key, meta]) => <span key={key} className="flex items-center gap-2 text-xs text-slate-500"><i className={`size-2 rounded-full ${meta.dot}`} />{meta.label}</span>)}</div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={resetAllSeatTimers.isPending || seats.length === 0} onClick={() => resetAllSeatTimers.mutate()}><RefreshCw size={15} className={`mr-2 ${resetAllSeatTimers.isPending ? 'animate-spin' : ''}`} />전체 타이머 초기화</Button>{hasCompleteLayout && <Button variant="outline" onClick={() => setIsLayoutAligned((current) => !current)}>{isLayoutAligned ? <MapPin size={15} className="mr-2" /> : <AlignHorizontalSpaceAround size={15} className="mr-2" />}{isLayoutAligned ? 'ROI 위치 보기' : '자동 정렬'}</Button>}</div></div>
        {(resetSeatTimer.isError || resetAllSeatTimers.isError) && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">타이머 초기화에 실패했습니다. 서버 연결을 확인해주세요.</p>}
        {seatsQuery.isLoading && <div className="grid min-h-48 place-items-center text-sm text-slate-400">좌석 정보를 불러오는 중입니다...</div>}
        {!seatsQuery.isLoading && !seatsQuery.isError && seats.length === 0 && <div className="grid min-h-48 place-items-center text-sm text-slate-400">등록된 좌석이 없습니다.</div>}
        {hasCompleteLayout ? (
          <div className="relative mt-7 aspect-video min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] bg-slate-50">
            <span className="absolute left-4 top-3 z-30 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm">{isLayoutAligned ? '자동 정렬 좌석 배치' : '관리자 설정 좌석 배치'}</span>
            {tableBounds.map((bounds) => <div key={bounds.table} className="pointer-events-none absolute z-0 rounded-xl border border-dashed border-slate-400/70 bg-slate-200/25" style={{ left: `${Math.max(0, bounds.x * 100 - 1)}%`, top: `${Math.max(0, bounds.y * 100 - 2)}%`, width: `${Math.min(100 - bounds.x * 100, bounds.width * 100 + 2)}%`, height: `${Math.min(100 - bounds.y * 100, bounds.height * 100 + 4)}%` }}><span className="absolute -top-5 left-0 whitespace-nowrap text-[10px] font-bold text-slate-600">테이블 {bounds.table} · {bounds.count}석</span></div>)}
            {displayedSeats.map((seat) => <button key={seat.id} aria-label={`${seat.label} 좌석 ${statusMeta[seat.status].label} 타이머 초기화`} title={`${seat.label} · ${statusMeta[seat.status].label} · 클릭하여 타이머 초기화`} disabled={resetSeatTimer.isPending && resetSeatTimer.variables === seat.id} onClick={() => resetOneSeat(seat.id)} className={`absolute z-10 grid min-h-8 min-w-14 place-items-center overflow-hidden rounded-lg border px-1 text-[10px] font-bold shadow-sm transition hover:z-20 hover:scale-105 disabled:cursor-wait disabled:opacity-60 ${statusMeta[seat.status].seat}`} style={{ left: `${seat.x * 100}%`, top: `${seat.y * 100}%`, width: `${seat.width * 100}%`, height: `${seat.height * 100}%` }}>{seat.label}</button>)}
          </div>
        ) : (
          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {tables.map((table) => { const tableSeats = seats.filter((seat) => seat.tableId === table); return <div key={table} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="mb-4 flex items-center justify-between"><span className="text-sm font-bold text-slate-700">테이블 {table}</span><span className="text-xs text-slate-400">{tableSeats.length}석</span></div><div className="grid grid-cols-2 gap-2">{tableSeats.map((seat) => <button key={seat.id} aria-label={`${seat.label} 좌석 ${statusMeta[seat.status].label} 타이머 초기화`} title="클릭하여 타이머 초기화" disabled={resetSeatTimer.isPending && resetSeatTimer.variables === seat.id} onClick={() => resetOneSeat(seat.id)} className={`min-h-14 rounded-xl border px-2 text-[10px] font-bold transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 ${statusMeta[seat.status].seat}`}>{seat.label}</button>)}</div></div> })}
          </div>
        )}
      </section>
    </div>
  )
}
