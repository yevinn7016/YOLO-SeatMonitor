import { describe, expect, it } from 'vitest'
import { layoutToRegions } from '@/lib/layout-mapper'

describe('layoutToRegions', () => {
  it('저장된 polygon의 꼭짓점을 그대로 편집 데이터로 변환한다', () => {
    const regions = layoutToRegions({
      version: 1,
      seats: [{
        seat_id: 'SEAT-02',
        label: 'SEAT-02',
        polygon: [{ x: 0.2, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.4 }, { x: 0.2, y: 0.4 }],
      }],
    })
    expect(regions[0]).toMatchObject({ label: 'SEAT-02' })
    expect(regions[0].points).toEqual([
      { x: 0.2, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.4 }, { x: 0.2, y: 0.4 },
    ])
  })

  it('유효하지 않은 polygon은 제외한다', () => {
    expect(layoutToRegions({ version: 1, seats: [{ seat_id: 'A', label: 'A', polygon: [] }] })).toEqual([])
  })
})
