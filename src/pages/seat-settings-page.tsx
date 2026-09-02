//카메라 화면에서 좌석 ROI 영역을 설정하고 서버에 저장하는 화면 코드
import { ArrowLeft, Camera, Check, MonitorUp, MousePointer2, Pencil, Plus, RefreshCw, Save, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { CameraFrameView, loadImageDimensions } from '@/components/camera-frame-view'
import { Button } from '@/components/ui/button'
import { SeatRoiEditor, type RoiRegion } from '@/components/seat-roi-editor'
import { useCameraFrame } from '@/hooks/use-camera-frame'
import { getCameraFrameUrl, ApiError } from '@/lib/api-client'
import { useCreateLayoutSuggestionMutation, useHealthQuery, useLayoutQuery, useSaveLayoutMutation } from '@/hooks/use-seat-api'
import { layoutToRegions } from '@/lib/layout-mapper'
import { findNextSeatNumber, formatSeatLabel, parseSeatLabel, type SeatLabelParts } from '@/lib/seat-label'

const steps = ['카메라 확인', '화면 캡처', '좌석 영역 지정', '저장']

function getLayoutSuggestionErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400) return '잘못된 이미지입니다.'
    if (error.status === 413) return '이미지 용량을 초과했습니다.'
    if (error.status === 415) return '지원하지 않는 이미지 형식입니다.'
    if (error.status === 429) return 'Gemini 요청 한도를 초과했습니다.'
    if (error.status === 502) return 'AI 좌석 후보 생성에 실패했습니다.'
    if (error.status === 503) return 'AI ROI 기능을 사용할 수 없습니다.'
    return error.message
  }
  return error instanceof Error ? error.message : 'AI 좌석 후보 생성에 실패했습니다.'
}

