// Generated from api/main.tsp. DO NOT EDIT.
#![allow(unused_qualifications)]

use http::HeaderValue;
use validator::Validate;

#[cfg(feature = "server")]
use crate::header;
use crate::{models, types::*};

#[allow(dead_code)]
pub type SSE = std::pin::Pin<std::boxed::Box<dyn futures_util::Stream<Item = std::result::Result<axum::response::sse::Event, std::convert::Infallible>> + std::marker::Send + std::marker::Sync>>;

#[allow(dead_code)]
fn from_validation_error(e: validator::ValidationError) -> validator::ValidationErrors {
    let mut errs = validator::ValidationErrors::new();
    errs.add("na", e);
    errs
}

#[allow(dead_code)]
pub fn check_xss_string(v: &str) -> std::result::Result<(), validator::ValidationError> {
    if ammonia::is_html(v) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}

#[allow(dead_code)]
pub fn check_xss_vec_string(v: &[String]) -> std::result::Result<(), validator::ValidationError> {
    if v.iter().any(|i| ammonia::is_html(i)) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}

#[allow(dead_code)]
pub fn check_xss_map_string(
    v: &std::collections::HashMap<String, String>,
) -> std::result::Result<(), validator::ValidationError> {
    if v.keys().any(|k| ammonia::is_html(k)) || v.values().any(|v| ammonia::is_html(v)) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}

#[allow(dead_code)]
pub fn check_xss_map_nested<T>(
    v: &std::collections::HashMap<String, T>,
) -> std::result::Result<(), validator::ValidationError>
where
    T: validator::Validate,
{
    if v.keys().any(|k| ammonia::is_html(k)) || v.values().any(|v| v.validate().is_err()) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}

#[allow(dead_code)]
pub fn check_xss_map<T>(v: &std::collections::HashMap<String, T>) -> std::result::Result<(), validator::ValidationError> {
    if v.keys().any(|k| ammonia::is_html(k)) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}






    #[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
    #[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
    pub struct ListMeetingTypeSlotsPathParams {
            /// Код типа встречи.
                pub id: String,
    }





/// Безопасное описание ошибки без внутренних технических подробностей.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ApiError {
    /// Машиночитаемая причина ошибки.
    #[serde(rename = "code")]
          #[validate(custom(function = "check_xss_string"))]
    pub code: String,

    /// Сообщение для человека.
    #[serde(rename = "message")]
          #[validate(custom(function = "check_xss_string"))]
    pub message: String,

    /// Сообщения только для ошибочных полей запроса.
    #[serde(rename = "fieldErrors")]
          #[validate(custom(function = "check_xss_map_string"))]
    #[serde(skip_serializing_if="Option::is_none")]
    pub field_errors: Option<std::collections::HashMap<String, String>>,

}



impl ApiError {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(code: String, message: String, ) -> ApiError {
        ApiError {
 code,
 message,
 field_errors: None,
        }
    }
}

