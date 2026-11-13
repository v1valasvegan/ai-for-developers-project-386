mod availability;
mod bookings;
mod clock;
mod meeting_types;
mod request_validation;
mod storage;

use async_trait::async_trait;
use axum_extra::extract::CookieJar;
use headers::Host;
use http::Method;
use okoshko_api::{
    apis::{
        ErrorHandler,
        default::{
            CreateBookingResponse, CreateMeetingTypeResponse, Default as ServiceApi,
            GetHealthResponse, ListBookingsResponse, ListMeetingTypeSlotsResponse,
            ListMeetingTypesResponse,
        },
    },
    models::{ApiError, CreateBooking, CreateMeetingType, Health, ListMeetingTypeSlotsPathParams},
};
use std::{convert::Infallible, path::PathBuf, sync::Arc};

struct Api {
    database_path: PathBuf,
    clock: clock::Clock,
}

#[async_trait]
impl ErrorHandler<Infallible> for Api {}

#[async_trait]
impl ServiceApi<Infallible> for Api {
    async fn create_booking(
        &self,
        _method: &Method,
        _host: &Host,
        _cookies: &CookieJar,
        body: &CreateBooking,
    ) -> Result<CreateBookingResponse, Infallible> {
        let path = self.database_path.clone();
        let input = body.clone();
        let clock = self.clock.clone();
        Ok(match tokio::task::spawn_blocking(move || bookings::create(&path, input, &clock)).await {
            Ok(Ok((booking, false))) => CreateBookingResponse::Status201_TheRequestHasSucceededAndANewResourceHasBeenCreatedAsAResult(booking),
            Ok(Ok((booking, true))) => CreateBookingResponse::Status200_TheRequestHasSucceeded(booking),
            Ok(Err(bookings::CreateError::Rejected(400, error))) => CreateBookingResponse::Status400(error),
            Ok(Err(bookings::CreateError::Rejected(404, error))) => CreateBookingResponse::Status404(error),
            Ok(Err(bookings::CreateError::Rejected(409, error))) => CreateBookingResponse::Status409(error),
            Ok(Err(bookings::CreateError::Storage(error))) if storage::is_unavailable(&error) => CreateBookingResponse::Status503(ApiError::new("storage_unavailable".into(), "Хранилище временно недоступно".into())),
            Ok(Err(bookings::CreateError::Clock(error))) => {
                eprintln!("Server clock failed: {error}");
                CreateBookingResponse::Status500(ApiError::new("internal_error".into(), "Не удалось создать запись".into()))
            }
            error => {
                eprintln!("Booking failed: {error:?}");
                CreateBookingResponse::Status500(ApiError::new("internal_error".into(), "Не удалось создать запись".into()))
            }
        })
    }

    async fn list_bookings(
        &self,
        _method: &Method,
        _host: &Host,
        _cookies: &CookieJar,
    ) -> Result<ListBookingsResponse, Infallible> {
        let path = self.database_path.clone();
        let now = self.clock.now();
        Ok(
            match tokio::task::spawn_blocking(move || {
                now.map_err(|_| rusqlite::Error::InvalidQuery)
                    .and_then(|now| bookings::list(&path, now))
            })
            .await
            {
                Ok(Ok(list)) => ListBookingsResponse::Status200_TheRequestHasSucceeded(list),
                Ok(Err(error)) if storage::is_unavailable(&error) => {
                    ListBookingsResponse::Status503(ApiError::new(
                        "storage_unavailable".into(),
                        "Хранилище временно недоступно".into(),
                    ))
                }
                error => {
                    eprintln!("Booking list failed: {error:?}");
                    ListBookingsResponse::Status500(ApiError::new(
                        "internal_error".into(),
                        "Не удалось получить встречи".into(),
                    ))
                }
            },
        )
    }

    async fn create_meeting_type(
        &self,
        _method: &Method,
        _host: &Host,
        _cookies: &CookieJar,
        body: &CreateMeetingType,
    ) -> Result<CreateMeetingTypeResponse, Infallible> {
        let path = self.database_path.clone();
        let input = match meeting_types::normalize(body) {
            Ok(input) => input,
            Err(error) => return Ok(CreateMeetingTypeResponse::Status400(error)),
        };
        Ok(match tokio::task::spawn_blocking(move || storage::create_type(&path, input)).await {
            Ok(Ok(item)) => CreateMeetingTypeResponse::Status201_TheRequestHasSucceededAndANewResourceHasBeenCreatedAsAResult(item),
            Ok(Err(error)) if storage::is_duplicate_type(&error) => {
                let message = "Этот код уже используется. Выберите другой".to_owned();
                let mut body = ApiError::new("meeting_type_exists".to_owned(), message.clone());
                body.field_errors = Some(std::collections::HashMap::from([("id".to_owned(), message)]));
                CreateMeetingTypeResponse::Status409(body)
            }
            Ok(Err(error)) if storage::is_unavailable(&error) => {
                eprintln!("Storage unavailable: {error}");
                CreateMeetingTypeResponse::Status503(ApiError::new(
                    "storage_unavailable".to_owned(),
                    "Хранилище временно недоступно. Повторите попытку".to_owned(),
                ))
            }
            error => {
                eprintln!("Create type error: {error:?}");
                CreateMeetingTypeResponse::Status500(ApiError::new("internal_error".to_owned(), "Не удалось создать тип встречи".to_owned()))
            }
        })
    }

