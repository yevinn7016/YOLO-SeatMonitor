import { ArrowRight, Settings2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import seatMonitorLogo from '@/assets/library-seat-logo.png'

export function RoleSelectPage() {
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#e5f3ff,transparent_38%)] px-5 py-12"><div className="w-full max-w-4xl">
    <header className="text-center"><img src={seatMonitorLogo} alt="SeatMonitor 로고" className="mx-auto size-20 object-contain" /><p className="mt-5 text-sm font-semibold text-brand-600">SMART SEAT MANAGEMENT</p><h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">SeatMonitor</h1><p className="mx-auto mt-3 max-w-xl text-slate-500">실시간 좌석 현황을 확인하거나, 관리자 도구에서 카메라와 좌석 영역을 설정하세요.</p></header>
    <section className="mt-10 grid gap-5 md:grid-cols-2">
      <Link to="/seats" className="group surface p-7 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Users /></span><h2 className="mt-6 text-xl font-bold text-slate-900">사용자</h2><p className="mt-2 text-sm text-slate-500">좌석 현황 확인</p><span className="mt-7 flex items-center gap-2 text-sm font-semibold text-brand-600">현황 보러 가기 <ArrowRight size={16} /></span></Link>
      <Link to="/admin/login" className="group surface p-7 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl"><span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Settings2 /></span><h2 className="mt-6 text-xl font-bold text-slate-900">관리자</h2><p className="mt-2 text-sm text-slate-500">시스템 관리</p><span className="mt-7 flex items-center gap-2 text-sm font-semibold text-brand-600">관리자 로그인 <ArrowRight size={16} /></span></Link>
    </section>
  </div></main>
}
