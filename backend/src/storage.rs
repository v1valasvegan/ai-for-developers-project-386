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

pub fn initialize(path: &Path) -> rusqlite::Result<()> {
    Connection::open(path)?.execute_batch(include_str!("../migrations/001_meeting_types.sql"))
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
