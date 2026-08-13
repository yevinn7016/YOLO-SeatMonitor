import { Camera, LayoutDashboard, LogOut, Settings2 } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import seatMonitorLogo from '@/assets/library-seat-logo.png'

const links = [
  { to: '/', label: '좌석 현황', icon: LayoutDashboard },
  { to: '/seat-settings', label: '좌석 영역 설정', icon: Camera },
]

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-slate-200 bg-white px-5 py-4 lg:fixed lg:inset-y-0 lg:w-60 lg:border-b-0 lg:border-r lg:py-7">
        <div className="flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-white"><img src={seatMonitorLogo} alt="SeatMonitor 로고" className="size-10 object-contain" /></span>
          <div><strong className="block text-sm">SeatMonitor</strong><span className="text-xs text-slate-400">좌석 관리 시스템</span></div>
        </div>
        <nav className="mt-7 flex gap-2 lg:flex-col">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50')}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 hidden border-t border-slate-100 pt-4 lg:block">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50"><Settings2 size={18} />환경 설정</button>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50"><LogOut size={18} />로그아웃</button>
        </div>
      </aside>
      <main className="min-w-0 p-5 sm:p-8 lg:col-start-2 lg:p-10"><Outlet /></main>
    </div>
  )
}
