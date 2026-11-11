use axum::{
    Json,
    body::Body,
    extract::{FromRequest, Request},
    middleware::Next,
    response::{IntoResponse, Response},
};
use http::{Method, StatusCode};
use okoshko_api::models::{ApiError, CreateMeetingType};
use serde_json::Value;
use std::collections::HashMap;

// The generated Axum extractor otherwise returns plaintext 422 responses for missing
// or mistyped fields. Keep transport failures in the same public error envelope as
// business validation; the generated DTO and handler still process valid requests.
pub async fn meeting_type_json(request: Request, next: Next) -> Response {
    if request.method() != Method::POST || request.uri().path() != "/api/meeting-types" {
        return next.run(request).await;
    }
    let (parts, body) = request.into_parts();
    let value =
        match Json::<Value>::from_request(Request::from_parts(parts.clone(), body), &()).await {
            Ok(Json(value)) => value,
            Err(_) => return invalid(None),
        };
    if !value.is_object() {
        return invalid(None);
    }
    let mut fields = HashMap::new();
    for field in ["id", "title", "description"] {
        if !value.get(field).is_some_and(Value::is_string) {
            fields.insert(field.to_owned(), "Обязательное текстовое поле".to_owned());
        }
    }
    if !value
        .get("durationMinutes")
        .and_then(Value::as_i64)
        .is_some_and(|number| i32::try_from(number).is_ok())
    {
        fields.insert(
            "durationMinutes".to_owned(),
            "Укажите целое число минут от 15 до 480 с шагом 15".to_owned(),
        );
    }
    if !fields.is_empty() {
        return invalid(Some(fields));
    }
    // Validate normalized fields before generated validators can return a plaintext
    // rejection (for example an HTML-looking, invalid code). Keep those validators
    // enabled as well; title/description alone are contract-marked literal text.
    let input: CreateMeetingType = match serde_json::from_value(value.clone()) {
        Ok(input) => input,
        Err(_) => return invalid(None),
    };
    if let Err(error) = crate::meeting_types::normalize(&input) {
        return (StatusCode::BAD_REQUEST, Json(error)).into_response();
    }
    next.run(Request::from_parts(parts, Body::from(value.to_string())))
        .await
}

fn invalid(fields: Option<HashMap<String, String>>) -> Response {
    let mut error = ApiError::new(
        "validation_error".to_owned(),
        "Проверьте поля запроса".to_owned(),
    );
    error.field_errors = fields;
    (StatusCode::BAD_REQUEST, Json(error)).into_response()
}
