export type ApiSeatStatus = 'empty' | 'occupied' | 'away' | 'noshow'
export type SeatStatus = 'available' | 'occupied' | 'away' | 'noShow'

export interface Point {
  x: number
  y: number
}

export interface LayoutSeat {
  seat_id: string
  label: string
  polygon: Point[]
}

export interface SeatLayout {
  version: number
  seats: LayoutSeat[]
}

export interface Detection {
  class_id: number
  class_name: string
  confidence: number
  box: [number, number, number, number]
}

export interface SeatState {
  seat_id: string
  status: ApiSeatStatus
  detections: Detection[]
  updated_at: string
  away_since: string | null
}

export interface HealthStatus {
  status: 'ok' | string
  camera_connected: boolean
  camera_error: string | null
  roi_configured: boolean
  seat_count: number
}

export interface NoShowSettings {
  noshow_threshold_seconds: number
}

export interface Seat {
  id: string
  label: string
  tableId: string
  status: SeatStatus
  awayMinutes: number
}
