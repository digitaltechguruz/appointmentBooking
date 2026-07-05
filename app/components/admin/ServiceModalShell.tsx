import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  formClassName?: string;
};

function IconClose() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ServiceModalShell({
  title,
  subtitle,
  onClose,
  footer,
  children,
  formClassName,
}: Props) {
  return (
    <div
      className="ab-services__overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`ab-services__modal${formClassName ? ` ${formClassName}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-modal-title"
      >
        <header className="ab-services__modal-header">
          <div className="ab-services__modal-headings">
            <h2 id="service-modal-title" className="ab-services__modal-title">
              {title}
            </h2>
            {subtitle ? <p className="ab-services__modal-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="ab-services__icon-btn ab-services__icon-btn--close"
            aria-label="Close"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </header>

        <div className="ab-services__modal-body">{children}</div>

        {footer ? <footer className="ab-services__modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
