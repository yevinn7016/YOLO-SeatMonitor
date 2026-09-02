import { ArrowLeft, Clock3, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useSeatEvents } from '@/hooks/use-seat-events'
import { useHealthQuery, useSeatsQuery } from '@/hooks/use-seat-api'
import type { ApiSeatStatus } from '@/types/seat'

const statusMeta: Record<ApiSeatStatus, { label: string; dot: string; card: string }> = {
  empty: { label: '사용 가능', dot: 'bg-emerald-500', card: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  occupied: { label: '사용 중', dot: 'bg-brand-500', card: 'border-blue-200 bg-blue-50 text-blue-700' },
  away: { label: '자리 비움', dot: 'bg-amber-500', card: 'border-amber-200 bg-amber-50 text-amber-700' },
  noshow: { label: '노쇼', dot: 'bg-rose-500', card: 'border-rose-200 bg-rose-50 text-rose-700' },
}

export function SeatStatusPage() {
  const seatsQuery = useSeatsQuery(); const healthQuery = useHealthQuery(); const eventState = useSeatEvents(); const seats = useMemo(() => seatsQuery.data ?? [], [seatsQuery.data])
  const groups = useMemo(() => { const map = new Map<string, typeof seats>(); seats.forEach((seat, index) => { const prefix = seat.seat_id.split('-')[0].toUpperCase(); const table = /^T\d+$/.test(prefix) ? prefix : `T${String(Math.floor(index / 6) + 1).padStart(2, '0')}`; map.set(table, [...(map.get(table) ?? []), seat]) }); return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })) }, [seats])
  const connected = healthQuery.data?.status === 'ok'; const timestamps = seats.map((seat) => new Date(seat.updated_at).getTime()).filter(Number.isFinite); const lastUpdated = timestamps.length ? new Date(Math.max(...timestamps)) : null
  return <main className="min-h-screen bg-[#f5f7fb] px-5 py-7 sm:px-8 lg:px-12"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link to="/" className="mb-5 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} />처음으로</Link><p className="text-sm font-semibold text-brand-600">SeatMonitor</p><h1 className="mt-1 text-3xl font-bold text-slate-900">실시간 좌석 현황</h1><p className="mt-2 text-sm text-slate-500">이용 가능한 좌석을 한눈에 확인하세요.</p></div><span className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />}{connected ? '실시간 연결됨' : '연결 확인 중'}</span></header>
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div className="surface p-5"><span className="text-sm text-slate-500">전체 좌석</span><strong className="mt-3 block text-3xl text-slate-900">{seatsQuery.isLoading ? '-' : seats.length}</strong></div>{(Object.keys(statusMeta) as ApiSeatStatus[]).map((status) => <div key={status} className="surface p-5"><div className="flex justify-between"><span className="text-sm text-slate-500">{statusMeta[status].label}</span><i className={`size-2.5 rounded-full ${statusMeta[status].dot}`} /></div><strong className="mt-3 block text-3xl text-slate-900">{seatsQuery.isLoading ? '-' : seats.filter((s) => s.status === status).length}</strong></div>)}</section>
    <section className="surface mt-6 p-5 sm:p-6"><div className="flex items-center justify-between border-b border-slate-100 pb-5"><h2 className="font-bold text-slate-900">좌석 배치</h2><span className="flex items-center gap-1.5 text-xs text-slate-400"><Clock3 size={13} />{lastUpdated ? lastUpdated.toLocaleTimeString('ko-KR') : '-'} · SSE {eventState === 'open' ? '연결됨' : '재연결 중'}</span></div>
      {seatsQuery.isError && <div className="mt-5 flex items-center justify-between rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><span>좌석 정보를 불러오지 못했습니다.</span><Button variant="outline" onClick={() => seatsQuery.refetch()}><RefreshCw size={14} className="mr-2" />재시도</Button></div>}
      {seatsQuery.isLoading && <div className="grid min-h-48 place-items-center text-sm text-slate-400">좌석 정보를 불러오는 중입니다...</div>}
      {!seatsQuery.isLoading && !seatsQuery.isError && groups.length === 0 && <div className="grid min-h-48 place-items-center text-sm text-slate-400">등록된 좌석이 없습니다.</div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{groups.map(([table, tableSeats]) => <article key={table} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="mb-3 flex justify-between border-b border-slate-200 pb-3"><strong className="text-sm">테이블 {table}</strong><span className="text-xs text-slate-500">{tableSeats.length}석</span></div><div className="grid grid-cols-2 gap-2">{tableSeats.map((seat) => <div key={seat.seat_id} className={`rounded-xl border px-3 py-3 ${statusMeta[seat.status].card}`}><strong className="block truncate text-xs">{seat.seat_id}</strong><span className="mt-1 block text-[11px]">{statusMeta[seat.status].label}</span></div>)}</div></article>)}</div>
    </section>
  </div></main>
}
