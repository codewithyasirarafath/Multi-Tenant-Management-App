import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { useOrg } from "@/shared/context/OrgContext";
import { useI18n } from "@/shared/i18n/I18nProvider";
import {
  Badge, Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Table, Td,
} from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/utils";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface GenerateResponse {
  key: string;
  name: string;
}

export default function ApiKeysPage() {
  const { orgId } = useOrg();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);

  const keys = useQuery({
    queryKey: ["api-keys", orgId],
    queryFn: () => api<ApiKeyRow[]>(`/organizations/${orgId}/api-keys`),
    enabled: Boolean(orgId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["api-keys", orgId] });

  const generate = useMutation({
    mutationFn: (keyName: string) =>
      api<GenerateResponse>(`/organizations/${orgId}/api-keys`, {
        method: "POST",
        body: { name: keyName },
      }),
    onSuccess: (data) => {
      setGenerated(data.key);
      setName("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Generate failed"),
  });

  const revoke = useMutation({
    mutationFn: (keyId: string) =>
      api(`/organizations/${orgId}/api-keys/${keyId}/revoke`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Revoke failed"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    generate.mutate(name);
  };

  if (!orgId) {
    return (
      <>
        <PageHeader title={t("keys.title")} />
        <EmptyState message={t("common.selectOrg")} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("keys.title")} subtitle={t("keys.subtitle")} />
      <ErrorBanner message={error} />

      {generated && (
        <Card className="mb-4 border-success/40 bg-success/5">
          <p className="mb-1 text-sm font-medium">{t("keys.generated")}</p>
          <code className="block break-all rounded-lg bg-muted px-3 py-2 text-sm">{generated}</code>
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="mb-3 font-medium">{t("keys.new")}</h2>
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("keys.name")} />
          <Button type="submit" disabled={generate.isPending}>
            {generate.isPending ? t("common.creating") : t("common.create")}
          </Button>
        </form>
      </Card>

      {keys.data && keys.data.length === 0 ? (
        <EmptyState message={t("keys.none")} />
      ) : (
        <Table head={[t("keys.name"), t("keys.prefix"), t("hooks.status"), t("keys.created"), ""]}>
          {(keys.data ?? []).map((k) => (
            <tr key={k.id}>
              <Td className="font-medium">{k.name}</Td>
              <Td><code className="text-xs">{k.key_prefix ?? "—"}</code></Td>
              <Td>
                {k.is_active ? <Badge tone="success">{t("hooks.active")}</Badge> : <Badge tone="danger">{t("hooks.inactive")}</Badge>}
              </Td>
              <Td className="text-xs text-muted-foreground">{formatDate(k.created_at)}</Td>
              <Td>
                {k.is_active && (
                  <Button variant="danger" onClick={() => revoke.mutate(k.id)} disabled={revoke.isPending}>
                    Revoke
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

