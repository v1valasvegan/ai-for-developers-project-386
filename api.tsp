import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;

@service(#{
  title: "Calendar Booking API",
})
@server("http://localhost:3000", "Local development server")
namespace CalendarAPI;

model EventType {
  id: string;
  name: string;
  description: string;
  durationMinutes: int32;
  slotStepMinutes: int32;
}

model Slot {
  startAt: utcDateTime;
  endAt: utcDateTime;
  isAvailable: boolean;
}

model Booking {
  id: string;
  eventTypeId: string;
  startAt: utcDateTime;
  endAt: utcDateTime;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  guestComment?: string;
  createdAt: utcDateTime;
}

model ErrorResponse {
  error: string;
  message?: string;
}

@route("/admin")
namespace Admin {
  @route("/event-types")
  interface EventTypes {
    @post
    @doc("Create a new event type for the predefined owner profile. slotStepMinutes must be 15 or 30.")
    create(@body body: {
      name: string;
      description: string;
      durationMinutes: int32;
      slotStepMinutes: int32;
    }): {
      @statusCode statusCode: 201;
      @body eventType: EventType;
    } | {
      @statusCode statusCode: 400;
      @body error: ErrorResponse;
    };

    @get
    @doc("List all event types of the predefined owner profile.")
    list(): {
      @body eventTypes: EventType[];
    };
  }

  @route("/event-types/{id}")
  interface EventTypeItem {
    @patch
    @doc("Update an existing event type. durationMinutes and slotStepMinutes are editable. slotStepMinutes must be 15 or 30.")
    update(
      @path id: string,
      @body body: {
        name?: string;
        description?: string;
        durationMinutes?: int32;
        slotStepMinutes?: int32;
      }
    ): {
      @body eventType: EventType;
    } | {
      @statusCode statusCode: 404;
      @body error: ErrorResponse;
    } | {
      @statusCode statusCode: 400;
      @body error: ErrorResponse;
    };
  }

  @route("/bookings")
  interface Bookings {
    @get
    @doc("List upcoming bookings across all event types.")
    listUpcoming(): {
      @body bookings: Booking[];
    };
  }
}

@route("/event-types")
interface PublicEventTypes {
  @get
  @doc("List all event types available for guests.")
  list(): {
    @body eventTypes: EventType[];
  };
}

@route("/event-types/{id}/slots")
interface PublicSlots {
  @get
  @doc("List available slots for the next 14 days from now. Optional from/to query can narrow this window but must remain within 14 days.")
  list(
    @path id: string,
    @query from?: utcDateTime,
    @query to?: utcDateTime,
  ): {
    @body slots: Slot[];
  } | {
    @statusCode statusCode: 404;
    @body error: ErrorResponse;
  } | {
    @statusCode statusCode: 400;
    @body error: ErrorResponse;
  };
}

@route("/bookings")
interface PublicBookings {
  @post
  @doc("Create a booking for a guest without registration. Two bookings cannot share the same start/end time, even across different event types.")
  create(@body body: {
    eventTypeId: string;
    startAt: utcDateTime;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    guestComment?: string;
  }): {
    @statusCode statusCode: 201;
    @body booking: Booking;
  } | {
    @statusCode statusCode: 400;
    @body error: ErrorResponse;
  } | {
    @statusCode statusCode: 404;
    @body error: ErrorResponse;
  } | {
    @statusCode statusCode: 409;
    @body error: ErrorResponse;
  };
}
