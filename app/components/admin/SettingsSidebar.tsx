import { NavLink } from "react-router";
import { useAdminI18n } from "../../lib/admin-i18n";

const NAV_ITEMS = [
  {
    to: "languages",
    labelKey: "settings.navLanguages",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M3 12h18M12 3c2.5 2.8 3.8 6 3.8 9s-1.3 6.2-3.8 9M12 3c-2.5 2.8-3.8 6-3.8 9s1.3 6.2 3.8 9"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
  {
    to: "appearance",
    labelKey: "settings.navAppearance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 20h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "integrations",
    labelKey: "settings.navIntegrations",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

export function SettingsSidebar() {
  const { t } = useAdminI18n();

  return (
    <nav className="ab-settings-layout__nav" aria-label={t("settings.pageTitle")}>
      <ul className="ab-settings-layout__nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                [
                  "ab-settings-layout__nav-link",
                  isActive ? "ab-settings-layout__nav-link--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              end
            >
              <span className="ab-settings-layout__nav-icon">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