export function SeatSettingsPage() {
  const health = useHealthQuery()
  const layout = useLayoutQuery()
  const saveLayout = useSaveLayoutMutation()
  const createSuggestion = useCreateLayoutSuggestionMutation()
  const { frame: liveFrame, hasLoadError: liveFrameError } = useCameraFrame()
  const [currentStep, setCurrentStep] = useState(0)
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null)
  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null)
  const [capturedImageSize, setCapturedImageSize] = useState<{ width: number; height: number } | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [regions, setRegions] = useState<RoiRegion[]>([])
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [layoutLoadedIntoEditor, setLayoutLoadedIntoEditor] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(false)
  const [creationGroup, setCreationGroup] = useState<Pick<SeatLabelParts, 'table' | 'row'>>({ table: 'T01', row: 'A' })
  const [seatLabelDraft, setSeatLabelDraft] = useState<SeatLabelParts | null>(null)
  const cameraConnected = health.data?.camera_connected === true
  const imageError = liveFrameError
  const suggestionAvailable = health.data?.roi_suggestion_available === true
  const displayFrameSize = capturedImageSize ?? (liveFrame ? { width: liveFrame.width, height: liveFrame.height } : null)
  const selectedRegion = regions.find((region) => region.id === selectedRegionId)
  const selectedLabelParts = selectedRegion ? parseSeatLabel(selectedRegion.label) ?? { table: 'T01', row: 'A', number: '01' } : null
  const selectedRegionLabel = selectedRegion?.label
  const newRegionLabel = formatSeatLabel({
    ...creationGroup,
    number: findNextSeatNumber(regions.map((region) => region.label), creationGroup.table, creationGroup.row),
  })

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setSeatLabelDraft(selectedRegionLabel ? parseSeatLabel(selectedRegionLabel) ?? { table: 'T01', row: 'A', number: '01' } : null)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [selectedRegionId, selectedRegionLabel])

  useEffect(() => {
    return () => {
      if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl)
    }
  }, [capturedImageUrl])

  const captureCurrentFrame = async () => {
    setIsCapturing(true)
    setCaptureError(null)

    try {
      const frameUrl = liveFrame?.url ?? getCameraFrameUrl()
      const response = await fetch(frameUrl, { cache: 'no-store' })
      if (!response.ok) throw new Error(`카메라 프레임 요청 실패 (${response.status})`)
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) throw new Error('카메라가 이미지 형식으로 응답하지 않았습니다.')

      const objectUrl = URL.createObjectURL(blob)
      const dimensions = await loadImageDimensions(objectUrl)
      setCapturedImageUrl(objectUrl)
      setCapturedImageBlob(blob)
      setCapturedImageSize(dimensions)
      setCurrentStep(1)
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : '화면 캡처에 실패했습니다.')
    } finally {
      setIsCapturing(false)
    }
  }

  const goBackToCamera = () => {
    setCurrentStep(0)
    setCaptureError(null)
    setCapturedImageUrl(null)
    setCapturedImageBlob(null)
    setCapturedImageSize(null)
  }

  const saveRegions = () => {
    saveLayout.mutate({
      version: 1,
      seats: regions.map((region) => ({
        seat_id: region.label,
        label: region.label,
        polygon: region.points,
      })),
    })
  }

  const openRoiEditor = () => {
    if (!layoutLoadedIntoEditor) {
      setRegions(layoutToRegions(layout.data))
      setLayoutLoadedIntoEditor(true)
    }
    setSelectedRegionId(null)
    setDrawingEnabled(false)
    setCurrentStep(2)
  }

  const requestLayoutSuggestion = (additionalInstructions?: string) => {
    if (!capturedImageBlob) return
    createSuggestion.mutate(
      { image: capturedImageBlob, additionalInstructions },
      {
        onSuccess: (response) => {
          setRegions(layoutToRegions(response.layout))
          setLayoutLoadedIntoEditor(true)
          setSelectedRegionId(null)
          setDrawingEnabled(false)
          setCurrentStep(2)
        },
      },
    )
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

  return (
    <div className="mx-auto max-w-7xl">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} />처음으로 돌아가기
      </Link>

      <header className="mt-5">
        <p className="text-sm font-medium text-brand-600">좌석 영역 설정</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{currentStep === 0 ? '카메라 확인' : currentStep === 1 ? '화면 캡처' : '좌석 영역 지정'}</h1>
        <p className="mt-2 text-sm text-slate-500">{currentStep === 0 ? '연결된 카메라의 영상과 상태를 확인하세요.' : currentStep === 1 ? '캡처된 기준 화면을 확인한 뒤 좌석 영역을 지정하세요.' : '캡처 이미지 위에 좌석 감지 영역을 추가하고 조정하세요.'}</p>
      </header>

      <ol className="surface mt-7 grid grid-cols-2 gap-1 p-2 sm:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${index === currentStep ? 'bg-slate-900 font-semibold text-white' : index < currentStep ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`grid size-6 place-items-center rounded-full text-xs ${index === currentStep ? 'bg-white/15' : 'bg-slate-100'}`}>{index < currentStep ? <Check size={14} /> : index + 1}</span>{step}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold">{currentStep === 0 ? '실시간 카메라' : currentStep === 1 ? '캡처 이미지' : '좌석 영역 편집 이미지'}</h2>
            <span className={`flex items-center gap-2 text-xs font-medium ${cameraConnected ? 'text-emerald-600' : 'text-rose-600'}`}>
              <i className={`size-2 rounded-full ${cameraConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />{cameraConnected ? '연결됨' : '연결 안 됨'}
            </span>
          </div>

          {currentStep === 2 && <div className={`px-5 py-3 text-xs font-medium ${drawingEnabled ? 'bg-emerald-600 text-white' : 'bg-brand-700 text-white'}`}>{drawingEnabled ? '좌석 외곽선을 따라 꼭짓점을 차례대로 클릭하세요. 첫 점을 다시 누르면 영역이 완성됩니다.' : '영역을 클릭하면 이동하거나 꼭짓점을 드래그해 모양을 조절할 수 있습니다.'}</div>}
          {currentStep === 2 && capturedImageUrl ? (
            <div
              className="relative w-full min-h-[240px] overflow-hidden bg-slate-900"
              style={{ aspectRatio: displayFrameSize ? `${displayFrameSize.width} / ${displayFrameSize.height}` : '16 / 9' }}
            >
              <SeatRoiEditor imageUrl={capturedImageUrl} regions={regions} onChange={setRegions} selectedId={selectedRegionId} onSelect={setSelectedRegionId} drawingEnabled={drawingEnabled} onDrawingComplete={() => setDrawingEnabled(false)} newRegionLabel={newRegionLabel} />
            </div>
          ) : currentStep >= 1 && capturedImageUrl ? (
            <CameraFrameView
              imageUrl={capturedImageUrl}
              naturalWidth={displayFrameSize?.width}
              naturalHeight={displayFrameSize?.height}
              alt="캡처된 카메라 화면"
            />
          ) : cameraConnected && liveFrame ? (
            <CameraFrameView
              imageUrl={liveFrame.url}
              naturalWidth={liveFrame.width}
              naturalHeight={liveFrame.height}
              alt="최신 카메라 프레임"
            />
          ) : (
            <div className="relative grid min-h-[240px] aspect-video place-items-center overflow-hidden bg-slate-900">
              <div className="text-center text-slate-400">
                {imageError ? <TriangleAlert className="mx-auto" size={40} /> : <Camera className="mx-auto" size={40} />}
                <p className="mt-3 text-sm">{imageError ? '카메라 프레임을 불러오지 못했습니다.' : '카메라 연결을 기다리고 있습니다.'}</p>
                <p className="mt-1 text-xs text-slate-600">백엔드 서버와 카메라 상태를 확인해주세요.</p>
              </div>
            </div>
          )}

          <div className="flex gap-6 px-5 py-3 text-xs text-slate-500">
            <span>좌석 수 <b className="ml-1 text-slate-700">{currentStep === 2 ? regions.length : health.data?.seat_count ?? '-'}</b></span>
            <span>ROI <b className="ml-1 text-slate-700">{currentStep === 2 ? regions.length > 0 ? '편집 중' : '미설정' : health.data?.roi_configured ? '설정됨' : '미설정'}</b></span>
          </div>
        </section>

        <aside className="surface p-6">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">{currentStep === 0 ? <MonitorUp size={22} /> : <Camera size={22} />}</div>
          <h2 className="mt-5 font-bold">{currentStep === 0 ? '카메라 상태' : currentStep === 1 ? '캡처 확인' : '좌석 영역 지정'}</h2>

          {currentStep === 0 ? (
            <ul className="mt-4 space-y-3 text-sm">
              {['백엔드 서버 연결', '카메라 연결', '좌석 영역 설정'].map((item, index) => {
                const ok = index === 0 ? health.isSuccess : index === 1 ? cameraConnected : health.data?.roi_configured
                return <li key={item} className={`flex items-center gap-2 ${ok ? 'text-slate-600' : 'text-rose-600'}`}>{ok ? <Check size={16} className="text-emerald-500" /> : <TriangleAlert size={16} />}{item}</li>
              })}
            </ul>
          ) : currentStep === 1 ? (
            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"><Check size={17} className="mb-2" />기준 화면 캡처가 완료되었습니다.</div>
          ) : (
            <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm leading-6 text-brand-700">좌석 외곽선을 따라 포인트를 3개 이상 찍으세요. 첫 포인트를 다시 클릭하거나 완료 버튼을 누르면 폴리곤이 만들어집니다.</div>
          )}

          {currentStep === 2 && <Button variant="outline" className="mt-4 w-full" onClick={() => { if (selectedLabelParts) setCreationGroup({ table: selectedLabelParts.table, row: selectedLabelParts.row }); setDrawingEnabled(true); setSelectedRegionId(null) }}><Plus size={16} className="mr-2" />새 좌석 영역 추가</Button>}

          {currentStep === 2 && selectedRegion && seatLabelDraft && <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-700"><Pencil size={14} />선택한 좌석 편집</div><div className="mt-3 grid grid-cols-3 gap-2"><label className="text-[10px] text-slate-500">테이블<input aria-label="테이블 번호" value={seatLabelDraft.table} onChange={(event) => setSeatLabelDraft((current) => current ? { ...current, table: event.target.value } : current)} onBlur={() => commitSelectedSeatLabel('table')} onKeyDown={handleSeatLabelKeyDown} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold uppercase outline-none focus:border-brand-500" /></label><label className="text-[10px] text-slate-500">행<input aria-label="좌석 행" value={seatLabelDraft.row} onChange={(event) => setSeatLabelDraft((current) => current ? { ...current, row: event.target.value } : current)} onBlur={() => commitSelectedSeatLabel('row')} onKeyDown={handleSeatLabelKeyDown} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold uppercase outline-none focus:border-brand-500" /></label><label className="text-[10px] text-slate-500">번호<input aria-label="좌석 번호" value={seatLabelDraft.number} onChange={(event) => setSeatLabelDraft((current) => current ? { ...current, number: event.target.value } : current)} onBlur={() => commitSelectedSeatLabel('number')} onKeyDown={handleSeatLabelKeyDown} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold outline-none focus:border-brand-500" /></label></div><div className="mt-3 rounded-lg bg-white px-3 py-2 text-center text-xs font-bold text-brand-700">{seatLabelDraft.table}-{seatLabelDraft.row}-{seatLabelDraft.number}</div><p className="mt-2 text-[11px] leading-4 text-slate-400">입력을 마치고 Enter를 누르거나 다른 곳을 클릭하면 좌석 ID가 정리됩니다.</p></div>}

          {currentStep === 2 && <div className="mt-5"><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700">설정된 좌석</h3><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500">{regions.length}석</span></div><div className="max-h-52 space-y-2 overflow-y-auto pr-1">{regions.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">새 좌석 영역을 추가해주세요.</p> : regions.map((region) => <div key={region.id} className={`flex items-center gap-2 rounded-lg border p-2 ${selectedRegionId === region.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}><button className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold text-slate-700" onClick={() => { setSelectedRegionId(region.id); setDrawingEnabled(false) }}><i className="size-2 shrink-0 rounded-full bg-emerald-500" /><span className="truncate">{region.label}</span></button><button aria-label={`${region.label} 삭제`} className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => { setRegions((current) => current.filter((item) => item.id !== region.id)); if (selectedRegionId === region.id) setSelectedRegionId(null) }}><Trash2 size={14} /></button></div>)}</div></div>}

          {health.data?.camera_error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{health.data.camera_error}</p>}
          {captureError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{captureError}</p>}
          {createSuggestion.isError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{getLayoutSuggestionErrorMessage(createSuggestion.error)}</p>}
          {saveLayout.isError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">좌석 배치 저장에 실패했습니다. 서버 연결을 확인해주세요.</p>}
          {saveLayout.isSuccess && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">좌석 설정이 저장되었습니다.</p>}
          {layout.isError && currentStep === 1 && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">기존 좌석 배치를 불러오지 못했습니다. 새 배치로 계속 편집할 수 있습니다.</p>}

          <div className="mt-7 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            <MousePointer2 size={16} className="mb-2 text-slate-700" />{currentStep === 0 ? '현재 카메라 프레임을 기준 화면으로 캡처합니다.' : currentStep === 1 ? '이미지가 선명하지 않다면 다시 캡처할 수 있습니다.' : '폴리곤을 선택하면 각 꼭짓점과 전체 위치를 조정할 수 있습니다.'}
          </div>

          {currentStep === 0 ? (
            <Button className="mt-5 w-full" disabled={!cameraConnected || isCapturing} onClick={captureCurrentFrame}>{isCapturing ? '캡처 중...' : '현재 화면 캡처'}</Button>
          ) : currentStep === 1 ? (
            <div className="mt-5 grid gap-2">
              <Button disabled={!capturedImageBlob || !suggestionAvailable || createSuggestion.isPending} onClick={() => requestLayoutSuggestion()}>{createSuggestion.isPending ? 'AI 분석 중...' : 'AI 자동 좌석 설정'}</Button>
              <Button disabled={layout.isLoading} onClick={openRoiEditor}>{layout.isLoading ? '기존 배치 불러오는 중...' : '다음: 좌석 영역 지정'}</Button>
              <Button variant="outline" onClick={goBackToCamera}><RefreshCw size={15} className="mr-2" />다시 캡처</Button>
            </div>
          ) : (
            <div className="mt-5 grid gap-2">
              <Button disabled={regions.length === 0 || saveLayout.isPending} onClick={saveRegions}><Save size={15} className="mr-2" />{saveLayout.isPending ? '저장 중...' : `좌석 ${regions.length}개 저장`}</Button>
              <Button variant="outline" disabled={!capturedImageBlob || !suggestionAvailable || createSuggestion.isPending} onClick={() => requestLayoutSuggestion()}>{createSuggestion.isPending ? 'AI 분석 중...' : 'AI 자동 좌석 설정'}</Button>
              <Button variant="outline" disabled={!selectedRegionId} onClick={() => { setRegions((current) => current.filter((region) => region.id !== selectedRegionId)); setSelectedRegionId(null) }}><Trash2 size={15} className="mr-2" />선택 영역 삭제</Button>
              <Button variant="ghost" onClick={() => setCurrentStep(1)}>이전: 캡처 확인</Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
