import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { useOrg } from "@/shared/context/OrgContext";
import { useI18n } from "@/shared/i18n/I18nProvider";
import {
  Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Table, Td,
} from "@/shared/components/ui";
import type { Webhook } from "@/shared/types";

export default function WebhooksPage() {
  const { orgId } = useOrg();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ url: "", events: "delivery.created, delivery.status_changed" });

  const webhooks = useQuery({
    queryKey: ["webhooks", orgId],
    queryFn: () => api<Webhook[]>(`/organizations/${orgId}/webhooks`),
    enabled: Boolean(orgId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["webhooks", orgId] });

  const create = useMutation({
    mutationFn: (body: { url: string; events: string[] }) =>
      api<Webhook>(`/organizations/${orgId}/webhooks`, { method: "POST", body }),
    onSuccess: () => {
      setForm({ url: "", events: "delivery.created, delivery.status_changed" });
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Create failed"),
  });

  const revoke = useMutation({
    mutationFn: (webhookId: string) =>
      api(`/organizations/${orgId}/webhooks/${webhookId}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Revoke failed"),
  });

  const test = useMutation({
    mutationFn: (webhookId: string) =>
      api(`/organizations/${orgId}/webhooks/${webhookId}/test`, { method: "POST" }),
    onSuccess: () => setError(null),
    onError: (err) => setError(err instanceof Error ? err.message : "Test delivery failed (check the target URL)"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate({
      url: form.url,
      events: form.events.split(",").map((ev) => ev.trim()).filter(Boolean),
    });
  };

  if (!orgId) {
    return (
      <>
        <PageHeader title={t("hooks.title")} />
        <EmptyState message={t("common.selectOrg")} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("hooks.title")} subtitle={t("hooks.subtitle")} />
      <ErrorBanner message={error} />

      <Card className="mb-4">
        <h2 className="mb-3 font-medium">{t("hooks.new")}</h2>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field label={t("hooks.url")}>
            <Input
              required
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/hooks/acme"
            />
          </Field>
          <Field label={t("hooks.events")}>
            <Input value={form.events} onChange={(e) => setForm({ ...form, events: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t("common.creating") : t("common.create")}
            </Button>
          </div>
        </form>
      </Card>

      {webhooks.data && webhooks.data.length === 0 ? (
        <EmptyState message={t("hooks.none")} />
      ) : (
        <Table head={["URL", t("hooks.events"), t("hooks.status"), ""]}>
          {(webhooks.data ?? []).map((w) => (
            <tr key={w.id}>
              <Td className="font-medium">{w.url}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {w.events.map((ev) => (
                    <Badge key={ev} tone="info">{ev}</Badge>
                  ))}
                </div>
              </Td>
              <Td>
                {w.is_active ? <Badge tone="success">{t("hooks.active")}</Badge> : <Badge>{t("hooks.inactive")}</Badge>}
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => test.mutate(w.id)} disabled={test.isPending}>
                    Test
                  </Button>
                  <Button variant="danger" onClick={() => revoke.mutate(w.id)} disabled={revoke.isPending}>
                    Revoke
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
