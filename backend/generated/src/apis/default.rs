// Generated from api/main.tsp. DO NOT EDIT.
use async_trait::async_trait;
use axum::extract::*;
use axum_extra::extract::CookieJar;
use bytes::Bytes;
use headers::Host;
use http::Method;
use serde::{Deserialize, Serialize};

use crate::{models, types::*};

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum CreateBookingResponse {
    /// The request has succeeded.
    Status200_TheRequestHasSucceeded
    (models::Booking)
    ,
    /// The request has succeeded and a new resource has been created as a result.
    Status201_TheRequestHasSucceededAndANewResourceHasBeenCreatedAsAResult
    (models::Booking)
    ,
    /// Ошибки полей или некорректный запрос.
    Status400
    (models::ApiError)
    ,
    /// Указанный тип встречи не существует.
    Status404
    (models::ApiError)
    ,
    /// Пересечение либо другое содержимое успешного ключа.
    Status409
    (models::ApiError)
    ,
    /// Непредвиденная внутренняя ошибка.
    Status500
    (models::ApiError)
    ,
    /// Хранилище временно недоступно.
    Status503
    (models::ApiError)
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum CreateMeetingTypeResponse {
    /// The request has succeeded and a new resource has been created as a result.
    Status201_TheRequestHasSucceededAndANewResourceHasBeenCreatedAsAResult
    (models::MeetingType)
    ,
    /// Ошибки полей или некорректный запрос.
    Status400
    (models::ApiError)
    ,
    /// Нормализованный код уже используется.
    Status409
    (models::ApiError)
    ,
    /// Непредвиденная внутренняя ошибка.
    Status500
    (models::ApiError)
    ,
    /// Хранилище временно недоступно.
    Status503
    (models::ApiError)
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum GetHealthResponse {
    /// The request has succeeded.
    Status200_TheRequestHasSucceeded
    (models::Health)
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum ListBookingsResponse {
    /// The request has succeeded.
    Status200_TheRequestHasSucceeded
    (models::BookingList)
    ,
    /// Непредвиденная внутренняя ошибка.
    Status500
    (models::ApiError)
    ,
    /// Хранилище временно недоступно.
    Status503
    (models::ApiError)
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum ListMeetingTypeSlotsResponse {
    /// The request has succeeded.
    Status200_TheRequestHasSucceeded
    (models::SlotList)
    ,
    /// Указанный тип встречи не существует.
    Status404
    (models::ApiError)
    ,
    /// Непредвиденная внутренняя ошибка.
    Status500
    (models::ApiError)
    ,
    /// Хранилище временно недоступно.
    Status503
    (models::ApiError)
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum ListMeetingTypesResponse {
    /// The request has succeeded.
    Status200_TheRequestHasSucceeded
    (models::MeetingTypeList)
    ,
    /// Непредвиденная внутренняя ошибка.
    Status500
    (models::ApiError)
    ,
    /// Хранилище временно недоступно.
    Status503
    (models::ApiError)
}




/// Default
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait Default<E: std::fmt::Debug + Send + Sync + 'static = ()>: super::ErrorHandler<E> {
    /// CreateBooking - POST /api/bookings
    async fn create_booking(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
            body: &models::CreateBooking,
    ) -> Result<CreateBookingResponse, E>;

    /// CreateMeetingType - POST /api/meeting-types
    async fn create_meeting_type(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
            body: &models::CreateMeetingType,
    ) -> Result<CreateMeetingTypeResponse, E>;

    /// GetHealth - GET /api/health
    async fn get_health(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
    ) -> Result<GetHealthResponse, E>;

    /// ListBookings - GET /api/bookings
    async fn list_bookings(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
    ) -> Result<ListBookingsResponse, E>;

    /// ListMeetingTypeSlots - GET /api/meeting-types/{id}/slots
    async fn list_meeting_type_slots(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
      path_params: &models::ListMeetingTypeSlotsPathParams,
    ) -> Result<ListMeetingTypeSlotsResponse, E>;

    /// ListMeetingTypes - GET /api/meeting-types
    async fn list_meeting_types(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
    ) -> Result<ListMeetingTypesResponse, E>;
}
