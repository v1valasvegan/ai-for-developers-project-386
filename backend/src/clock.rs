use chrono::{DateTime, Utc};

#[derive(Clone)]
pub enum Clock {
    System,
    // Internal test harness input. Release builds only have the real server clock.
    #[cfg(debug_assertions)]
    File(std::path::PathBuf),
}

impl Clock {
    pub fn configured() -> Self {
        #[cfg(debug_assertions)]
        if let Some(path) =
            std::env::var_os("OKOSHKO_TEST_CLOCK_FILE").filter(|path| !path.is_empty())
        {
            return Self::File(path.into());
        }
        Self::System
    }

    pub fn now(&self) -> std::io::Result<DateTime<Utc>> {
        match self {
            Self::System => Ok(Utc::now()),
            #[cfg(debug_assertions)]
            Self::File(path) => {
                let value = std::fs::read_to_string(path)?;
                DateTime::parse_from_rfc3339(value.trim())
                    .map(|time| time.with_timezone(&Utc))
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))
            }
        }
    }
}
