use okoshko_api::models::{MeetingType, MeetingTypeList};
use rusqlite::{Connection, OpenFlags};
use std::path::Path;

pub fn is_unavailable(error: &rusqlite::Error) -> bool {
    use rusqlite::ErrorCode;
    matches!(
        error.sqlite_error_code(),
        Some(
            ErrorCode::CannotOpen
                | ErrorCode::DatabaseBusy
                | ErrorCode::DatabaseLocked
                | ErrorCode::ReadOnly
                | ErrorCode::SystemIoFailure
                | ErrorCode::DiskFull
        )
    )
}

pub fn is_duplicate_type(error: &rusqlite::Error) -> bool {
    matches!(error, rusqlite::Error::SqliteFailure(code, _) if code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_PRIMARYKEY || code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE)
}

pub fn initialize(path: &Path) -> rusqlite::Result<()> {
    let connection = Connection::open(path)?;
    connection.execute_batch(include_str!("../migrations/001_meeting_types.sql"))?;
    connection.execute_batch(include_str!("../migrations/002_bookings.sql"))
}

pub fn slots(
    path: &Path,
    id: &str,
    now: chrono::DateTime<chrono::Utc>,
) -> rusqlite::Result<Option<okoshko_api::models::SlotList>> {
    use rusqlite::OptionalExtension;
    let mut connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let transaction = connection.transaction()?;
    let duration = transaction
        .query_row(
            "SELECT duration_minutes FROM meeting_types WHERE id = ?1",
            [id],
            |row| row.get(0),
        )
        .optional()?;
    let Some(duration) = duration else {
        return Ok(None);
    };
    let mut query = transaction.prepare("SELECT starts_at, ends_at FROM bookings")?;
    let occupied = query
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<Vec<(i64, i64)>>>()?;
    Ok(Some(crate::availability::slots(now, duration, &occupied)))
}

pub fn create_type(path: &Path, item: MeetingType) -> rusqlite::Result<MeetingType> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    connection.busy_timeout(std::time::Duration::from_secs(5))?;
    connection.execute(
        "INSERT INTO meeting_types (id, title, description, duration_minutes) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![item.id, item.title, item.description, item.duration_minutes],
    )?;
    Ok(item)
}

pub fn catalogue(path: &Path) -> rusqlite::Result<MeetingTypeList> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut query = connection.prepare(
        "SELECT id, title, description, duration_minutes FROM meeting_types ORDER BY id",
    )?;
    let items = query
        .query_map([], |row| {
            Ok(MeetingType::new(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(MeetingTypeList::new(items))
}
