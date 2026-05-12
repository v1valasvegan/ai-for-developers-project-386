package domain

import "time"

type EventType struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	DurationMinutes int    `json:"durationMinutes"`
	SlotStepMinutes int    `json:"slotStepMinutes"`
}

type Slot struct {
	StartAt     time.Time `json:"startAt"`
	EndAt       time.Time `json:"endAt"`
	IsAvailable bool      `json:"isAvailable"`
}

type Booking struct {
	ID           string    `json:"id"`
	EventTypeID  string    `json:"eventTypeId"`
	StartAt      time.Time `json:"startAt"`
	EndAt        time.Time `json:"endAt"`
	GuestName    string    `json:"guestName"`
	GuestEmail   string    `json:"guestEmail"`
	GuestPhone   *string   `json:"guestPhone,omitempty"`
	GuestComment *string   `json:"guestComment,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}
