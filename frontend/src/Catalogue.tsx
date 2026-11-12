import { useQuery } from "@tanstack/react-query";
import ScrollRegion from "./ScrollRegion";
import MeetingTypeCard from "./MeetingTypeCard";
import { meetingTypesQuery } from "./queries";

export default function Catalogue({
  showCode = false,
  onSelect,
}: {
  showCode?: boolean;
  onSelect?: (id: string) => void;
}) {
  const query = useQuery(meetingTypesQuery);
  if (query.isPending) return <output>Загружаем типы встреч…</output>;
  if (query.isError)
    return (
      <div>
        <p role="alert">Не удалось загрузить типы встреч. Повторите попытку.</p>
        <button
          className="page-link"
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Повторить
        </button>
      </div>
    );
  if (query.data.items.length === 0) return <p>Пока нет доступных типов встреч</p>;
  return (
    <ScrollRegion label="Прокрутка типов встреч">
      <ul className="catalogue-list" aria-label="Типы встреч">
        {query.data.items.map((type) => (
          <MeetingTypeCard
            key={type.id}
            meetingType={type}
            showCode={showCode}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </ScrollRegion>
  );
}
