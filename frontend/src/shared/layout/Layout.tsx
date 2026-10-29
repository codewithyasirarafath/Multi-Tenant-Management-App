import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/context/AuthContext";
import { useOrg } from "@/shared/context/OrgContext";
import { useI18n } from "@/shared/i18n/I18nProvider";
import { Badge, Button, Select } from "@/shared/components/ui";
import { LanguageToggle, ThemeToggle } from "@/shared/theme/Toggles";

const NAV = [
  { to: "/", key: "nav.dashboard", end: true },
  { to: "/deliveries", key: "nav.deliveries" },
  { to: "/inventory", key: "nav.inventory" },
  { to: "/customers", key: "nav.customers" },
  { to: "/invoicing", key: "nav.invoicing" },
  { to: "/notifications", key: "nav.notifications" },
  { to: "/webhooks", key: "nav.webhooks" },
  { to: "/ai-chat", key: "nav.aiChat" },
  { to: "/api-keys", key: "nav.apiKeys" },
  { to: "/admin", key: "nav.admin" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { memberships, membership, selectOrg } = useOrg();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-4 py-5">
          <div className="flex items-center gap-2">
            <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
              DM
            </div>
            <div>
              <div className="text-sm font-semibold brand-text">{t("app.name")}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
          </div>
        </div>

        <div className="border-y border-border px-4 py-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("org.label")}
          </label>
          {memberships.length > 0 ? (
            <>
              <Select value={membership?.org_id ?? ""} onChange={(e) => selectOrg(e.target.value)}>
                {memberships.map((m) => (
                  <option key={m.membership_id} value={m.org_id}>
                    {m.org_name} ({m.org_code})
                  </option>
                ))}
              </Select>
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {membership?.entity_name && <Badge>{membership.entity_name}</Badge>}
                {membership?.role_name && <Badge tone="info">{membership.role_name}</Badge>}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t("org.none")}</p>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-accent font-medium text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <ThemeToggle />
          <LanguageToggle />
          <Button variant="ghost" onClick={handleLogout}>
            {t("nav.logout")}
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        {memberships.length === 0 && (
          <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            {t("org.createFirst")}{" "}
            <NavLink to="/admin" className="font-medium underline">
              {t("nav.admin")}
            </NavLink>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
