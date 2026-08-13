import { expect, test } from '@playwright/test'

test('관리자 대시보드와 좌석 설정 화면을 탐색한다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '좌석 현황' })).toBeVisible()
  await page.getByRole('link', { name: '좌석 영역 설정' }).click()
  await expect(page.getByRole('heading', { name: '카메라 확인' })).toBeVisible()
})
