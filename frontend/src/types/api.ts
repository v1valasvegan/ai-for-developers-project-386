export type SlotStep = 15 | 30

export type EventType = {
  id: string
  name: string
  description: string
  durationMinutes: number
  slotStepMinutes: SlotStep
}

export type Slot = {
  startAt: string
  endAt: string
  isAvailable: boolean
}

export type Booking = {
  id: string
  eventTypeId: string
  startAt: string
  endAt: string
  guestName: string
  guestEmail: string
  guestPhone?: string
  guestComment?: string
  createdAt: string
}

export type CreateBookingPayload = {
  eventTypeId: string
  startAt: string
  guestName: string
  guestEmail: string
  guestPhone?: string
  guestComment?: string
}

export type CreateEventTypePayload = {
  name: string
  description: string
  durationMinutes: number
  slotStepMinutes: SlotStep
}

export type UpdateEventTypePayload = CreateEventTypePayload & {
  id: string
}

export type ErrorResponse = {
  error: string
  message?: string
}
