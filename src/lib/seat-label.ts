const STRUCTURED_SEAT_PATTERN = /^(T\d+)-([A-Z]+)-(\d+)$/

export interface SeatLabelParts {
  table: string
  row: string
  number: string
}

export function parseSeatLabel(label: string): SeatLabelParts | null {
  const match = STRUCTURED_SEAT_PATTERN.exec(label.toUpperCase())
  if (!match) return null
  return { table: match[1], row: match[2], number: match[3] }
}

export function formatSeatLabel(parts: SeatLabelParts) {
  const tableNumber = parts.table.replace(/\D/g, '') || '1'
  const row = parts.row.replace(/[^A-Z]/gi, '').toUpperCase() || 'A'
  const seatNumber = parts.number.replace(/\D/g, '') || '1'
  return `T${tableNumber.padStart(2, '0')}-${row}-${seatNumber.padStart(2, '0')}`
}

export function findNextSeatNumber(labels: string[], table: string, row: string) {
  const normalized = parseSeatLabel(formatSeatLabel({ table, row, number: '1' }))!
  const usedNumbers = new Set(
    labels
      .map(parseSeatLabel)
      .filter((parts): parts is SeatLabelParts => parts?.table === normalized.table && parts.row === normalized.row)
      .map((parts) => Number(parts.number))
      .filter((value) => Number.isInteger(value) && value > 0),
  )

  let nextNumber = 1
  while (usedNumbers.has(nextNumber)) nextNumber += 1
  return String(nextNumber).padStart(2, '0')
}

export function createNextSeatLabel(labels: string[]) {
  return formatSeatLabel({ table: 'T01', row: 'A', number: findNextSeatNumber(labels, 'T01', 'A') })
}
