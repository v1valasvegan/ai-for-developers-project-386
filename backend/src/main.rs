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
            CreateMeetingTypeResponse, Default as ServiceApi, GetHealthResponse,
            ListMeetingTypesResponse,
        },
    },
    models::{ApiError, CreateMeetingType, Health},
};
use std::{convert::Infallible, path::PathBuf, sync::Arc};

struct Api {
    database_path: PathBuf,
}

#[async_trait]
impl ErrorHandler<Infallible> for Api {}

#[async_trait]
impl ServiceApi<Infallible> for Api {
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
    let app = okoshko_api::server::new(Arc::new(Api { database_path })).layer(
        axum::middleware::from_fn(request_validation::meeting_type_json),
    );
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            if let Err(error) = tokio::signal::ctrl_c().await {
                eprintln!("Не удалось установить обработчик завершения: {error}");
            }
        })
        .await?;
    Ok(())
}
