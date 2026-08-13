import type { RoiRegion } from '@/components/seat-roi-editor'
import type { SeatLayout } from '@/types/seat'

const clampUnit = (value: number) => Math.min(Math.max(value, 0), 1)

export function layoutToRegions(layout?: SeatLayout): RoiRegion[] {
  if (!layout) return []

  return layout.seats.flatMap((seat, index) => {
    if (seat.polygon.length < 3) return []
    const points = seat.polygon.map((point) => ({ x: clampUnit(point.x), y: clampUnit(point.y) }))

    return [{
      id: `saved-${index}-${seat.seat_id}`,
      label: seat.label || seat.seat_id,
      points,
    }]
  })
}
