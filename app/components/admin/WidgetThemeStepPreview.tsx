import type { WidgetThemeId } from "../../lib/widget/themes.shared";

const PREVIEW_SERVICES = [
  { name: "Browse the collection", duration: "45 minutes", selected: false },
  { name: "Custom design", duration: "40 minutes", selected: false },
  { name: "Engagement ring", duration: "40 minutes", selected: true },
];

const MODERN_STEPS = [
  { title: "Services", subtitle: "Choose a service", active: true },
  { title: "Meeting type", subtitle: "How to meet", active: false },
  { title: "Date & time", subtitle: "Pick a slot", active: false },
  { title: "Your details", subtitle: "Contact information", active: false },
  { title: "Review", subtitle: "Confirm booking", active: false },
];

type Props = {
  theme: WidgetThemeId;
};

export function WidgetThemeStepPreview({ theme }: Props) {
  const isClassic = theme === "CLASSIC";

  if (!isClassic) {
    return (
      <div className="ab-theme-preview ab-theme-preview--modern-vertical" aria-hidden>
        <div className="ab-theme-preview__modern-shell">
          <aside className="ab-theme-preview__modern-sidebar">
            <ol className="ab-theme-preview__modern-steps">
              {MODERN_STEPS.map((step, idx) => (
                <li key={step.title} className="ab-theme-preview__modern-step">
                  <div className="ab-theme-preview__modern-step-text">
                    <div
                      className={`ab-theme-preview__modern-step-title${step.active ? " ab-theme-preview__modern-step-title--active" : ""}`}
                    >
                      {step.title}
                    </div>
                    <div className="ab-theme-preview__modern-step-sub">{step.subtitle}</div>
                  </div>
                  <div className="ab-theme-preview__modern-step-rail">
                    <span
                      className={`ab-theme-preview__modern-dot${step.active ? " ab-theme-preview__modern-dot--active" : ""}`}
                    />
                    {idx < MODERN_STEPS.length - 1 && (
                      <span className="ab-theme-preview__modern-line" />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </aside>

          <div className="ab-theme-preview__modern-panel">
            <div className="ab-theme-preview__modern-badge">Step 1/5</div>
            <h3 className="ab-theme-preview__heading">What brings you in?</h3>
            <p className="ab-theme-preview__subtitle">Select the type of appointment.</p>

            <div className="ab-theme-preview__cards ab-theme-preview__cards--modern">
              {PREVIEW_SERVICES.map((service) => (
                <div
                  key={service.name}
                  className={`ab-theme-preview__card${service.selected ? " ab-theme-preview__card--selected" : ""}`}
                >
                  <div className="ab-theme-preview__card-image" />
                  <div className="ab-theme-preview__card-body">
                    <div className="ab-theme-preview__card-title">{service.name}</div>
                    <div className="ab-theme-preview__card-duration">{service.duration}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ab-theme-preview ab-theme-preview--classic" aria-hidden>
      <div className="ab-theme-preview__stepper">
        {[1, 2, 3, 4, 5].map((step) => (
          <div key={step} className="ab-theme-preview__stepper-item">
            <span
              className={`ab-theme-preview__step${step === 1 ? " ab-theme-preview__step--active" : ""}`}
            >
              {step}
            </span>
            {step < 5 && <span className="ab-theme-preview__connector" />}
          </div>
        ))}
      </div>

      <h3 className="ab-theme-preview__heading">What brings you in?</h3>
      <p className="ab-theme-preview__subtitle">Select the type of appointment.</p>

      <div className="ab-theme-preview__cards">
        {PREVIEW_SERVICES.map((service) => (
          <div
            key={service.name}
            className={`ab-theme-preview__card${service.selected ? " ab-theme-preview__card--selected" : ""}`}
          >
            <div className="ab-theme-preview__card-image" />
            <div className="ab-theme-preview__card-body">
              <div className="ab-theme-preview__card-title">{service.name}</div>
              <div className="ab-theme-preview__card-duration">{service.duration}</div>
              <div className="ab-theme-preview__card-desc">
                Private consultation tailored to your visit.
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
