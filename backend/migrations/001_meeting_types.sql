CREATE TABLE IF NOT EXISTS meeting_types (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (
        duration_minutes BETWEEN 15 AND 480 AND duration_minutes % 15 = 0
    )
);
