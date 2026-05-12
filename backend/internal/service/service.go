package service

import (
	"crypto/rand"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/v1valasvegan/ai-for-developers-project-386/backend/internal/domain"
	"github.com/v1valasvegan/ai-for-developers-project-386/backend/internal/storage"
)

const bookingWindowDays = 14

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type Service struct {
	store *storage.Memory
	nowFn func() time.Time
}

type CreateEventTypeInput struct {
	Name            string
	Description     string
	DurationMinutes int
	SlotStepMinutes int
}

type UpdateEventTypeInput struct {
	Name            *string
	Description     *string
	DurationMinutes *int
	SlotStepMinutes *int
}

type SlotFilter struct {
	From *time.Time
	To   *time.Time
}

type CreateBookingInput struct {
	EventTypeID  string
	StartAt      time.Time
	GuestName    string
	GuestEmail   string
	GuestPhone   *string
	GuestComment *string
}

func New(store *storage.Memory) *Service {
	return &Service{store: store, nowFn: time.Now}
}

func (s *Service) CreateEventType(input CreateEventTypeInput) (domain.EventType, error) {
	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Description) == "" {
		return domain.EventType{}, fmt.Errorf("name and description are required: %w", ErrBadRequest)
	}

	if input.DurationMinutes <= 0 {
		return domain.EventType{}, fmt.Errorf("durationMinutes must be positive: %w", ErrBadRequest)
	}

	if !isValidStep(input.SlotStepMinutes) {
		return domain.EventType{}, fmt.Errorf("slotStepMinutes must be 15 or 30: %w", ErrBadRequest)
	}

	eventType := domain.EventType{
		ID:              newID(),
		Name:            input.Name,
		Description:     input.Description,
		DurationMinutes: input.DurationMinutes,
		SlotStepMinutes: input.SlotStepMinutes,
	}

	s.store.AddEventType(eventType)
	return eventType, nil
}

func (s *Service) ListEventTypes() []domain.EventType {
	return s.store.ListEventTypes()
}

func (s *Service) UpdateEventType(id string, input UpdateEventTypeInput) (domain.EventType, error) {
	current, ok := s.store.GetEventType(id)
	if !ok {
		return domain.EventType{}, fmt.Errorf("event type not found: %w", ErrNotFound)
	}

	updated := current

	if input.Name != nil {
		updated.Name = *input.Name
	}

	if input.Description != nil {
		updated.Description = *input.Description
	}

	if input.DurationMinutes != nil {
		updated.DurationMinutes = *input.DurationMinutes
	}

	if input.SlotStepMinutes != nil {
		updated.SlotStepMinutes = *input.SlotStepMinutes
	}

	if strings.TrimSpace(updated.Name) == "" || strings.TrimSpace(updated.Description) == "" {
		return domain.EventType{}, fmt.Errorf("name and description are required: %w", ErrBadRequest)
	}

	if updated.DurationMinutes <= 0 {
		return domain.EventType{}, fmt.Errorf("durationMinutes must be positive: %w", ErrBadRequest)
	}

	if !isValidStep(updated.SlotStepMinutes) {
		return domain.EventType{}, fmt.Errorf("slotStepMinutes must be 15 or 30: %w", ErrBadRequest)
	}

	updated, _ = s.store.UpdateEventType(id, func(eventType *domain.EventType) {
		*eventType = updated
	})

	return updated, nil
}

func (s *Service) ListUpcomingBookings() []domain.Booking {
	now := s.nowFn().UTC()
	result := make([]domain.Booking, 0)

	for _, booking := range s.store.ListBookings() {
		if booking.EndAt.After(now) {
			result = append(result, booking)
		}
	}

	return result
}

func (s *Service) ListSlots(eventTypeID string, filter SlotFilter) ([]domain.Slot, error) {
	eventType, ok := s.store.GetEventType(eventTypeID)
	if !ok {
		return nil, fmt.Errorf("event type not found: %w", ErrNotFound)
	}

	now := s.nowFn().UTC()
	windowStart := now
	windowEnd := now.AddDate(0, 0, bookingWindowDays)

	if filter.From != nil {
		from := filter.From.UTC()
		if from.Before(windowStart) || !from.Before(windowEnd) {
			return nil, fmt.Errorf("from must be in 14-day window: %w", ErrBadRequest)
		}
		windowStart = from
	}

	if filter.To != nil {
		to := filter.To.UTC()
		if to.After(windowEnd) || !to.After(windowStart) {
			return nil, fmt.Errorf("to must be in 14-day window and after from: %w", ErrBadRequest)
		}
		windowEnd = to
	}

	step := time.Duration(eventType.SlotStepMinutes) * time.Minute
	duration := time.Duration(eventType.DurationMinutes) * time.Minute

	bookings := s.store.ListBookings()
	slots := make([]domain.Slot, 0)

	for start := windowStart; start.Add(duration).Before(windowEnd) || start.Add(duration).Equal(windowEnd); start = start.Add(step) {
		end := start.Add(duration)

		isAvailable := true
		for _, booking := range bookings {
			if intervalsOverlap(start, end, booking.StartAt, booking.EndAt) {
				isAvailable = false
				break
			}
		}

		slots = append(slots, domain.Slot{
			StartAt:     start,
			EndAt:       end,
			IsAvailable: isAvailable,
		})
	}

	return slots, nil
}

func (s *Service) CreateBooking(input CreateBookingInput) (domain.Booking, error) {
	eventType, ok := s.store.GetEventType(input.EventTypeID)
	if !ok {
		return domain.Booking{}, fmt.Errorf("event type not found: %w", ErrNotFound)
	}

	if strings.TrimSpace(input.GuestName) == "" {
		return domain.Booking{}, fmt.Errorf("guestName is required: %w", ErrBadRequest)
	}

	if !emailPattern.MatchString(strings.TrimSpace(input.GuestEmail)) {
		return domain.Booking{}, fmt.Errorf("guestEmail must be valid: %w", ErrBadRequest)
	}

	start := input.StartAt.UTC()
	now := s.nowFn().UTC()
	windowEnd := now.AddDate(0, 0, bookingWindowDays)

	if start.Before(now) || !start.Before(windowEnd) {
		return domain.Booking{}, fmt.Errorf("startAt must be in 14-day window: %w", ErrBadRequest)
	}

	end := start.Add(time.Duration(eventType.DurationMinutes) * time.Minute)

	booking := domain.Booking{
		ID:           newID(),
		EventTypeID:  input.EventTypeID,
		StartAt:      start,
		EndAt:        end,
		GuestName:    input.GuestName,
		GuestEmail:   input.GuestEmail,
		GuestPhone:   trimOptional(input.GuestPhone),
		GuestComment: trimOptional(input.GuestComment),
		CreatedAt:    now,
	}

	if ok := s.store.AddBookingIfNoOverlap(booking); !ok {
		return domain.Booking{}, fmt.Errorf("slot is already occupied: %w", ErrConflict)
	}

	return booking, nil
}

func trimOptional(value *string) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

func isValidStep(step int) bool {
	return step == 15 || step == 30
}

func intervalsOverlap(startA, endA, startB, endB time.Time) bool {
	return startA.Before(endB) && startB.Before(endA)
}

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("fallback-%d", time.Now().UnixNano())
	}

	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
