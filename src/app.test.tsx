// 앱의 역할 선택 진입 화면이 정상적으로 표시되는지 검사한다.
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { App } from '@/app'

it('역할 선택 시작 화면을 표시한다', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter><App /></MemoryRouter></QueryClientProvider>)
  expect(screen.getByRole('heading', { name: 'SeatMonitor' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /사용자 좌석 현황 확인/ })).toHaveAttribute('href', '/seats')
  expect(screen.getByRole('link', { name: /관리자 시스템 관리/ })).toHaveAttribute('href', '/admin/login')
})
