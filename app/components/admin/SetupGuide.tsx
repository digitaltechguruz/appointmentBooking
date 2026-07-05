import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";
import { useAdminI18n } from "../../lib/admin-i18n";
import { useFetcherIdleResult } from "../../lib/admin/toast";
import type {
  SetupGuideData,
  SetupStepId,
} from "../../lib/setup-guide/setup-guide.server";

type SetupGuideProps = {
  guide: SetupGuideData;
  themeEditor: {
    addBlock: string;
    appEmbeds: string;
  };
};

type StepAction =
  | { kind: "link"; to: string; labelKey: string; primary?: boolean }
  | { kind: "theme"; url: string; labelKey: string; primary?: boolean };

const STEP_ACTIONS: Record<SetupStepId, StepAction[]> = {
  services: [
    { kind: "link", to: "/app/services", labelKey: "dashboard.setupGuide.manageServices", primary: true },
  ],
  linkMeetingTypes: [
    { kind: "link", to: "/app/services", labelKey: "dashboard.setupGuide.editServices", primary: true },
  ],
  availability: [
    { kind: "link", to: "/app/availability", labelKey: "dashboard.setupGuide.setAvailability", primary: true },
  ],
  widgetTheme: [
    { kind: "theme", url: "addBlock", labelKey: "dashboard.addBlockToTheme", primary: true },
    { kind: "theme", url: "appEmbeds", labelKey: "dashboard.openAppEmbeds" },
  ],
  widgetAppearance: [
    { kind: "link", to: "/app/settings/appearance", labelKey: "dashboard.setupGuide.customizeAppearance", primary: true },
  ],
  languages: [
    { kind: "link", to: "/app/settings/languages", labelKey: "dashboard.setupGuide.configureLanguages", primary: true },
  ],
  firstBooking: [
    { kind: "link", to: "/app/bookings", labelKey: "dashboard.setupGuide.viewBookings", primary: true },
  ],
};

export function SetupGuide({ guide, themeEditor }: SetupGuideProps) {
  const { t } = useAdminI18n();
  const fetcher = useFetcher<{ ok?: boolean }>();
  const revalidator = useRevalidator();
  const [collapsed, setCollapsed] = useState(false);

  const firstIncompleteId = useMemo(
    () => guide.steps.find((step) => !step.completed)?.id ?? guide.steps[0]?.id,
    [guide.steps],
  );

  const [expandedId, setExpandedId] = useState<SetupStepId | null>(
    firstIncompleteId ?? null,
  );

  useEffect(() => {
    if (!expandedId || guide.steps.find((step) => step.id === expandedId)?.completed) {
      setExpandedId(firstIncompleteId ?? null);
    }
  }, [expandedId, firstIncompleteId, guide.steps]);

  useFetcherIdleResult(fetcher, () => {
    revalidator.revalidate();
  });

  if (guide.allComplete) {
    return null;
  }

  function markComplete(stepId: SetupStepId) {
    const formData = new FormData();
    formData.set("intent", "markSetupStep");
    formData.set("stepId", stepId);
    fetcher.submit(formData, { method: "post" });
  }

  function toggleStep(stepId: SetupStepId) {
    setExpandedId((current) => (current === stepId ? null : stepId));
  }

  function openThemeEditor(target: "addBlock" | "appEmbeds") {
    window.open(themeEditor[target], "_top");
  }

  return (
    <section className="ab-setup-guide">
      <div className="ab-setup-guide__header">
        <div className="ab-setup-guide__header-main">
          <p className="ab-setup-guide__progress">
            <span className="ab-setup-guide__progress-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 4V2M15 4V6M15 4H10.5M4 10.5V4a2 2 0 0 1 2-2h3.17a2 2 0 0 1 1.41.59l1.83 1.83A2 2 0 0 0 14.83 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 14l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {t("dashboard.setupGuide.progress", {
              completed: guide.completedCount,
              total: guide.totalCount,
            })}
          </p>
          <h2 className="ab-setup-guide__title">{t("dashboard.setupGuide.title")}</h2>
          <p className="ab-setup-guide__subtitle">{t("dashboard.setupGuide.subtitle")}</p>
        </div>
        <button
          type="button"
          className="ab-setup-guide__collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("dashboard.setupGuide.expand") : t("dashboard.setupGuide.collapse")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className={collapsed ? "ab-setup-guide__chevron--collapsed" : undefined}
            aria-hidden
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {!collapsed ? (
        <ul className="ab-setup-guide__steps">
          {guide.steps.map((step) => {
            const expanded = expandedId === step.id;
            const titleKey = `dashboard.setupGuide.steps.${step.id}.title` as const;
            const descKey = `dashboard.setupGuide.steps.${step.id}.description` as const;
            const actions = STEP_ACTIONS[step.id];

            return (
              <li
                key={step.id}
                className={`ab-setup-guide__step${expanded ? " ab-setup-guide__step--expanded" : ""}${step.completed ? " ab-setup-guide__step--complete" : ""}`}
              >
                <button
                  type="button"
                  className="ab-setup-guide__step-toggle"
                  onClick={() => toggleStep(step.id)}
                  aria-expanded={expanded}
                >
                  <span
                    className={`ab-setup-guide__status${step.completed ? " ab-setup-guide__status--complete" : ""}`}
                    aria-hidden
                  >
                    {step.completed ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="ab-setup-guide__step-title">{t(titleKey)}</span>
                </button>

                {expanded ? (
                  <div className="ab-setup-guide__step-body">
                    <p className="ab-setup-guide__step-desc">{t(descKey)}</p>
                    <div className="ab-setup-guide__step-actions">
                      {actions.map((action) => {
                        if (action.kind === "link") {
                          return (
                            <Link
                              key={action.labelKey}
                              to={action.to}
                              className={
                                action.primary
                                  ? "ab-setup-guide__btn ab-setup-guide__btn--primary"
                                  : "ab-setup-guide__btn ab-setup-guide__btn--secondary"
                              }
                            >
                              {t(action.labelKey)}
                            </Link>
                          );
                        }

                        return (
                          <button
                            key={action.labelKey}
                            type="button"
                            className={
                              action.primary
                                ? "ab-setup-guide__btn ab-setup-guide__btn--primary"
                                : "ab-setup-guide__btn ab-setup-guide__btn--secondary"
                            }
                            onClick={() => openThemeEditor(action.url as "addBlock" | "appEmbeds")}
                          >
                            {t(action.labelKey)}
                          </button>
                        );
                      })}
                      {step.manual && !step.completed ? (
                        <button
                          type="button"
                          className="ab-setup-guide__mark-complete"
                          onClick={() => markComplete(step.id)}
                          disabled={fetcher.state !== "idle"}
                        >
                          {t("dashboard.setupGuide.markComplete")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
