use async_trait::async_trait;
use axum_extra::extract::CookieJar;
use headers::Host;
use http::Method;
use okoshko_api::{
    apis::{ErrorHandler, default::Default as HealthApi, default::GetHealthResponse},
    models::Health,
};
use std::{convert::Infallible, sync::Arc};

struct Api;

#[async_trait]
impl ErrorHandler<Infallible> for Api {}

#[async_trait]
impl HealthApi<Infallible> for Api {
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
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let address = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".to_owned());
    let listener = tokio::net::TcpListener::bind(&address).await?;
    println!("Окошко API: http://{}", listener.local_addr()?);
    let app = okoshko_api::server::new(Arc::new(Api));
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            if let Err(error) = tokio::signal::ctrl_c().await {
                eprintln!("Не удалось установить обработчик завершения: {error}");
            }
        })
        .await?;
    Ok(())
}
