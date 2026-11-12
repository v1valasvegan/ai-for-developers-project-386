import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";

// Only temporary tests use fixtures; the application never seeds demo data.
// Until POST /meeting-types exists, prepare data using the real migration.
export async function prepareCatalogue(path) {
  const database = new DatabaseSync(path);
  try {
    database.exec(await readFile("backend/migrations/001_meeting_types.sql", "utf8"));
    const insert = database.prepare(
      "INSERT INTO meeting_types (id, title, description, duration_minutes) VALUES (?, ?, ?, ?)",
    );
    insert.run("review-60", "Разбор проекта", "Подробно обсудим проект", 60);
    insert.run("intro-30", "Знакомство", "Обсудим ваш вопрос", 30);
  } finally {
    database.close();
  }
}
