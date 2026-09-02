import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function AdminLoginPage() {
  const navigate = useNavigate(); const [password, setPassword] = useState(''); const [error, setError] = useState('')
  if (sessionStorage.getItem('adminAuthenticated') === 'true') return <Navigate to="/admin/layout" replace />
  const submit = (event: FormEvent) => { event.preventDefault(); if (password !== '0000') { setError('비밀번호가 올바르지 않습니다.'); return }; sessionStorage.setItem('adminAuthenticated', 'true'); navigate('/admin/layout', { replace: true }) }
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5"><form onSubmit={submit} className="surface w-full max-w-md p-7 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><LockKeyhole /></span><h1 className="mt-6 text-2xl font-bold text-slate-900">관리자 로그인</h1><p className="mt-2 text-sm text-slate-500">관리자 도구에 접근하려면 비밀번호를 입력하세요.</p><label className="mt-7 block text-sm font-semibold text-slate-700">비밀번호<input autoFocus type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} aria-invalid={Boolean(error)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></label>{error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}<Button type="submit" className="mt-6 w-full">로그인</Button><Link to="/" className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-500"><ArrowLeft size={15} />처음으로</Link></form></main>
}
