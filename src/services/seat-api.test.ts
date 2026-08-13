import { afterEach, describe, expect, it, vi } from 'vitest'
import { seatApi } from '@/services/seat-api'

afterEach(() => vi.restoreAllMocks())

describe('seatApi', () => {
  it('좌석 상태 응답을 반환한다', async () => {
    const payload = [{ seat_id: 'T01-A-01', status: 'occupied', detections: [], updated_at: '2026-08-05T15:30:00+09:00', away_since: null }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(seatApi.getSeats()).resolves.toEqual(payload)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/seats$/),
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    )
  })

  it('resets one seat timer with POST', async () => {
    const payload = { seat_id: 'T01-A-01', status: 'empty', detections: [], updated_at: '2026-08-05T15:30:00+09:00', away_since: null }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await seatApi.resetSeatTimer('T01-A-01')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/seats\/T01-A-01\/reset$/),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('resets every seat timer with POST', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await seatApi.resetAllSeatTimers()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/seats\/reset$/),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('설정을 PUT 요청으로 저장한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))
    await seatApi.saveSettings({ noshow_threshold_seconds: 600 })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/settings$/),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ noshow_threshold_seconds: 600 }) }),
    )
  })
})
