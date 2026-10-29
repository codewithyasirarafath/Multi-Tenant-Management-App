import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/shared/lib/api";
import { useOrg } from "@/shared/context/OrgContext";
import { useI18n } from "@/shared/i18n/I18nProvider";
import { Badge, Card, EmptyState, PageHeader } from "@/shared/components/ui";
import type { Alert, Delivery, Invoice } from "@/shared/types";
import { formatMoney } from "@/shared/lib/utils";

const PIPELINE: { key: string; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "var(--color-warning)" },
  { key: "in_transit", label: "In transit", color: "var(--color-primary)" },
  { key: "out_for_delivery", label: "Out for delivery", color: "oklch(0.62 0.16 200)" },
  { key: "delivered", label: "Delivered", color: "var(--color-success)" },
  { key: "cancelled", label: "Cancelled", color: "var(--color-muted-foreground)" },
];

function StatTile({
  label,
  value,
  hint,
  icon,
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: string;
  to?: string;
}) {
  const inner = (
    <Card className="tile h-full">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-semibold brand-text">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-lg">
          {icon}
        </div>
      </div>
    </Card>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function DashboardPage() {
  const { orgId, orgName, orgCode } = useOrg();
  const { t } = useI18n();

  const deliveries = useQuery({
    queryKey: ["deliveries", orgId],
    queryFn: () => api<Delivery[]>(`/organizations/${orgId}/deliveries?limit=100`),
    enabled: Boolean(orgId),
  });

  const notifications = useQuery({
    queryKey: ["notifications-unread", orgId],
    // The API returns { unreadCount: n } — normalize to a number so it can
    // be rendered as a React child (an object here crashes the whole tree).
    queryFn: async () => {
      const d = await api<unknown>(`/organizations/${orgId}/notifications/unread-count`);
      if (typeof d === "number") return d;
      const obj = d as { unreadCount?: number | string; count?: number | string } | null;
      return Number(obj?.unreadCount ?? obj?.count ?? 0);
    },
    enabled: Boolean(orgId),
  });

  const alerts = useQuery({
    queryKey: ["alerts", orgId],
    queryFn: () => api<Alert[]>(`/organizations/${orgId}/notifications/alerts?isResolved=false`),
    enabled: Boolean(orgId),
  });

  const invoices = useQuery({
    queryKey: ["invoices", orgId],
    queryFn: () => api<Invoice[]>(`/organizations/${orgId}/invoicing?limit=100`),
    enabled: Boolean(orgId),
  });

  if (!orgId) {
    return (
      <>
        <PageHeader title={t("dash.title")} subtitle={t("dash.noOrg")} />
        <EmptyState message={t("org.none")} />
      </>
    );
  }

  const rows = deliveries.data ?? [];
  const count = (status: string) => rows.filter((d) => d.status === status).length;
  const total = rows.length || 1;

  const pendingInvoices = (invoices.data ?? []).filter((i) => i.status === "pending");
  const outstanding = pendingInvoices.reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <>
      <PageHeader title={t("dash.title")} subtitle={`${orgName} · org ${orgCode}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("dash.pending")} value={count("pending")} icon="📦" to="/deliveries" />
        <StatTile label={t("dash.moving")} value={count("in_transit") + count("out_for_delivery")} icon="🚚" to="/deliveries" />
        <StatTile label={t("dash.unread")} value={notifications.data ?? "—"} icon="🔔" to="/notifications" />
        <StatTile
          label={t("dash.outstanding")}
          value={formatMoney(outstanding)}
          hint={`${pendingInvoices.length} ${t("dash.pendingInvoices")}`}
          icon="🧾"
          to="/invoicing"
        />
      </div>

      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">{t("dash.pipeline")}</h2>
          <span className="text-xs text-muted-foreground">{rows.length} total</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {PIPELINE.map((seg) => {
            const n = count(seg.key);
            if (n === 0) return null;
            return (
              <div
                key={seg.key}
                style={{ width: `${(n / total) * 100}%`, backgroundColor: seg.color }}
                title={`${seg.label}: ${n}`}
              />
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {PIPELINE.map((seg) => (
            <span key={seg.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
              {seg.label} · {count(seg.key)}
            </span>
          ))}
        </div>
      </Card>

      {alerts.data && alerts.data.length > 0 && (
        <Card className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="font-medium">{t("dash.openAlerts")}</h2>
            <Badge tone="danger">{alerts.data.length}</Badge>
          </div>
          <ul className="space-y-2">
            {alerts.data.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <Badge tone={a.severity === "critical" || a.severity === "high" ? "danger" : "warning"}>
                    {a.severity}
                  </Badge>{" "}
                  <span className="font-medium">{a.title}</span>
                </span>
                <span className="truncate text-xs text-muted-foreground">{a.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
