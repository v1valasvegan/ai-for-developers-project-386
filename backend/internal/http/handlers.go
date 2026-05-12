package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/v1valasvegan/ai-for-developers-project-386/backend/internal/service"
)

type Handler struct {
	service *service.Service
}

func NewRouter(svc *service.Service) http.Handler {
	h := &Handler{service: svc}
	r := chi.NewRouter()

	r.Use(corsMiddleware)

	r.Get("/healthz", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/v1", func(api chi.Router) {
		api.Route("/admin", func(admin chi.Router) {
			admin.Post("/event-types", h.createEventType)
			admin.Get("/event-types", h.listAdminEventTypes)
			admin.Patch("/event-types/{id}", h.updateEventType)
			admin.Get("/bookings", h.listUpcomingBookings)
		})

		api.Get("/event-types", h.listPublicEventTypes)
		api.Get("/event-types/{id}/slots", h.listSlots)
		api.Post("/bookings", h.createBooking)
	})

	return r
}

func (h *Handler) createEventType(writer http.ResponseWriter, request *http.Request) {
	type body struct {
		Name            string `json:"name"`
		Description     string `json:"description"`
		DurationMinutes int    `json:"durationMinutes"`
		SlotStepMinutes int    `json:"slotStepMinutes"`
	}

	var payload body
	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
		writeError(writer, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON")
		return
	}

	eventType, err := h.service.CreateEventType(service.CreateEventTypeInput{
		Name:            payload.Name,
		Description:     payload.Description,
		DurationMinutes: payload.DurationMinutes,
		SlotStepMinutes: payload.SlotStepMinutes,
	})
	if err != nil {
		h.handleServiceError(writer, err)
		return
	}

	writeJSON(writer, http.StatusCreated, map[string]any{"eventType": eventType})
}

func (h *Handler) listAdminEventTypes(writer http.ResponseWriter, _ *http.Request) {
	eventTypes := h.service.ListEventTypes()
	writeJSON(writer, http.StatusOK, map[string]any{"eventTypes": eventTypes})
}

func (h *Handler) updateEventType(writer http.ResponseWriter, request *http.Request) {
	type body struct {
		Name            *string `json:"name"`
		Description     *string `json:"description"`
		DurationMinutes *int    `json:"durationMinutes"`
		SlotStepMinutes *int    `json:"slotStepMinutes"`
	}

	var payload body
	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
		writeError(writer, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON")
		return
	}

	id := chi.URLParam(request, "id")
	eventType, err := h.service.UpdateEventType(id, service.UpdateEventTypeInput{
		Name:            payload.Name,
		Description:     payload.Description,
		DurationMinutes: payload.DurationMinutes,
		SlotStepMinutes: payload.SlotStepMinutes,
	})
	if err != nil {
		h.handleServiceError(writer, err)
		return
	}

	writeJSON(writer, http.StatusOK, map[string]any{"eventType": eventType})
}

func (h *Handler) listUpcomingBookings(writer http.ResponseWriter, _ *http.Request) {
	bookings := h.service.ListUpcomingBookings()
	writeJSON(writer, http.StatusOK, map[string]any{"bookings": bookings})
}

func (h *Handler) listPublicEventTypes(writer http.ResponseWriter, _ *http.Request) {
	eventTypes := h.service.ListEventTypes()
	writeJSON(writer, http.StatusOK, map[string]any{"eventTypes": eventTypes})
}

func (h *Handler) listSlots(writer http.ResponseWriter, request *http.Request) {
	id := chi.URLParam(request, "id")

	var filter service.SlotFilter

	fromRaw := request.URL.Query().Get("from")
	if fromRaw != "" {
		from, err := time.Parse(time.RFC3339, fromRaw)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "invalid_from", "Query parameter from must be RFC3339")
			return
		}
		filter.From = &from
	}

	toRaw := request.URL.Query().Get("to")
	if toRaw != "" {
		to, err := time.Parse(time.RFC3339, toRaw)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "invalid_to", "Query parameter to must be RFC3339")
			return
		}
		filter.To = &to
	}

	slots, err := h.service.ListSlots(id, filter)
	if err != nil {
		h.handleServiceError(writer, err)
		return
	}

	writeJSON(writer, http.StatusOK, map[string]any{"slots": slots})
}

func (h *Handler) createBooking(writer http.ResponseWriter, request *http.Request) {
	type body struct {
		EventTypeID  string  `json:"eventTypeId"`
		StartAt      string  `json:"startAt"`
		GuestName    string  `json:"guestName"`
		GuestEmail   string  `json:"guestEmail"`
		GuestPhone   *string `json:"guestPhone"`
		GuestComment *string `json:"guestComment"`
	}

	var payload body
	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
		writeError(writer, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON")
		return
	}

	startAt, err := time.Parse(time.RFC3339, payload.StartAt)
	if err != nil {
		writeError(writer, http.StatusBadRequest, "invalid_startAt", "startAt must be RFC3339")
		return
	}

	booking, err := h.service.CreateBooking(service.CreateBookingInput{
		EventTypeID:  payload.EventTypeID,
		StartAt:      startAt,
		GuestName:    payload.GuestName,
		GuestEmail:   payload.GuestEmail,
		GuestPhone:   payload.GuestPhone,
		GuestComment: payload.GuestComment,
	})
	if err != nil {
		h.handleServiceError(writer, err)
		return
	}

	writeJSON(writer, http.StatusCreated, map[string]any{"booking": booking})
}

func (h *Handler) handleServiceError(writer http.ResponseWriter, err error) {
	if errors.Is(err, service.ErrBadRequest) {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	if errors.Is(err, service.ErrNotFound) {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	if errors.Is(err, service.ErrConflict) {
		writeError(writer, http.StatusConflict, "conflict", err.Error())
		return
	}

	writeError(writer, http.StatusInternalServerError, "internal_error", "Internal server error")
}
