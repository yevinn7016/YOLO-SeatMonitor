import { Camera, Film } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LiveCameraPanel } from '@/components/camera-demo/live-camera-panel'
import { useSettingsQuery, useSaveSettingsMutation } from '@/hooks/use-seat-api'
import { DemoPage } from '@/pages/demo-page'
import { demoApi } from '@/services/demo-api'

export function CameraDemoPage() {
  const [mode, setMode] = useState<'camera' | 'demo'>('camera')
  const settings = useSettingsQuery(); const saveSettings = useSaveSettingsMutation(); const [threshold, setThreshold] = useState<number | null>(null)
  const changeMode = async (next: 'camera' | 'demo') => { if (mode === 'demo' && next === 'camera') { try { await demoApi.exitDemo() } catch { /* surface health state below */ } }; setMode(next) }
  const seconds = threshold ?? settings.data?.noshow_threshold_seconds ?? 600
  return <div className="mx-auto max-w-7xl"><header><p className="text-sm font-semibold text-brand-600">관리자 테스트 도구</p><h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">카메라 · 시연 영상 통합 테스트</h1><p className="mt-2 text-sm text-slate-500">실제 카메라와 업로드 영상을 같은 좌석 판정 흐름으로 확인합니다.</p></header><div className="mt-7 flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => changeMode('camera')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'camera' ? 'bg-brand-600 text-white' : 'text-slate-500'}`}><Camera size={16} />실시간 카메라</button><button onClick={() => changeMode('demo')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'demo' ? 'bg-brand-600 text-white' : 'text-slate-500'}`}><Film size={16} />시연 영상</button></div><form onSubmit={(e) => { e.preventDefault(); saveSettings.mutate({ noshow_threshold_seconds: Math.max(1, seconds) }) }} className="flex items-center gap-2"><label className="text-xs font-medium text-slate-500">노쇼 기준(초)<input type="number" min="1" value={seconds} onChange={(e) => setThreshold(Number(e.target.value))} className="ml-2 h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-500" /></label><Button type="submit" variant="outline" disabled={saveSettings.isPending}>저장</Button></form></div><div className="mt-6">{mode === 'camera' ? <LiveCameraPanel /> : <DemoPage />}</div></div>
}
