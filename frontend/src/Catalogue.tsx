import { useEffect, useState } from "react";
import { listMeetingTypes } from "./api/generated/sdk.gen";
import type { MeetingType } from "./api/generated/types.gen";

type CatalogueState =
  | { status: "loading" }
  | { status: "ready"; items: MeetingType[] }
  | { status: "error" };

export default function Catalogue({ onSelect }: { onSelect?: (id: string) => void }) {
  const [state, setState] = useState<CatalogueState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const { data } = await listMeetingTypes({ signal: controller.signal, throwOnError: true });
        if (!controller.signal.aborted) setState({ status: "ready", items: data.items });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  if (state.status === "loading") return <output>Загружаем типы встреч…</output>;
  if (state.status === "error")
    return (
      <div>
        <p role="alert">Не удалось загрузить типы встреч. Повторите попытку.</p>
        <button
          className="page-link"
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((previous) => previous + 1);
          }}
        >
          Повторить
        </button>
      </div>
    );
  if (state.items.length === 0) return <p>Пока нет доступных типов встреч</p>;
  return (
    <ul className="catalogue-list" aria-label="Типы встреч">
      {state.items.map((type) => (
        <li key={type.id}>
          <h2>{type.title}</h2>
          <p className="catalogue-description">{type.description}</p>
          <p className="catalogue-duration">{type.durationMinutes} минут</p>
          {onSelect ? (
            <button className="page-link" type="button" onClick={() => onSelect(type.id)}>
              Выбрать {type.title}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
