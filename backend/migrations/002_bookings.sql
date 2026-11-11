CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY NOT NULL,
    meeting_type_id TEXT NOT NULL REFERENCES meeting_types(id),
    meeting_type_title TEXT NOT NULL,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS bookings_interval ON bookings(starts_at, ends_at);
