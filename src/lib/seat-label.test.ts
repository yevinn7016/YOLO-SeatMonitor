import { describe, expect, it } from 'vitest'
import { createNextSeatLabel, findNextSeatNumber, formatSeatLabel, parseSeatLabel } from '@/lib/seat-label'

describe('seat label', () => {
  it('구조화된 좌석 ID를 분석한다', () => {
    expect(parseSeatLabel('T02-B-03')).toEqual({ table: 'T02', row: 'B', number: '03' })
  })

  it('테이블, 행, 번호를 좌석 ID로 조합한다', () => {
    expect(formatSeatLabel({ table: '2', row: 'b', number: '3' })).toBe('T02-B-03')
  })

  it('첫 좌석은 T01-A-01로 생성한다', () => {
    expect(createNextSeatLabel([])).toBe('T01-A-01')
  })

  it('T01 A행에서 삭제된 가장 작은 번호를 재사용한다', () => {
    expect(createNextSeatLabel(['T01-A-01', 'T01-A-03', 'T02-A-02'])).toBe('T01-A-02')
  })

  it('테이블이나 행이 바뀌면 해당 조합의 빈 번호를 1부터 찾는다', () => {
    expect(findNextSeatNumber(['T01-A-01', 'T02-B-01', 'T02-B-03'], 'T02', 'B')).toBe('02')
    expect(findNextSeatNumber(['T01-A-01'], 'T03', 'C')).toBe('01')
  })
})
