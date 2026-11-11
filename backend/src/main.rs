mod availability;
mod clock;
mod storage;

use async_trait::async_trait;
use axum_extra::extract::CookieJar;
use headers::Host;
use http::Method;
use okoshko_api::{
    apis::{
        ErrorHandler,
        default::{
            Default as ServiceApi, GetHealthResponse, ListMeetingTypeSlotsResponse,
            ListMeetingTypesResponse,
        },
    },
    models::{ApiError, Health, ListMeetingTypeSlotsPathParams},
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
    let address = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".to_owned());
    let listener = tokio::net::TcpListener::bind(&address).await?;
    println!("Окошко API: http://{}", listener.local_addr()?);
    let app = okoshko_api::server::new(Arc::new(Api {
        database_path,
        clock: clock::Clock::configured(),
    }));
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            if let Err(error) = tokio::signal::ctrl_c().await {
                eprintln!("Не удалось установить обработчик завершения: {error}");
            }
        })
        .await?;
    Ok(())
}
