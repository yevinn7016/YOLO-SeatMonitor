import type { Seat } from '@/types/seat'

const statuses: Seat['status'][] = ['occupied', 'available', 'occupied', 'away', 'available', 'noShow']

export const mockSeats: Seat[] = Array.from({ length: 24 }, (_, index) => ({
  id: `seat-${index + 1}`,
  label: `${index + 1}`.padStart(2, '0'),
  tableId: `T${Math.floor(index / 6) + 1}`,
  status: statuses[index % statuses.length],
  awayMinutes: statuses[index % statuses.length] === 'away' ? 18 : 0,
}))