    async fn get_health(
        &self,
        _method: &Method,
        _host: &Host,
        _cookies: &CookieJar,
    ) -> Result<GetHealthResponse, Infallible> {
        Ok(GetHealthResponse::Status200_TheRequestHasSucceeded(
            Health::new("ok".to_owned()),
        ))
    }

    async fn list_meeting_type_slots(
        &self,
        _method: &Method,
        _host: &Host,
        _cookies: &CookieJar,
        path_params: &ListMeetingTypeSlotsPathParams,
    ) -> Result<ListMeetingTypeSlotsResponse, Infallible> {
        use ListMeetingTypeSlotsResponse as Response;
        let now = match self.clock.now() {
            Ok(now) => now,
            Err(error) => {
                eprintln!("Server clock failed: {error}");
                return Ok(Response::Status500(ApiError::new(
                    "internal_error".into(),
                    "Не удалось рассчитать доступность".into(),
                )));
            }
        };
        let path = self.database_path.clone();
        let id = path_params.id.clone();
        Ok(
            match tokio::task::spawn_blocking(move || storage::slots(&path, &id, now)).await {
                Ok(Ok(Some(slots))) => Response::Status200_TheRequestHasSucceeded(slots),
                Ok(Ok(None)) => Response::Status404(ApiError::new(
                    "meeting_type_not_found".into(),
                    "Тип встречи не найден".into(),
                )),
                Ok(Err(error)) if storage::is_unavailable(&error) => {
                    eprintln!("Storage unavailable: {error}");
                    Response::Status503(ApiError::new(
                        "storage_unavailable".into(),
                        "Хранилище временно недоступно. Повторите попытку".into(),
                    ))
                }
                error => {
                    eprintln!("Availability failed: {error:?}");
                    Response::Status500(ApiError::new(
                        "internal_error".into(),
                        "Не удалось рассчитать доступность".into(),
                    ))
                }
            },
        )
    }

    async fn list_meeting_types(
        &self,
        _method: &Method,
        _host: &Host,
        _cookies: &CookieJar,
    ) -> Result<ListMeetingTypesResponse, Infallible> {
        let path = self.database_path.clone();
        Ok(
            match tokio::task::spawn_blocking(move || storage::catalogue(&path)).await {
                Ok(Ok(catalogue)) => {
                    ListMeetingTypesResponse::Status200_TheRequestHasSucceeded(catalogue)
                }
                Ok(Err(error)) if storage::is_unavailable(&error) => {
                    eprintln!("Storage unavailable: {error}");
                    ListMeetingTypesResponse::Status503(ApiError::new(
                        "storage_unavailable".to_owned(),
                        "Хранилище временно недоступно. Повторите попытку".to_owned(),
                    ))
                }
                error => {
                    eprintln!("Catalogue error: {error:?}");
                    ListMeetingTypesResponse::Status500(ApiError::new(
                        "internal_error".to_owned(),
                        "Не удалось загрузить типы встреч".to_owned(),
                    ))
                }
            },
        )
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_path = match std::env::var("DATABASE_PATH") {
        Ok(path) => PathBuf::from(path),
        Err(_) => {
            std::fs::create_dir_all("data")?;
            PathBuf::from("data/okoshko.sqlite3")
        }
    };
    if let Err(error) = storage::initialize(&database_path) {
        eprintln!("Storage initialization failed: {error}");
    }
    let address = match std::env::var("PORT") {
        Ok(port) => format!("0.0.0.0:{}", port.parse::<std::num::NonZeroU16>()?),
        Err(std::env::VarError::NotPresent) => {
            std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".to_owned())
        }
        Err(error) => return Err(error.into()),
    };
    let app = okoshko_api::server::new(Arc::new(Api {
        database_path,
        clock: clock::Clock::configured(),
    }))
    .layer(axum::middleware::from_fn(
        request_validation::validate_creation_json,
    ));
    let app = if let Ok(directory) = std::env::var("STATIC_DIR") {
        let directory = PathBuf::from(directory);
        std::fs::metadata(directory.join("index.html"))?;
        let index = tower_http::services::ServeFile::new(directory.join("index.html"));
        let mut pages = axum::Router::new();
        for path in ["/book", "/book/", "/book/{*path}", "/owner", "/owner/"] {
            pages = pages.route(path, axum::routing::get_service(index.clone()));
        }
        app.fallback_service(tower_http::services::ServeDir::new(directory).fallback(pages))
    } else {
        app
    };
    #[cfg(unix)]
    let mut interrupt = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())?;
    #[cfg(unix)]
    let mut terminate = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
    let listener = tokio::net::TcpListener::bind(&address).await?;
    println!("Окошко API: http://{}", listener.local_addr()?);
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            #[cfg(unix)]
            tokio::select! {
                _ = interrupt.recv() => {},
                _ = terminate.recv() => {},
            }
            #[cfg(not(unix))]
            if let Err(error) = tokio::signal::ctrl_c().await {
                eprintln!("Не удалось установить обработчик завершения: {error}");
            }
        })
        .await?;
    Ok(())
}
