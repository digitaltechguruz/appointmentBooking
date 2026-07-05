import type { MeetingType } from "@prisma/client";

type Props = {
  meetingTypes: MeetingType[];
  defaultSelectedIds?: string[];
  emptyMessage?: string;
};

function MeetingTypeIcon({ type }: { type: MeetingType["type"] }) {
  switch (type) {
    case "ZOOM":
    case "GOOGLE_MEET":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 10l3 2.5L8 15V10Z" fill="currentColor" />
        </svg>
      );
    case "PHONE":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M8.5 5.5h2l1.2 3-1.6 1.1a11 11 0 0 0 4.4 4.4L15.5 12l3 1.2v2a1.5 1.5 0 0 1-1.5 1.5C10.8 16.7 7.3 13.2 5.5 8.5A1.5 1.5 0 0 1 7 7h1.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "WHATSAPP":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 4a8 8 0 0 0-6.9 12.1L4 20l3.9-1A8 8 0 1 0 12 4Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 10.5c.3.8 1.2 2.1 2.4 2.9 1 .7 2 1 2.4 1.1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "IN_STORE":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 10.5 12 5l8 5.5V19a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-8.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}

export function MeetingTypeListReadonly({
  meetingTypes,
}: {
  meetingTypes: Array<{
    id: string;
    name: string;
    subtitle?: string | null;
    type: MeetingType["type"];
  }>;
}) {
  return (
    <div className="ab-meeting-type-picker ab-meeting-type-picker--readonly">
      {meetingTypes.map((meetingType) => (
        <div key={meetingType.id} className="ab-meeting-type-card ab-meeting-type-card--readonly">
          <span className="ab-meeting-type-card__body">
            <span
              className={`ab-meeting-type-card__icon ab-meeting-type-card__icon--${meetingType.type.toLowerCase().replace(/_/g, "-")}`}
            >
              <MeetingTypeIcon type={meetingType.type} />
            </span>
            <span className="ab-meeting-type-card__text">
              <span className="ab-meeting-type-card__name">{meetingType.name}</span>
              {meetingType.subtitle ? (
                <span className="ab-meeting-type-card__subtitle">{meetingType.subtitle}</span>
              ) : null}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function MeetingTypePicker({
  meetingTypes,
  defaultSelectedIds = [],
  emptyMessage = "No meeting types yet — create them first.",
}: Props) {
  if (meetingTypes.length === 0) {
    return <p className="ab-services__hint">{emptyMessage}</p>;
  }

  return (
    <div className="ab-meeting-type-picker" role="group" aria-label="Meeting types">
      {meetingTypes.map((meetingType) => (
          <label key={meetingType.id} className="ab-meeting-type-card">
            <input
              type="checkbox"
              className="ab-meeting-type-card__input"
              name="meetingTypeIds"
              value={meetingType.id}
              defaultChecked={defaultSelectedIds.includes(meetingType.id)}
            />
            <span className="ab-meeting-type-card__body">
              <span className={`ab-meeting-type-card__icon ab-meeting-type-card__icon--${meetingType.type.toLowerCase().replace(/_/g, "-")}`}>
                <MeetingTypeIcon type={meetingType.type} />
              </span>
              <span className="ab-meeting-type-card__text">
                <span className="ab-meeting-type-card__name">{meetingType.name}</span>
                {meetingType.subtitle ? (
                  <span className="ab-meeting-type-card__subtitle">{meetingType.subtitle}</span>
                ) : null}
              </span>
              <span className="ab-meeting-type-card__check" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none">
                  <path
                    d="M5 10.5 8.5 14 15 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </span>
          </label>
        ))}
    </div>
  );
}
