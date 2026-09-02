import { expect, test } from '@playwright/test'

test('역할 선택부터 관리자 좌석 설정까지 주요 화면을 탐색한다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'SeatMonitor' })).toBeVisible()

  await page.getByRole('link', { name: /사용자.*좌석 현황 확인/ }).click()
  await expect(page).toHaveURL('/seats')
  await expect(page.getByRole('heading', { name: '실시간 좌석 현황' })).toBeVisible()

  await page.getByRole('link', { name: '처음으로' }).click()
  await expect(page).toHaveURL('/')

  await page.getByRole('link', { name: /관리자.*시스템 관리/ }).click()
  await expect(page).toHaveURL('/admin/login')
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible()

  await page.getByLabel('비밀번호').fill('0000')
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL('/admin/layout')
  await expect(page.getByRole('heading', { name: '카메라 확인' })).toBeVisible()

  await page.getByRole('link', { name: '카메라 · 시연 영상' }).click()
  await expect(page).toHaveURL('/admin/camera-demo')
  await expect(page.getByRole('heading', { name: '카메라 · 시연 영상 통합 테스트' })).toBeVisible()
})