/// Converts the ApiError value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![

            Some("code".to_string()),
            Some(self.code.to_string()),


            Some("message".to_string()),
            Some(self.message.to_string()),

            // Skipping fieldErrors in query parameter serialization

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ApiError value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ApiError {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub code: Vec<String>,
            pub message: Vec<String>,
            pub field_errors: Vec<std::collections::HashMap<String, String>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing ApiError".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "code" => intermediate_rep.code.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "message" => intermediate_rep.message.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    "fieldErrors" => return std::result::Result::Err("Parsing a container in this style is not supported in ApiError".to_string()),
                    _ => return std::result::Result::Err("Unexpected key while parsing ApiError".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ApiError {
            code: intermediate_rep.code.into_iter().next().ok_or_else(|| "code missing in ApiError".to_string())?,
            message: intermediate_rep.message.into_iter().next().ok_or_else(|| "message missing in ApiError".to_string())?,
            field_errors: intermediate_rep.field_errors.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ApiError> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ApiError>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<ApiError>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for ApiError - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ApiError> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <ApiError as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into ApiError - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



/// Подтверждённая запись гостя.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct Booking {
    /// Серверный UUID записи.
    #[serde(rename = "id")]
          #[validate(custom(function = "check_xss_string"))]
    pub id: String,

    /// Код выбранного типа.
    #[serde(rename = "meetingTypeId")]
          #[validate(custom(function = "check_xss_string"))]
    pub meeting_type_id: String,

    /// Название типа на момент создания.
    #[serde(rename = "meetingTypeTitle")]
    pub meeting_type_title: String,

    /// Начало включительно, UTC.
    #[serde(rename = "startsAt")]
    pub starts_at: chrono::DateTime::<chrono::Utc>,

    /// Окончание исключительно, UTC.
    #[serde(rename = "endsAt")]
    pub ends_at: chrono::DateTime::<chrono::Utc>,

    /// Имя гостя простым текстом.
    #[serde(rename = "name")]
    pub name: String,

    /// Контакт гостя.
    #[serde(rename = "email")]
    pub email: String,

}



impl Booking {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(id: String, meeting_type_id: String, meeting_type_title: String, starts_at: chrono::DateTime::<chrono::Utc>, ends_at: chrono::DateTime::<chrono::Utc>, name: String, email: String, ) -> Booking {
        Booking {
 id,
 meeting_type_id,
 meeting_type_title,
 starts_at,
 ends_at,
 name,
 email,
        }
    }
}

/// Converts the Booking value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for Booking {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![

            Some("id".to_string()),
            Some(self.id.to_string()),


            Some("meetingTypeId".to_string()),
            Some(self.meeting_type_id.to_string()),


            Some("meetingTypeTitle".to_string()),
            Some(self.meeting_type_title.to_string()),

            // Skipping startsAt in query parameter serialization

            // Skipping endsAt in query parameter serialization


            Some("name".to_string()),
            Some(self.name.to_string()),


            Some("email".to_string()),
            Some(self.email.to_string()),

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a Booking value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for Booking {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub id: Vec<String>,
            pub meeting_type_id: Vec<String>,
            pub meeting_type_title: Vec<String>,
            pub starts_at: Vec<chrono::DateTime::<chrono::Utc>>,
            pub ends_at: Vec<chrono::DateTime::<chrono::Utc>>,
            pub name: Vec<String>,
            pub email: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing Booking".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "meetingTypeId" => intermediate_rep.meeting_type_id.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "meetingTypeTitle" => intermediate_rep.meeting_type_title.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "startsAt" => intermediate_rep.starts_at.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "endsAt" => intermediate_rep.ends_at.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "name" => intermediate_rep.name.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "email" => intermediate_rep.email.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing Booking".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(Booking {
            id: intermediate_rep.id.into_iter().next().ok_or_else(|| "id missing in Booking".to_string())?,
            meeting_type_id: intermediate_rep.meeting_type_id.into_iter().next().ok_or_else(|| "meetingTypeId missing in Booking".to_string())?,
            meeting_type_title: intermediate_rep.meeting_type_title.into_iter().next().ok_or_else(|| "meetingTypeTitle missing in Booking".to_string())?,
            starts_at: intermediate_rep.starts_at.into_iter().next().ok_or_else(|| "startsAt missing in Booking".to_string())?,
            ends_at: intermediate_rep.ends_at.into_iter().next().ok_or_else(|| "endsAt missing in Booking".to_string())?,
            name: intermediate_rep.name.into_iter().next().ok_or_else(|| "name missing in Booking".to_string())?,
            email: intermediate_rep.email.into_iter().next().ok_or_else(|| "email missing in Booking".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<Booking> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<Booking>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<Booking>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for Booking - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<Booking> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <Booking as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into Booking - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



/// Встречи всех типов по возрастанию начала.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct BookingList {
    /// Момент расчёта статусов.
    #[serde(rename = "serverTime")]
    pub server_time: chrono::DateTime::<chrono::Utc>,

    /// Завершённые встречи исключены.
    #[serde(rename = "items")]
          #[validate(nested)]
    pub items: Vec<models::OwnerBooking>,

}



impl BookingList {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(server_time: chrono::DateTime::<chrono::Utc>, items: Vec<models::OwnerBooking>, ) -> BookingList {
        BookingList {
 server_time,
 items,
        }
    }
}

/// Converts the BookingList value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for BookingList {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            // Skipping serverTime in query parameter serialization

            // Skipping items in query parameter serialization

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a BookingList value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for BookingList {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub server_time: Vec<chrono::DateTime::<chrono::Utc>>,
            pub items: Vec<Vec<models::OwnerBooking>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing BookingList".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "serverTime" => intermediate_rep.server_time.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    "items" => return std::result::Result::Err("Parsing a container in this style is not supported in BookingList".to_string()),
                    _ => return std::result::Result::Err("Unexpected key while parsing BookingList".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(BookingList {
            server_time: intermediate_rep.server_time.into_iter().next().ok_or_else(|| "serverTime missing in BookingList".to_string())?,
            items: intermediate_rep.items.into_iter().next().ok_or_else(|| "items missing in BookingList".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<BookingList> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<BookingList>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<BookingList>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for BookingList - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<BookingList> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <BookingList as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into BookingList - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



/// Данные открытой попытки бронирования.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CreateBooking {
    /// Код типа встречи.
    #[serde(rename = "meetingTypeId")]
          #[validate(custom(function = "check_xss_string"))]
    pub meeting_type_id: String,

    /// RFC 3339 с обязательным поясом; проверяется сервером.
    #[serde(rename = "startsAt")]
          #[validate(custom(function = "check_xss_string"))]
    pub starts_at: String,

    /// Имя простым текстом, после удаления краевых пробелов 1–120 символов.
    #[serde(rename = "name")]
    pub name: String,

    /// Email после удаления краевых пробелов, до 254 символов.
    #[serde(rename = "email")]
    pub email: String,

    /// UUID попытки, не идентификатор записи.
    #[serde(rename = "idempotencyKey")]
          #[validate(custom(function = "check_xss_string"))]
    pub idempotency_key: String,

}



impl CreateBooking {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(meeting_type_id: String, starts_at: String, name: String, email: String, idempotency_key: String, ) -> CreateBooking {
        CreateBooking {
 meeting_type_id,
 starts_at,
 name,
 email,
 idempotency_key,
        }
    }
}

/// Converts the CreateBooking value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CreateBooking {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![

            Some("meetingTypeId".to_string()),
            Some(self.meeting_type_id.to_string()),


            Some("startsAt".to_string()),
            Some(self.starts_at.to_string()),


            Some("name".to_string()),
            Some(self.name.to_string()),


            Some("email".to_string()),
            Some(self.email.to_string()),


            Some("idempotencyKey".to_string()),
            Some(self.idempotency_key.to_string()),

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CreateBooking value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CreateBooking {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub meeting_type_id: Vec<String>,
            pub starts_at: Vec<String>,
            pub name: Vec<String>,
            pub email: Vec<String>,
            pub idempotency_key: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing CreateBooking".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "meetingTypeId" => intermediate_rep.meeting_type_id.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "startsAt" => intermediate_rep.starts_at.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "name" => intermediate_rep.name.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "email" => intermediate_rep.email.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "idempotencyKey" => intermediate_rep.idempotency_key.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing CreateBooking".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CreateBooking {
            meeting_type_id: intermediate_rep.meeting_type_id.into_iter().next().ok_or_else(|| "meetingTypeId missing in CreateBooking".to_string())?,
            starts_at: intermediate_rep.starts_at.into_iter().next().ok_or_else(|| "startsAt missing in CreateBooking".to_string())?,
            name: intermediate_rep.name.into_iter().next().ok_or_else(|| "name missing in CreateBooking".to_string())?,
            email: intermediate_rep.email.into_iter().next().ok_or_else(|| "email missing in CreateBooking".to_string())?,
            idempotency_key: intermediate_rep.idempotency_key.into_iter().next().ok_or_else(|| "idempotencyKey missing in CreateBooking".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CreateBooking> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CreateBooking>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<CreateBooking>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for CreateBooking - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CreateBooking> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <CreateBooking as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into CreateBooking - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



/// Поля владельца до нормализации и проверки сервером.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CreateMeetingType {
    /// Код: после нормализации 3–20 латинских букв, цифр и дефисов.
    #[serde(rename = "id")]
          #[validate(custom(function = "check_xss_string"))]
    pub id: String,

    /// Название: после удаления пробелов по краям 1–120 символов.
    #[serde(rename = "title")]
    pub title: String,

    /// Описание простым текстом: после удаления пробелов по краям 1–2000 символов.
    #[serde(rename = "description")]
    pub description: String,

    /// Целое число 15–480 включительно, кратное 15.
    #[serde(rename = "durationMinutes")]
    pub duration_minutes: i32,

}



impl CreateMeetingType {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(id: String, title: String, description: String, duration_minutes: i32, ) -> CreateMeetingType {
        CreateMeetingType {
 id,
 title,
 description,
 duration_minutes,
        }
    }
}

/// Converts the CreateMeetingType value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CreateMeetingType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![

            Some("id".to_string()),
            Some(self.id.to_string()),


            Some("title".to_string()),
            Some(self.title.to_string()),


            Some("description".to_string()),
            Some(self.description.to_string()),


            Some("durationMinutes".to_string()),
            Some(self.duration_minutes.to_string()),

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CreateMeetingType value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CreateMeetingType {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub id: Vec<String>,
            pub title: Vec<String>,
            pub description: Vec<String>,
            pub duration_minutes: Vec<i32>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing CreateMeetingType".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "title" => intermediate_rep.title.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "description" => intermediate_rep.description.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "durationMinutes" => intermediate_rep.duration_minutes.push(<i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing CreateMeetingType".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CreateMeetingType {
            id: intermediate_rep.id.into_iter().next().ok_or_else(|| "id missing in CreateMeetingType".to_string())?,
            title: intermediate_rep.title.into_iter().next().ok_or_else(|| "title missing in CreateMeetingType".to_string())?,
            description: intermediate_rep.description.into_iter().next().ok_or_else(|| "description missing in CreateMeetingType".to_string())?,
            duration_minutes: intermediate_rep.duration_minutes.into_iter().next().ok_or_else(|| "durationMinutes missing in CreateMeetingType".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CreateMeetingType> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CreateMeetingType>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<CreateMeetingType>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for CreateMeetingType - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CreateMeetingType> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <CreateMeetingType as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into CreateMeetingType - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



/// Состояние API сервиса.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct Health {
    /// Готовность сервера отвечать на запросы.
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "status")]
          #[validate(custom(function = "check_xss_string"))]
    pub status: String,

}



impl Health {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(status: String, ) -> Health {
        Health {
 status,
        }
    }
}

/// Converts the Health value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for Health {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![

            Some("status".to_string()),
            Some(self.status.to_string()),

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a Health value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for Health {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub status: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing Health".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "status" => intermediate_rep.status.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing Health".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(Health {
            status: intermediate_rep.status.into_iter().next().ok_or_else(|| "status missing in Health".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<Health> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<Health>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<Health>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for Health - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<Health> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <Health as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into Health - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



/// Тип встречи одного владельца календаря.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct MeetingType {
    /// Уникальный читаемый код типа встречи.
    #[serde(rename = "id")]
    #[validate(
            length(min = 3, max = 20),
            regex(path = *RE_MEETINGTYPE_ID),
          custom(function = "check_xss_string"),
    )]
    pub id: String,

    /// Название простым текстом.
    #[serde(rename = "title")]
    #[validate(
            length(min = 1, max = 120),
    )]
    pub title: String,

    /// Описание простым текстом, не HTML.
    #[serde(rename = "description")]
    #[validate(
            length(min = 1, max = 2000),
    )]
    pub description: String,

    /// Длительность в минутах, кратная 15.
    #[serde(rename = "durationMinutes")]
    #[validate(
            range(min = 15u32, max = 480u32),
    )]
    pub duration_minutes: u32,

}


lazy_static::lazy_static! {
    static ref RE_MEETINGTYPE_ID: regex::Regex = regex::Regex::new("^[a-z0-9]+(-[a-z0-9]+)*$").unwrap();
}

impl MeetingType {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(id: String, title: String, description: String, duration_minutes: u32, ) -> MeetingType {
        MeetingType {
 id,
 title,
 description,
 duration_minutes,
        }
    }
}

/// Converts the MeetingType value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for MeetingType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![

            Some("id".to_string()),
            Some(self.id.to_string()),


            Some("title".to_string()),
            Some(self.title.to_string()),


            Some("description".to_string()),
            Some(self.description.to_string()),


            Some("durationMinutes".to_string()),
            Some(self.duration_minutes.to_string()),

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a MeetingType value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for MeetingType {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub id: Vec<String>,
            pub title: Vec<String>,
            pub description: Vec<String>,
            pub duration_minutes: Vec<u32>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing MeetingType".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "title" => intermediate_rep.title.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "description" => intermediate_rep.description.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "durationMinutes" => intermediate_rep.duration_minutes.push(<u32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing MeetingType".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(MeetingType {
            id: intermediate_rep.id.into_iter().next().ok_or_else(|| "id missing in MeetingType".to_string())?,
            title: intermediate_rep.title.into_iter().next().ok_or_else(|| "title missing in MeetingType".to_string())?,
            description: intermediate_rep.description.into_iter().next().ok_or_else(|| "description missing in MeetingType".to_string())?,
            duration_minutes: intermediate_rep.duration_minutes.into_iter().next().ok_or_else(|| "durationMinutes missing in MeetingType".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<MeetingType> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<MeetingType>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<MeetingType>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for MeetingType - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<MeetingType> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <MeetingType as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into MeetingType - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



/// Каталог, отсортированный по коду типа встречи.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct MeetingTypeList {
    /// Типы встреч; пустой каталог — нормальный результат.
    #[serde(rename = "items")]
          #[validate(nested)]
    pub items: Vec<models::MeetingType>,

}



impl MeetingTypeList {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(items: Vec<models::MeetingType>, ) -> MeetingTypeList {
        MeetingTypeList {
 items,
        }
    }
}

/// Converts the MeetingTypeList value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for MeetingTypeList {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            // Skipping items in query parameter serialization

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a MeetingTypeList value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for MeetingTypeList {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub items: Vec<Vec<models::MeetingType>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing MeetingTypeList".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    "items" => return std::result::Result::Err("Parsing a container in this style is not supported in MeetingTypeList".to_string()),
                    _ => return std::result::Result::Err("Unexpected key while parsing MeetingTypeList".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(MeetingTypeList {
            items: intermediate_rep.items.into_iter().next().ok_or_else(|| "items missing in MeetingTypeList".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<MeetingTypeList> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<MeetingTypeList>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<MeetingTypeList>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for MeetingTypeList - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<MeetingTypeList> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <MeetingTypeList as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into MeetingTypeList - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct OwnerBooking {
    /// Серверный UUID записи.
    #[serde(rename = "id")]
          #[validate(custom(function = "check_xss_string"))]
    pub id: String,

    /// Код выбранного типа.
    #[serde(rename = "meetingTypeId")]
          #[validate(custom(function = "check_xss_string"))]
    pub meeting_type_id: String,

    /// Название типа на момент создания.
    #[serde(rename = "meetingTypeTitle")]
    pub meeting_type_title: String,

    /// Начало включительно, UTC.
    #[serde(rename = "startsAt")]
    pub starts_at: chrono::DateTime::<chrono::Utc>,

    /// Окончание исключительно, UTC.
    #[serde(rename = "endsAt")]
    pub ends_at: chrono::DateTime::<chrono::Utc>,

    /// Имя гостя простым текстом.
    #[serde(rename = "name")]
    pub name: String,

    /// Контакт гостя.
    #[serde(rename = "email")]
    pub email: String,

    /// Вычислен относительно serverTime.
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "status")]
          #[validate(custom(function = "check_xss_string"))]
    pub status: String,

}



impl OwnerBooking {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(id: String, meeting_type_id: String, meeting_type_title: String, starts_at: chrono::DateTime::<chrono::Utc>, ends_at: chrono::DateTime::<chrono::Utc>, name: String, email: String, status: String, ) -> OwnerBooking {
        OwnerBooking {
 id,
 meeting_type_id,
 meeting_type_title,
 starts_at,
 ends_at,
 name,
 email,
 status,
        }
    }
}

/// Converts the OwnerBooking value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for OwnerBooking {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![

            Some("id".to_string()),
            Some(self.id.to_string()),


            Some("meetingTypeId".to_string()),
            Some(self.meeting_type_id.to_string()),


            Some("meetingTypeTitle".to_string()),
            Some(self.meeting_type_title.to_string()),

            // Skipping startsAt in query parameter serialization

            // Skipping endsAt in query parameter serialization


            Some("name".to_string()),
            Some(self.name.to_string()),


            Some("email".to_string()),
            Some(self.email.to_string()),


            Some("status".to_string()),
            Some(self.status.to_string()),

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a OwnerBooking value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for OwnerBooking {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub id: Vec<String>,
            pub meeting_type_id: Vec<String>,
            pub meeting_type_title: Vec<String>,
            pub starts_at: Vec<chrono::DateTime::<chrono::Utc>>,
            pub ends_at: Vec<chrono::DateTime::<chrono::Utc>>,
            pub name: Vec<String>,
            pub email: Vec<String>,
            pub status: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing OwnerBooking".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "meetingTypeId" => intermediate_rep.meeting_type_id.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "meetingTypeTitle" => intermediate_rep.meeting_type_title.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "startsAt" => intermediate_rep.starts_at.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "endsAt" => intermediate_rep.ends_at.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "name" => intermediate_rep.name.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "email" => intermediate_rep.email.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "status" => intermediate_rep.status.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing OwnerBooking".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(OwnerBooking {
            id: intermediate_rep.id.into_iter().next().ok_or_else(|| "id missing in OwnerBooking".to_string())?,
            meeting_type_id: intermediate_rep.meeting_type_id.into_iter().next().ok_or_else(|| "meetingTypeId missing in OwnerBooking".to_string())?,
            meeting_type_title: intermediate_rep.meeting_type_title.into_iter().next().ok_or_else(|| "meetingTypeTitle missing in OwnerBooking".to_string())?,
            starts_at: intermediate_rep.starts_at.into_iter().next().ok_or_else(|| "startsAt missing in OwnerBooking".to_string())?,
            ends_at: intermediate_rep.ends_at.into_iter().next().ok_or_else(|| "endsAt missing in OwnerBooking".to_string())?,
            name: intermediate_rep.name.into_iter().next().ok_or_else(|| "name missing in OwnerBooking".to_string())?,
            email: intermediate_rep.email.into_iter().next().ok_or_else(|| "email missing in OwnerBooking".to_string())?,
            status: intermediate_rep.status.into_iter().next().ok_or_else(|| "status missing in OwnerBooking".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<OwnerBooking> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<OwnerBooking>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<OwnerBooking>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for OwnerBooking - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<OwnerBooking> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <OwnerBooking as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into OwnerBooking - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



/// Свободный интервал выбранного типа встречи.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct Slot {
    /// Начало включительно, момент UTC.
    #[serde(rename = "startsAt")]
    pub starts_at: chrono::DateTime::<chrono::Utc>,

    /// Окончание исключительно, момент UTC.
    #[serde(rename = "endsAt")]
    pub ends_at: chrono::DateTime::<chrono::Utc>,

}



impl Slot {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(starts_at: chrono::DateTime::<chrono::Utc>, ends_at: chrono::DateTime::<chrono::Utc>, ) -> Slot {
        Slot {
 starts_at,
 ends_at,
        }
    }
}

/// Converts the Slot value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for Slot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            // Skipping startsAt in query parameter serialization

            // Skipping endsAt in query parameter serialization

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a Slot value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for Slot {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub starts_at: Vec<chrono::DateTime::<chrono::Utc>>,
            pub ends_at: Vec<chrono::DateTime::<chrono::Utc>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing Slot".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "startsAt" => intermediate_rep.starts_at.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "endsAt" => intermediate_rep.ends_at.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing Slot".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(Slot {
            starts_at: intermediate_rep.starts_at.into_iter().next().ok_or_else(|| "startsAt missing in Slot".to_string())?,
            ends_at: intermediate_rep.ends_at.into_iter().next().ok_or_else(|| "endsAt missing in Slot".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<Slot> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<Slot>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<Slot>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for Slot - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<Slot> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <Slot as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into Slot - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}



/// Доступность на всё актуальное окно, даже при пустом items.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct SlotList {
    /// Серверное время расчёта.
    #[serde(rename = "serverTime")]
    pub server_time: chrono::DateTime::<chrono::Utc>,

    /// Включённая граница окна: московское завтра 00:00.
    #[serde(rename = "windowStart")]
    pub window_start: chrono::DateTime::<chrono::Utc>,

    /// Исключённая граница: московская дата D+15 00:00.
    #[serde(rename = "windowEnd")]
    pub window_end: chrono::DateTime::<chrono::Utc>,

    /// Пояс расписания владельца.
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "timeZone")]
          #[validate(custom(function = "check_xss_string"))]
    pub time_zone: String,

    /// Свободные слоты, отсортированные по началу.
    #[serde(rename = "items")]
          #[validate(nested)]
    pub items: Vec<models::Slot>,

}



impl SlotList {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(server_time: chrono::DateTime::<chrono::Utc>, window_start: chrono::DateTime::<chrono::Utc>, window_end: chrono::DateTime::<chrono::Utc>, time_zone: String, items: Vec<models::Slot>, ) -> SlotList {
        SlotList {
 server_time,
 window_start,
 window_end,
 time_zone,
 items,
        }
    }
}

/// Converts the SlotList value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for SlotList {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            // Skipping serverTime in query parameter serialization

            // Skipping windowStart in query parameter serialization

            // Skipping windowEnd in query parameter serialization


            Some("timeZone".to_string()),
            Some(self.time_zone.to_string()),

            // Skipping items in query parameter serialization

        ];

        write!(f, "{}", params.into_iter().flatten().collect::<Vec<_>>().join(","))
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a SlotList value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for SlotList {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub server_time: Vec<chrono::DateTime::<chrono::Utc>>,
            pub window_start: Vec<chrono::DateTime::<chrono::Utc>>,
            pub window_end: Vec<chrono::DateTime::<chrono::Utc>>,
            pub time_zone: Vec<String>,
            pub items: Vec<Vec<models::Slot>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => return std::result::Result::Err("Missing value while parsing SlotList".to_string())
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "serverTime" => intermediate_rep.server_time.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "windowStart" => intermediate_rep.window_start.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "windowEnd" => intermediate_rep.window_end.push(<chrono::DateTime::<chrono::Utc> as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "timeZone" => intermediate_rep.time_zone.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    "items" => return std::result::Result::Err("Parsing a container in this style is not supported in SlotList".to_string()),
                    _ => return std::result::Result::Err("Unexpected key while parsing SlotList".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(SlotList {
            server_time: intermediate_rep.server_time.into_iter().next().ok_or_else(|| "serverTime missing in SlotList".to_string())?,
            window_start: intermediate_rep.window_start.into_iter().next().ok_or_else(|| "windowStart missing in SlotList".to_string())?,
            window_end: intermediate_rep.window_end.into_iter().next().ok_or_else(|| "windowEnd missing in SlotList".to_string())?,
            time_zone: intermediate_rep.time_zone.into_iter().next().ok_or_else(|| "timeZone missing in SlotList".to_string())?,
            items: intermediate_rep.items.into_iter().next().ok_or_else(|| "items missing in SlotList".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<SlotList> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<SlotList>> for HeaderValue {
    type Error = String;

    fn try_from(hdr_value: header::IntoHeaderValue<SlotList>) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
             std::result::Result::Ok(value) => std::result::Result::Ok(value),
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Invalid header value for SlotList - value: {hdr_value} is invalid {e}"#))
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<SlotList> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
             std::result::Result::Ok(value) => {
                    match <SlotList as std::str::FromStr>::from_str(value) {
                        std::result::Result::Ok(value) => std::result::Result::Ok(header::IntoHeaderValue(value)),
                        std::result::Result::Err(err) => std::result::Result::Err(format!(r#"Unable to convert header value '{value}' into SlotList - {err}"#))
                    }
             },
             std::result::Result::Err(e) => std::result::Result::Err(format!(r#"Unable to convert header: {hdr_value:?} to string: {e}"#))
        }
    }
}


