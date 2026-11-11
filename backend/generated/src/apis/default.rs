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
pub enum GetHealthResponse {
    /// The request has succeeded.
    Status200_TheRequestHasSucceeded
    (models::Health)
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
    /// GetHealth - GET /api/health
    async fn get_health(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
    ) -> Result<GetHealthResponse, E>;

    /// ListMeetingTypes - GET /api/meeting-types
    async fn list_meeting_types(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
    ) -> Result<ListMeetingTypesResponse, E>;
}
