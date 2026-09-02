import { Camera, LogOut, Video } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import seatMonitorLogo from '@/assets/library-seat-logo.png'
import { cn } from '@/lib/utils'
import { demoApi } from '@/services/demo-api'

const links = [{ to: '/admin/layout', label: '좌석 영역 설정', icon: Camera }, { to: '/admin/camera-demo', label: '카메라 · 시연 영상', icon: Video }]
export function AdminLayout() {
  const navigate = useNavigate()
  const logout = async () => { try { await demoApi.exitDemo() } catch { /* already in camera mode */ }; sessionStorage.removeItem('adminAuthenticated'); navigate('/', { replace: true }) }
  return <div className="min-h-screen bg-[#f5f7fb] lg:grid lg:grid-cols-[260px_1fr]"><aside className="border-b border-slate-200 bg-white px-5 py-4 lg:fixed lg:inset-y-0 lg:flex lg:w-[260px] lg:flex-col lg:border-b-0 lg:border-r lg:py-7"><div className="flex items-center gap-3 px-2"><img src={seatMonitorLogo} alt="SeatMonitor" className="size-10 object-contain" /><div><strong className="block text-sm">SeatMonitor</strong><span className="text-xs text-slate-400">관리자 콘솔</span></div></div><nav className="mt-6 flex gap-2 overflow-x-auto lg:flex-col">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => cn('flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50')}><Icon size={18} />{label}</NavLink>)}</nav><button onClick={logout} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600 lg:mt-auto"><LogOut size={18} />로그아웃</button></aside><main className="min-w-0 p-5 sm:p-8 lg:col-start-2 lg:p-10"><Outlet /></main></div>
}
