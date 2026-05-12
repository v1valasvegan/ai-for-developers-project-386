import type {
  Booking,
  CreateBookingPayload,
  CreateEventTypePayload,
  ErrorResponse,
  EventType,
  Slot,
  UpdateEventTypePayload,
} from '../types/api'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ErrorResponse | null
    const message = errorBody?.message ?? errorBody?.error ?? `Request failed with status ${response.status}`
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function getPublicEventTypes(): Promise<EventType[]> {
  const data = await request<EventType[] | { eventTypes: EventType[] }>('/event-types')

  if (Array.isArray(data)) {
    return data
  }

  return data.eventTypes ?? []
}

export async function getAdminEventTypes(): Promise<EventType[]> {
  const data = await request<EventType[] | { eventTypes: EventType[] }>('/admin/event-types')

  if (Array.isArray(data)) {
    return data
  }

  return data.eventTypes ?? []
}

export async function createEventType(payload: CreateEventTypePayload): Promise<EventType> {
  const data = await request<EventType | { eventType: EventType }>('/admin/event-types', {
    method: 'POST',
    body: payload,
  })

  if ('id' in data) {
    return data
  }

  return data.eventType
}

export async function updateEventType(payload: UpdateEventTypePayload): Promise<EventType> {
  const data = await request<EventType | { eventType: EventType }>(`/admin/event-types/${payload.id}`, {
    method: 'PATCH',
    body: {
      name: payload.name,
      description: payload.description,
      durationMinutes: payload.durationMinutes,
      slotStepMinutes: payload.slotStepMinutes,
    },
  })

  if ('id' in data) {
    return data
  }

  return data.eventType
}

export async function getAdminBookings(): Promise<Booking[]> {
  const data = await request<Booking[] | { bookings: Booking[] }>('/admin/bookings')

  if (Array.isArray(data)) {
    return data
  }

  return data.bookings ?? []
}

export async function getSlots(eventTypeId: string, params?: { from?: string; to?: string }): Promise<Slot[]> {
  const query = new URLSearchParams()

  if (params?.from) {
    query.set('from', params.from)
  }

  if (params?.to) {
    query.set('to', params.to)
  }

  const suffix = query.toString() ? `?${query.toString()}` : ''
  const data = await request<Slot[] | { slots: Slot[] }>(`/event-types/${eventTypeId}/slots${suffix}`)

  if (Array.isArray(data)) {
    return data
  }

  return data.slots ?? []
}

export async function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  const data = await request<Booking | { booking: Booking }>('/bookings', {
    method: 'POST',
    body: payload,
  })

  if ('id' in data) {
    return data
  }

  return data.booking
}
