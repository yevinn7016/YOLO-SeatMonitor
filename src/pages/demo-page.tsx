import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Film, LoaderCircle, Pencil, Play, Plus, RefreshCw, Save, Sparkles, Square, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { SeatRoiEditor, type RoiRegion } from '@/components/seat-roi-editor'
import { useSeatEvents } from '@/hooks/use-seat-events'
import { queryKeys, useResetAllSeatTimersMutation, useResetSeatTimerMutation, useSeatsQuery } from '@/hooks/use-seat-api'
import { demoApi, type DemoPlaybackStatus, type UploadedDemoVideo } from '@/services/demo-api'
import { seatApi } from '@/services/seat-api'
import { layoutToRegions } from '@/lib/layout-mapper'
import { findNextSeatNumber, formatSeatLabel, parseSeatLabel, type SeatLabelParts } from '@/lib/seat-label'
import type { ApiSeatStatus } from '@/types/seat'

const statusMeta: Record<ApiSeatStatus, { label: string; dot: string; seat: string }> = {
  empty: { label: '빈 좌석', dot: 'bg-emerald-500', seat: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  occupied: { label: '점유 중', dot: 'bg-brand-500', seat: 'border-blue-200 bg-blue-50 text-blue-700' },
  away: { label: '자리 비움', dot: 'bg-amber-500', seat: 'border-amber-200 bg-amber-50 text-amber-700' },
  noshow: { label: '노쇼', dot: 'bg-rose-500', seat: 'border-rose-200 bg-rose-50 text-rose-700' },
}

const playbackLabels: Record<DemoPlaybackStatus, string> = {
  idle: '영상 대기', uploaded: '업로드 완료', playing: '영상 분석 중 · 실시간 반영',
  completed: '분석 완료', stopped: '분석 중지됨', error: '분석 오류',
}

const supportedVideoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v']

function formatTime(seconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}

export function DemoPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isDemoReady, setIsDemoReady] = useState(false)
  const seatsQuery = useSeatsQuery(isDemoReady)
  const resetSeatTimer = useResetSeatTimerMutation()
  const resetAllSeatTimers = useResetAllSeatTimersMutation()
  const seatEventsState = useSeatEvents(isDemoReady)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedVideo, setUploadedVideo] = useState<UploadedDemoVideo | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRoiEditor, setShowRoiEditor] = useState(false)
  const [editedRegions, setEditedRegions] = useState<RoiRegion[] | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [drawingEnabled, setDrawingEnabled] = useState(false)
  const [isSavingRoi, setIsSavingRoi] = useState(false)
  const [isSuggestingRoi, setIsSuggestingRoi] = useState(false)
  const [suggestionInstructions, setSuggestionInstructions] = useState('')
  const [creationGroup, setCreationGroup] = useState<Pick<SeatLabelParts, 'table' | 'row'>>({ table: 'T01', row: 'A' })
  const [seatLabelDraft, setSeatLabelDraft] = useState<SeatLabelParts | null>(null)

  const statusQuery = useQuery({
    queryKey: ['demo-status'],
    queryFn: demoApi.getStatus,
    refetchInterval: (query) => query.state.data?.status === 'playing' ? 1_000 : false,
    enabled: Boolean(uploadedVideo),
  })
  const layoutQuery = useQuery({
    queryKey: ['demo-layout'],
    queryFn: demoApi.getLayout,
  })
  const layoutRegions = useMemo(
    () => (layoutQuery.data ? layoutToRegions(layoutQuery.data) : []),
    [layoutQuery.data],
  )
  const regions = editedRegions ?? layoutRegions
  const setRegions = useCallback((value: RoiRegion[] | ((current: RoiRegion[]) => RoiRegion[])) => {
    setEditedRegions((current) => {
      const base = current ?? layoutRegions
      return typeof value === 'function' ? value(base) : value
    })
  }, [layoutRegions])
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? null
  const selectedLabelParts = selectedRegion ? parseSeatLabel(selectedRegion.label) ?? { table: 'T01', row: 'A', number: '01' } : null
  const selectedRegionLabel = selectedRegion?.label
  const nextSeatLabel = formatSeatLabel({
    ...creationGroup,
    number: findNextSeatNumber(regions.map((region) => region.label), creationGroup.table, creationGroup.row),
  })
  const playbackStatus = statusQuery.data?.status ?? (uploadedVideo ? 'uploaded' : 'idle')
  const isPlaying = playbackStatus === 'playing'

  useEffect(() => {
    let cancelled = false

    demoApi.enterDemo()
      .then(() => {
        if (cancelled) return
        queryClient.removeQueries({ queryKey: queryKeys.seats, exact: true })
        setIsDemoReady(true)
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '데모 모드 진입에 실패했습니다.')
      })

    return () => { cancelled = true }
  }, [queryClient])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setSeatLabelDraft(selectedRegionLabel ? parseSeatLabel(selectedRegionLabel) ?? { table: 'T01', row: 'A', number: '01' } : null)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [selectedRegionId, selectedRegionLabel])

  const seats = seatsQuery.data ?? []
  const tableGroups = useMemo(() => {
    const grouped = new Map<string, typeof seats>()
    seats.forEach((seat, index) => {
      const prefix = seat.seat_id.split('-')[0].toUpperCase()
      const tableId = /^T\d+$/.test(prefix) ? prefix : `T${String(Math.floor(index / 6) + 1).padStart(2, '0')}`
      grouped.set(tableId, [...(grouped.get(tableId) ?? []), seat])
    })
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
  }, [seats])

  const uploadVideo = async () => {
    if (!selectedFile) return
    const extension = selectedFile.name.split('.').pop()?.toLowerCase() ?? ''
    if (!supportedVideoExtensions.includes(extension)) {
      setError('지원하지 않는 영상 형식입니다. MP4, MOV, AVI, MKV, WEBM, M4V 파일을 선택해주세요.')
      return
    }
    if (selectedFile.size > 500 * 1024 * 1024) {
      setError('영상은 500MB 이하만 업로드할 수 있습니다.')
      return
    }
    setIsUploading(true); setError(null)
    try {
      const uploaded = await demoApi.uploadVideo(selectedFile)
      setUploadedVideo(uploaded)
      setPreviewUrl(demoApi.previewUrl())
      await layoutQuery.refetch()
      setEditedRegions(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '영상 업로드에 실패했습니다.')
    } finally { setIsUploading(false) }
  }

  const saveRoi = async () => {
    setIsSavingRoi(true); setError(null)
    try {
      await demoApi.saveLayout({ version: 1, seats: regions.map((region) => ({ seat_id: region.label, label: region.label, polygon: region.points })) })
      await layoutQuery.refetch()
      setEditedRegions(null)
      setShowRoiEditor(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '시연용 ROI 저장에 실패했습니다.') }
    finally { setIsSavingRoi(false) }
  }

  const suggestRoi = async () => {
    setIsSuggestingRoi(true); setError(null)
    try {
      const response = await fetch(previewUrl, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Preview 요청에 실패했습니다. (${response.status})`)
      const blob = await response.blob()
      const suggestion = await seatApi.createLayoutSuggestion(blob, suggestionInstructions.trim() || undefined)
      setRegions(layoutToRegions(suggestion.layout))
      setSelectedRegionId(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'AI ROI 후보 생성에 실패했습니다.') }
    finally { setIsSuggestingRoi(false) }
  }

  const startDemo = async () => {
    if (!uploadedVideo) return
    setIsStarting(true); setError(null)
    try {
      await demoApi.startDemo(uploadedVideo.video_id)
      setStreamUrl(demoApi.streamUrl())
      await statusQuery.refetch()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '영상 분석 시작에 실패했습니다.')
    } finally { setIsStarting(false) }
  }

  const stopDemo = async () => {
    setIsStopping(true); setError(null)
    try { await demoApi.stopDemo(); await statusQuery.refetch() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '영상 분석 중지에 실패했습니다.') }
    finally { setIsStopping(false) }
  }

  const exitDemo = async () => {
    setIsExiting(true); setError(null)
    try { await demoApi.exitDemo(); navigate('/') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '데모 종료에 실패했습니다.'); setIsExiting(false) }
  }

  const commitSelectedSeatLabel = (field: keyof SeatLabelParts) => {
    if (!selectedRegion || !seatLabelDraft) return
    const nextParts = { ...seatLabelDraft }
    if (field === 'table' || field === 'row') {
      nextParts.number = findNextSeatNumber(
        regions.filter((region) => region.id !== selectedRegion.id).map((region) => region.label),
        nextParts.table,
        nextParts.row,
      )
    }
    const label = formatSeatLabel(nextParts)
    setRegions((current) => current.map((region) => region.id === selectedRegion.id ? { ...region, label } : region))
    setSeatLabelDraft(parseSeatLabel(label))
  }

  const handleSeatLabelKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }

  const progress = Math.min(100, Math.max(0, statusQuery.data?.progress ?? 0))
  const hasRoi = regions.length > 0

  return <div className="mx-auto max-w-[1500px]">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-1 text-sm font-medium text-brand-600">시연 모드</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">실시간 좌석 모니터링 데모</h1><p className="mt-2 text-sm text-slate-500">업로드된 영상의 좌석 점유 상태를 실시간으로 분석하여 대시보드에 반영합니다.</p></div>
      <div className="flex items-center gap-3"><span className={`rounded-full border px-3 py-2 text-xs font-medium ${playbackStatus === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : isPlaying ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>{playbackLabels[playbackStatus]}</span><Button variant="outline" disabled={isExiting} onClick={exitDemo}>{isExiting ? '종료 중...' : '데모 종료'}</Button></div>
    </header>
    {(error || statusQuery.data?.error) && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error ?? statusQuery.data?.error}</p>}

    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(480px,.95fr)]">
      <section className="surface overflow-hidden p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2"><Film size={18} className="text-brand-600" /><h2 className="font-bold text-slate-900">시연 영상</h2></div>
        {!uploadedVideo ? <div className="grid min-h-[430px] place-items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center"><div><Upload className="mx-auto mb-4 text-slate-400" size={36} /><p className="font-medium text-slate-700">분석할 시연 영상을 선택하세요.</p><input className="mt-5 block max-w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-medium file:text-blue-700" type="file" accept="video/*" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /><Button className="mt-4" disabled={!selectedFile || isUploading} onClick={uploadVideo}>{isUploading && <LoaderCircle size={15} className="mr-2 animate-spin" />}{isUploading ? '업로드 중...' : '영상 업로드'}</Button></div></div>
        : <><div className="grid aspect-video place-items-center overflow-hidden rounded-2xl bg-slate-950"><img src={isPlaying ? streamUrl : previewUrl} onError={() => !isPlaying && setError('영상 Preview를 불러오지 못했습니다.')} alt={isPlaying ? '분석 중인 시연 영상' : '시연 영상 첫 프레임'} className="max-h-full w-full object-contain" /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{uploadedVideo.filename}</p><p className="mt-1 text-xs text-slate-500">영상 길이 {formatTime(uploadedVideo.duration_seconds)} · {uploadedVideo.fps} FPS</p></div><div className="flex gap-2">{!isPlaying && <Button variant="outline" onClick={() => setShowRoiEditor(true)}><Pencil size={14} className="mr-2" />ROI 설정</Button>}{isPlaying ? <Button variant="outline" disabled={isStopping} onClick={stopDemo}><Square size={14} className="mr-2" />{isStopping ? '중지 중...' : '분석 중지'}</Button> : <Button disabled={isStarting || !hasRoi} title={!hasRoi ? '시연용 ROI를 먼저 설정해주세요.' : undefined} onClick={startDemo}><Play size={15} className="mr-2" />{isStarting ? '시작 중...' : playbackStatus === 'completed' ? '다시 분석' : '분석 시작'}</Button>}</div></div>
        <div className={`mt-4 rounded-xl p-3 text-xs ${hasRoi ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{hasRoi ? `✓ ROI 설정 완료 · ${regions.length}석` : '⚠ 시연용 ROI 설정이 필요합니다. 첫 프레임을 기준으로 좌석 영역을 설정해주세요.'}</div>
        <div className="mt-5 rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-xs font-medium text-slate-600"><span>{playbackLabels[playbackStatus]}</span><span>{formatTime(statusQuery.data?.current_seconds)} / {formatTime(statusQuery.data?.duration_seconds ?? uploadedVideo.duration_seconds)} · {progress.toFixed(0)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${progress}%` }} /></div></div></>}
      </section>

      <section className="surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">실시간 좌석 현황</h2><span className="mt-1 block text-xs text-slate-400">{isDemoReady ? `SSE ${seatEventsState === 'open' ? '연결됨' : '재연결 중'}` : '데모 모드 준비 중...'}</span></div><Button variant="outline" disabled={!isDemoReady || resetAllSeatTimers.isPending || !seatsQuery.data?.length} onClick={() => resetAllSeatTimers.mutate()}><RefreshCw size={14} className={`mr-2 ${resetAllSeatTimers.isPending ? 'animate-spin' : ''}`} />전체 타이머 초기화</Button></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{(Object.keys(statusMeta) as ApiSeatStatus[]).map((status) => <div key={status} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{statusMeta[status].label}</span><i className={`size-2 rounded-full ${statusMeta[status].dot}`} /></div><strong className="mt-2 block text-2xl text-slate-900">{!isDemoReady || seatsQuery.isLoading ? '-' : (seatsQuery.data ?? []).filter((seat) => seat.status === status).length}</strong></div>)}</div>
        {isDemoReady && seatsQuery.isError && <p className="mt-5 text-sm text-rose-600">좌석 정보를 불러오지 못했습니다.</p>}
        {!isDemoReady && <div className="grid min-h-48 place-items-center text-sm text-slate-400">데모 좌석 정보를 준비하고 있습니다...</div>}
        {isDemoReady && !seatsQuery.isLoading && !seatsQuery.isError && tableGroups.length === 0 && <div className="grid min-h-48 place-items-center text-sm text-slate-400">등록된 좌석이 없습니다.</div>}
        {isDemoReady && <div className="mt-5 grid gap-4 sm:grid-cols-2">{tableGroups.map(([tableId, seats]) => <div key={tableId} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="mb-3 flex justify-between border-b border-slate-200 pb-3"><span className="text-sm font-bold text-slate-800">테이블 {tableId}</span><span className="text-xs text-slate-500">{seats?.length ?? 0}석</span></div><div className="grid grid-cols-2 gap-2">{seats?.map((seat) => <button key={seat.seat_id} title="클릭하여 좌석 타이머 초기화" disabled={resetSeatTimer.isPending && resetSeatTimer.variables === seat.seat_id} onClick={() => resetSeatTimer.mutate(seat.seat_id)} className={`rounded-xl border px-2.5 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60 ${statusMeta[seat.status].seat}`}><span className="block truncate text-[11px] font-bold">{seat.seat_id}</span><span className="mt-1 block text-[10px] font-medium opacity-80">{statusMeta[seat.status].label}</span></button>)}</div></div>)}</div>}
      </section>
    </div>
    {showRoiEditor && uploadedVideo && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
        <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">시연용 ROI 설정</h2>
              <p className="mt-1 text-xs text-slate-500">영상 첫 프레임 위에 좌석 영역을 지정합니다. 카메라 ROI에는 영향을 주지 않습니다.</p>
            </div>
            <button aria-label="ROI 설정 닫기" onClick={() => setShowRoiEditor(false)}><X size={20} /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="h-[min(58vh,580px)] overflow-hidden rounded-xl">
              <SeatRoiEditor
                imageUrl={previewUrl}
                regions={regions}
                onChange={setRegions}
                selectedId={selectedRegionId}
                onSelect={setSelectedRegionId}
                drawingEnabled={drawingEnabled}
                onDrawingComplete={() => setDrawingEnabled(false)}
                newRegionLabel={nextSeatLabel}
              />
            </div>
            {selectedRegion && seatLabelDraft && (
              <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Pencil size={14} />선택한 좌석명 편집
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="text-[10px] text-slate-500">
                    테이블
                    <input
                      aria-label="테이블 번호"
                      value={seatLabelDraft.table}
                      onChange={(event) => setSeatLabelDraft((current) => current ? { ...current, table: event.target.value } : current)}
                      onBlur={() => commitSelectedSeatLabel('table')}
                      onKeyDown={handleSeatLabelKeyDown}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold uppercase outline-none focus:border-brand-500"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    행
                    <input
                      aria-label="좌석 행"
                      value={seatLabelDraft.row}
                      onChange={(event) => setSeatLabelDraft((current) => current ? { ...current, row: event.target.value } : current)}
                      onBlur={() => commitSelectedSeatLabel('row')}
                      onKeyDown={handleSeatLabelKeyDown}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold uppercase outline-none focus:border-brand-500"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    번호
                    <input
                      aria-label="좌석 번호"
                      value={seatLabelDraft.number}
                      onChange={(event) => setSeatLabelDraft((current) => current ? { ...current, number: event.target.value } : current)}
                      onBlur={() => commitSelectedSeatLabel('number')}
                      onKeyDown={handleSeatLabelKeyDown}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold outline-none focus:border-brand-500"
                    />
                  </label>
                </div>
                <div className="mt-3 rounded-lg bg-white px-3 py-2 text-center text-xs font-bold text-brand-700">
                  {formatSeatLabel(seatLabelDraft)}
                </div>
                <p className="mt-2 text-[11px] leading-4 text-slate-400">Enter를 누르거나 다른 곳을 클릭하면 좌석명이 적용됩니다.</p>
              </div>
            )}
            {!selectedRegion && !drawingEnabled && (
              <p className="mt-3 text-xs text-slate-500">다음 추가 좌석명: <span className="font-semibold text-brand-700">{nextSeatLabel}</span></p>
            )}
            <input
              value={suggestionInstructions}
              onChange={(event) => setSuggestionInstructions(event.target.value)}
              placeholder="AI 좌석 후보 생성 추가 요청 (선택)"
              className="mt-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-400"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={drawingEnabled}
                onClick={() => {
                  if (selectedLabelParts) setCreationGroup({ table: selectedLabelParts.table, row: selectedLabelParts.row })
                  setDrawingEnabled(true)
                  setSelectedRegionId(null)
                }}
              >
                <Plus size={15} className="mr-2" />좌석 영역 추가
              </Button>
              <Button variant="outline" disabled={!selectedRegionId} onClick={() => { setRegions((current) => current.filter((region) => region.id !== selectedRegionId)); setSelectedRegionId(null) }}>
                <Trash2 size={15} className="mr-2" />선택 삭제
              </Button>
              <Button variant="outline" disabled={isSuggestingRoi} onClick={suggestRoi}>
                <Sparkles size={15} className="mr-2" />{isSuggestingRoi ? 'AI 분석 중...' : 'AI 후보 생성'}
              </Button>
            </div>
            <Button disabled={regions.length === 0 || isSavingRoi} onClick={saveRoi}>
              <Save size={15} className="mr-2" />{isSavingRoi ? '저장 중...' : `시연용 ROI ${regions.length}개 저장`}
            </Button>
          </div>
        </div>
      </div>
    )}
  </div>
}
