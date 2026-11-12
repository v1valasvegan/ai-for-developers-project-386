use chrono::{DateTime, Utc};
use okoshko_api::models::{Booking, BookingList, CreateBooking, OwnerBooking};
use rusqlite::{Connection, OpenFlags, OptionalExtension, TransactionBehavior, params};
use std::path::Path;
use validator::ValidateEmail;

pub fn validate(input: &CreateBooking) -> Result<(), okoshko_api::models::ApiError> {
    let mut fields = std::collections::HashMap::new();
    if !(3..=20).contains(&input.meeting_type_id.len())
        || input
            .meeting_type_id
            .bytes()
            .any(|byte| !byte.is_ascii_lowercase() && !byte.is_ascii_digit() && byte != b'-')
    {
        fields.insert("meetingTypeId".into(), "Укажите код типа встречи".into());
    }
    let name = input.name.trim();
    let email = input.email.trim();
    if !(1..=120).contains(&name.chars().count()) {
        fields.insert("name".into(), "Укажите имя от 1 до 120 символов".into());
    }
    if email.chars().count() > 254 || !email.validate_email() {
        fields.insert(
            "email".into(),
            "Укажите корректный email до 254 символов".into(),
        );
    }
    if uuid::Uuid::parse_str(&input.idempotency_key).is_err() {
        fields.insert("idempotencyKey".into(), "Некорректный UUID попытки".into());
    }
    if DateTime::parse_from_rfc3339(&input.starts_at).is_err() {
        fields.insert(
            "startsAt".into(),
            "Укажите время RFC 3339 с часовым поясом".into(),
        );
    }
    if !fields.is_empty() {
        let mut error = okoshko_api::models::ApiError::new(
            "validation_error".into(),
            "Проверьте поля формы".into(),
        );
        error.field_errors = Some(fields);
        return Err(error);
    }
    Ok(())
}

#[derive(Debug)]
pub enum CreateError {
    Storage(rusqlite::Error),
    Clock(std::io::Error),
    Rejected(u16, okoshko_api::models::ApiError),
}
impl From<rusqlite::Error> for CreateError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Storage(error)
    }
}
fn rejected(status: u16, code: &str, message: &str) -> CreateError {
    CreateError::Rejected(
        status,
        okoshko_api::models::ApiError::new(code.into(), message.into()),
    )
}

pub fn create(
    path: &Path,
    input: CreateBooking,
    clock: &crate::clock::Clock,
) -> Result<(Booking, bool), CreateError> {
    let mut connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    connection.busy_timeout(std::time::Duration::from_secs(5))?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let start = DateTime::parse_from_rfc3339(&input.starts_at)
        .expect("validated start")
        .with_timezone(&Utc);
    let key = uuid::Uuid::parse_str(&input.idempotency_key)
        .expect("validated key")
        .to_string();
    let prior = transaction.query_row("SELECT id, meeting_type_id, meeting_type_title, starts_at, ends_at, name, email FROM bookings WHERE idempotency_key = ?1", [&key], |row| {
        Ok(Booking::new(row.get(0)?, row.get(1)?, row.get(2)?, timestamp(row.get(3)?)?, timestamp(row.get(4)?)?, row.get(5)?, row.get(6)?))
    }).optional()?;
    if let Some(prior) = prior {
        if prior.meeting_type_id == input.meeting_type_id
            && prior.starts_at == start
            && prior.name == input.name.trim()
            && prior.email == input.email.trim()
        {
            return Ok((prior, true));
        }
        return Err(rejected(
            409,
            "idempotency_key_reused",
            "Ключ попытки уже использован с другими данными",
        ));
    }
    let now = clock.now().map_err(CreateError::Clock)?;
    let meeting_type: Option<(String, i32)> = transaction
        .query_row(
            "SELECT title, duration_minutes FROM meeting_types WHERE id = ?1",
            [&input.meeting_type_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let Some((title, duration)) = meeting_type else {
        return Err(rejected(
            404,
            "meeting_type_not_found",
            "Тип встречи не найден",
        ));
    };
    let end = start + chrono::Duration::minutes(i64::from(duration));
    if !crate::availability::slots(now, duration, &[])
        .items
        .iter()
        .any(|slot| slot.starts_at == start)
    {
        let mut error = okoshko_api::models::ApiError::new(
            "validation_error".into(),
            "Время вышло из окна записи или не соответствует расписанию. Выберите другое время"
                .into(),
        );
        error.field_errors = Some(std::collections::HashMap::from([(
            "startsAt".into(),
            "Выберите доступное время в актуальном окне записи".into(),
        )]));
        return Err(CreateError::Rejected(400, error));
    }
    let occupied: bool = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM bookings WHERE starts_at < ?1 AND ?2 < ends_at)",
        params![end.timestamp(), start.timestamp()],
        |row| row.get(0),
    )?;
    if occupied {
        return Err(rejected(
            409,
            "slot_conflict",
            "Это время уже заняли. Выберите другое",
        ));
    }
    let booking = Booking::new(
        uuid::Uuid::new_v4().to_string(),
        input.meeting_type_id,
        title,
        start,
        end,
        input.name.trim().into(),
        input.email.trim().into(),
    );
    transaction.execute("INSERT INTO bookings (id, meeting_type_id, meeting_type_title, starts_at, ends_at, name, email, idempotency_key) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", params![booking.id, booking.meeting_type_id, booking.meeting_type_title, start.timestamp(), end.timestamp(), booking.name, booking.email, key])?;
    transaction.commit()?;
    Ok((booking, false))
}

pub fn list(path: &Path, now: DateTime<Utc>) -> rusqlite::Result<BookingList> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut query = connection.prepare("SELECT id, meeting_type_id, meeting_type_title, starts_at, ends_at, name, email FROM bookings WHERE ends_at > ?1 ORDER BY starts_at, id")?;
    let items = query
        .query_map([now.timestamp()], |row| {
            let start: i64 = row.get(3)?;
            let end: i64 = row.get(4)?;
            Ok(OwnerBooking::new(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                timestamp(start)?,
                timestamp(end)?,
                row.get(5)?,
                row.get(6)?,
                if start > now.timestamp() {
                    "upcoming"
                } else {
                    "ongoing"
                }
                .into(),
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(BookingList::new(now, items))
}

fn timestamp(value: i64) -> rusqlite::Result<DateTime<Utc>> {
    DateTime::from_timestamp(value, 0).ok_or(rusqlite::Error::InvalidQuery)
}
