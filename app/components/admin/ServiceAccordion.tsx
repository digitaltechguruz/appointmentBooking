import { useId, useState, type ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
};

export function ServiceAccordion({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className={`ab-services-accordion${open ? " ab-services-accordion--open" : ""}`}>
      <button
        type="button"
        className="ab-services-accordion__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ab-services-accordion__trigger-main">
          <span className="ab-services-accordion__title-row">
            <span className="ab-services-accordion__title">{title}</span>
            {badge ? <span className="ab-services-accordion__badge">{badge}</span> : null}
          </span>
          {description ? (
            <span className="ab-services-accordion__description">{description}</span>
          ) : null}
        </span>
        <span className="ab-services-accordion__chevron" aria-hidden>
          <svg viewBox="0 0 20 20" fill="none">
            <path
              d="M5 8l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="ab-services-accordion__panel">
          {children}
        </div>
      ) : null}
    </section>
  );
}
