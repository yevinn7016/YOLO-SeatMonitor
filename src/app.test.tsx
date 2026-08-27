//앱의 기본 대시보드 화면이 정상적으로 표시되는지 검사 코드
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { App } from '@/app'

it('좌석 현황 대시보드를 표시한다', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter><App /></MemoryRouter></QueryClientProvider>)
  expect(screen.getByRole('heading', { name: '좌석 현황' })).toBeInTheDocument()
  expect(screen.getByText('서버 연결 끊김')).toBeInTheDocument()
})
