//대시보드와 좌석 설정 화면의 URL 라우팅을 정의
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardPage } from '@/pages/dashboard-page'
import { SeatSettingsPage } from '@/pages/seat-settings-page'
import { DemoPage } from '@/pages/demo-page'

export function App() {
  return <Routes><Route element={<AppShell />}><Route index element={<DashboardPage />} /><Route path="seat-settings" element={<SeatSettingsPage />} /><Route path="demo" element={<DemoPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>
}
