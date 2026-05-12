package storage

import (
	"sort"
	"sync"
	"time"

	"github.com/v1valasvegan/ai-for-developers-project-386/backend/internal/domain"
)

type Memory struct {
	mu         sync.RWMutex
	eventTypes map[string]domain.EventType
	bookings   map[string]domain.Booking
}

func NewMemory() *Memory {
	return &Memory{
		eventTypes: map[string]domain.EventType{},
		bookings:   map[string]domain.Booking{},
	}
}

func (m *Memory) AddEventType(eventType domain.EventType) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.eventTypes[eventType.ID] = eventType
}

func (m *Memory) GetEventType(id string) (domain.EventType, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	eventType, ok := m.eventTypes[id]
	return eventType, ok
}

func (m *Memory) UpdateEventType(id string, update func(*domain.EventType)) (domain.EventType, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	eventType, ok := m.eventTypes[id]
	if !ok {
		return domain.EventType{}, false
	}

	update(&eventType)
	m.eventTypes[id] = eventType
	return eventType, true
}

func (m *Memory) ListEventTypes() []domain.EventType {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]domain.EventType, 0, len(m.eventTypes))
	for _, eventType := range m.eventTypes {
		result = append(result, eventType)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	return result
}

func (m *Memory) ListBookings() []domain.Booking {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]domain.Booking, 0, len(m.bookings))
	for _, booking := range m.bookings {
		result = append(result, booking)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].StartAt.Before(result[j].StartAt)
	})

	return result
}

func (m *Memory) AddBooking(booking domain.Booking) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.bookings[booking.ID] = booking
}

func (m *Memory) AddBookingIfNoOverlap(booking domain.Booking) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, existing := range m.bookings {
		if intervalsOverlap(booking.StartAt, booking.EndAt, existing.StartAt, existing.EndAt) {
			return false
		}
	}

	m.bookings[booking.ID] = booking
	return true
}

func intervalsOverlap(startA, endA, startB, endB time.Time) bool {
	return startA.Before(endB) && startB.Before(endA)
}
