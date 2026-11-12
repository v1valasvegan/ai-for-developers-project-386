use chrono::{DateTime, Datelike, Duration, FixedOffset, TimeZone, Utc, Weekday};
use okoshko_api::models::{OccupiedInterval, Slot, SlotList};

pub fn slots(now: DateTime<Utc>, duration_minutes: i32, occupied: &[(i64, i64)]) -> SlotList {
    // Europe/Moscow has a fixed UTC+03 offset throughout the supported booking window.
    let moscow = FixedOffset::east_opt(3 * 3600).expect("valid Moscow offset");
    let today = now.with_timezone(&moscow).date_naive();
    let midnight = moscow
        .from_local_datetime(&today.and_hms_opt(0, 0, 0).expect("valid midnight"))
        .single()
        .expect("fixed offset is unambiguous")
        .with_timezone(&Utc);
    let mut items = Vec::new();
    for day in 1..=14 {
        let date = today + Duration::days(day);
        if matches!(date.weekday(), Weekday::Sat | Weekday::Sun) {
            continue;
        }
        let opening = midnight + Duration::days(day) + Duration::hours(10);
        for minute in (0..=480 - duration_minutes).step_by(15) {
            let start = opening + Duration::minutes(i64::from(minute));
            let end = start + Duration::minutes(i64::from(duration_minutes));
            if occupied.iter().any(|&(existing_start, existing_end)| {
                existing_start < end.timestamp() && start.timestamp() < existing_end
            }) {
                continue;
            }
            items.push(Slot::new(start, end));
        }
    }
    let window_start = midnight + Duration::days(1);
    let window_end = midnight + Duration::days(15);
    let mut intervals: Vec<_> = occupied
        .iter()
        .filter(|&&(start, end)| start < window_end.timestamp() && window_start.timestamp() < end)
        .filter_map(|&(start, end)| {
            Some(OccupiedInterval::new(
                DateTime::from_timestamp(start, 0)?,
                DateTime::from_timestamp(end, 0)?,
            ))
        })
        .collect();
    intervals.sort_by_key(|interval| (interval.starts_at, interval.ends_at));
    let mut result = SlotList::new(
        now,
        window_start,
        window_end,
        "Europe/Moscow".to_owned(),
        items,
    );
    result.occupied = Some(intervals);
    result
}
