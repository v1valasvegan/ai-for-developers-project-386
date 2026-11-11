import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { prepareCatalogue } from "./catalogue-fixture.mjs";

export async function prepareSlots(path, { occupied = [], fullDay = false } = {}) {
  await prepareCatalogue(path);
  const database = new DatabaseSync(path);
  try {
    database.exec(await readFile("backend/migrations/002_bookings.sql", "utf8"));
    if (fullDay)
      database
        .prepare("INSERT INTO meeting_types VALUES (?, ?, ?, ?)")
        .run("all-day", "Весь день", "Рабочий день", 480);
    const insert = database.prepare(
      "INSERT INTO bookings (id, meeting_type_id, meeting_type_title, starts_at, ends_at, name, email, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    occupied.forEach(([start, end], index) =>
      insert.run(
        `fixture-${index}`,
        "review-60",
        "Разбор проекта",
        Date.parse(start) / 1000,
        Date.parse(end) / 1000,
        "Гость",
        "guest@example.com",
        `fixture-key-${index}`,
      ),
    );
  } finally {
    database.close();
  }
}
