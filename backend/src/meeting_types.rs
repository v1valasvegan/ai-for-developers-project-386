use okoshko_api::models::{ApiError, CreateMeetingType, MeetingType};
use std::collections::HashMap;

pub fn normalize(input: &CreateMeetingType) -> Result<MeetingType, ApiError> {
    let id = input.id.trim().to_ascii_lowercase();
    let id = id
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let mut fields = HashMap::new();
    if !(3..=20).contains(&id.len())
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        fields.insert(
            "id".to_owned(),
            "От 3 до 20 символов: латинские буквы, цифры и дефис".to_owned(),
        );
    }
    let title = input.title.trim();
    let description = input.description.trim();
    if !(1..=120).contains(&title.chars().count()) {
        fields.insert("title".to_owned(), "От 1 до 120 символов".to_owned());
    }
    if !(1..=2000).contains(&description.chars().count()) {
        fields.insert("description".to_owned(), "От 1 до 2000 символов".to_owned());
    }
    if !(15..=480).contains(&input.duration_minutes) || input.duration_minutes % 15 != 0 {
        fields.insert(
            "durationMinutes".to_owned(),
            "От 15 до 480 минут с шагом 15".to_owned(),
        );
    }
    if !fields.is_empty() {
        let mut error = ApiError::new(
            "validation_error".to_owned(),
            "Проверьте поля формы".to_owned(),
        );
        error.field_errors = Some(fields);
        return Err(error);
    }
    Ok(MeetingType::new(
        id,
        title.to_owned(),
        description.to_owned(),
        input.duration_minutes as u32,
    ))
}
