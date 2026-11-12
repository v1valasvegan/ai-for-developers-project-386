import type { MeetingType } from "./api/generated/types.gen";

export default function MeetingTypeCard({
  meetingType,
  heading: Heading = "h2",
  showCode = false,
  onSelect,
}: {
  meetingType: MeetingType;
  heading?: "h2" | "h3";
  showCode?: boolean;
  onSelect?: (id: string) => void;
}) {
  return (
    <li>
      <div className="catalogue-copy">
        <Heading>{meetingType.title}</Heading>
        {showCode ? <p className="catalogue-code">{meetingType.id}</p> : null}
        <p className="catalogue-description">{meetingType.description}</p>
      </div>
      <div className="catalogue-choice">
        <p className="catalogue-duration">{meetingType.durationMinutes} минут</p>
        {onSelect ? (
          <button className="page-link" type="button" onClick={() => onSelect(meetingType.id)}>
            Выбрать {meetingType.title}
          </button>
        ) : null}
      </div>
    </li>
  );
}
