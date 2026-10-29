import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { useOrg } from "@/shared/context/OrgContext";
import {
  Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Table, Td,
} from "@/shared/components/ui";
import type { Alert, Notification } from "@/shared/types";
import { formatDate } from "@/shared/lib/utils";

export default function NotificationsPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ["notifications", orgId],
    queryFn: () => api<Notification[]>(`/organizations/${orgId}/notifications?limit=50`),
    enabled: Boolean(orgId),
  });

  const unreadCount = useQuery({
    queryKey: ["notifications-unread", orgId],
    // The API returns { unreadCount: n } — normalize to a number.
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
    queryFn: () => api<Alert[]>(`/organizations/${orgId}/notifications/alerts`),
    enabled: Boolean(orgId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", orgId] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread", orgId] });
  };

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      api(`/organizations/${orgId}/notifications/mark-read`, {
        method: "PATCH",
        body: { notificationId },
      }),
    onSuccess: invalidate,
  });

  if (!orgId) {
    return (
      <>
        <PageHeader title="Notifications" />
        <EmptyState message="Select or create an organization first." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount.data ?? 0} unread`}
      />

      <Card className="mb-4">
        <h2 className="mb-2 font-medium">Open alerts</h2>
        {(alerts.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts.</p>
        ) : (
          <ul className="space-y-2">
            {(alerts.data ?? []).map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span>
                  <Badge tone={a.severity === "critical" || a.severity === "high" ? "danger" : "warning"}>
                    {a.severity}
                  </Badge>{" "}
                  <span className="font-medium">{a.title}</span>
                  <span className="ml-2 text-muted-foreground">{a.message}</span>
                </span>
                {a.is_resolved && <Badge tone="success">resolved</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ErrorBanner message={null} />

      {notifications.data && notifications.data.length === 0 ? (
        <EmptyState message="No notifications yet." />
      ) : (
        <Table head={["Title", "Message", "Type", "Read", "When", ""]}>
          {(notifications.data ?? []).map((n) => (
            <tr key={n.id} className={n.read ? "opacity-70" : ""}>
              <Td className="font-medium">{n.title}</Td>
              <Td className="max-w-md">{n.message}</Td>
              <Td><Badge tone="info">{n.type}</Badge></Td>
              <Td>{n.read ? <Badge tone="success">read</Badge> : <Badge tone="warning">unread</Badge>}</Td>
              <Td className="text-xs text-muted-foreground">{formatDate(n.created_at)}</Td>
              <Td>
                {!n.read && (
                  <Button variant="secondary" onClick={() => markRead.mutate(n.id)} disabled={markRead.isPending}>
                    Mark read
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
