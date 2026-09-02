import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/admin-layout'
import { AdminLoginPage } from '@/pages/admin-login-page'
import { CameraDemoPage } from '@/pages/camera-demo-page'
import { RoleSelectPage } from '@/pages/role-select-page'
import { SeatSettingsPage } from '@/pages/seat-settings-page'
import { SeatStatusPage } from '@/pages/seat-status-page'

function AdminGuard() {
  return sessionStorage.getItem('adminAuthenticated') === 'true' ? <Outlet /> : <Navigate to="/admin/login" replace />
}

export function App() {
  return <Routes>
    <Route path="/" element={<RoleSelectPage />} />
    <Route path="/seats" element={<SeatStatusPage />} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route element={<AdminGuard />}><Route path="/admin" element={<AdminLayout />}><Route index element={<Navigate to="layout" replace />} /><Route path="layout" element={<SeatSettingsPage />} /><Route path="camera-demo" element={<CameraDemoPage />} /></Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
