import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/shared/lib/api";
import { useOrg } from "@/shared/context/OrgContext";
import {
  Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Select, Table, Td,
} from "@/shared/components/ui";
import { DELIVERY_STATUSES, type Delivery, type DeliveryStatus } from "@/shared/types";
import { formatDate } from "@/shared/lib/utils";

const statusTone: Record<DeliveryStatus, "default" | "info" | "warning" | "success" | "danger"> = {
  pending: "warning",
  in_transit: "info",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "danger",
};

export default function DeliveriesPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [trackQuery, setTrackQuery] = useState("");
  const [trackResult, setTrackResult] = useState<Delivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    trackingNumber: "",
    senderName: "",
    receiverName: "",
    destination: "",
  });

  const deliveries = useQuery({
    queryKey: ["deliveries", orgId, statusFilter],
    queryFn: () =>
      api<Delivery[]>(
        `/organizations/${orgId}/deliveries?limit=50${statusFilter ? `&status=${statusFilter}` : ""}`,
      ),
    enabled: Boolean(orgId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["deliveries", orgId] });

  const create = useMutation({
    mutationFn: (body: typeof form) =>
      api<Delivery>(`/organizations/${orgId}/deliveries`, { method: "POST", body }),
    onSuccess: () => {
      setForm({ trackingNumber: "", senderName: "", receiverName: "", destination: "" });
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Create failed"),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) =>
      api<Delivery>(`/organizations/${orgId}/deliveries/${id}/status`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: invalidate,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(form);
  };

  const track = async () => {
    setTrackResult(null);
    setError(null);
    try {
      const res = await api<Delivery>(
        `/organizations/${orgId}/deliveries/track/${encodeURIComponent(trackQuery)}`,
      );
      setTrackResult(res);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "Tracking number not found" : (err as Error).message);
    }
  };

  if (!orgId) {
    return (
      <>
        <PageHeader title="Deliveries" />
        <EmptyState message="Select or create an organization first." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Deliveries" subtitle="Create, track and progress shipments" />

      <ErrorBanner message={error} />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-medium">New delivery</h2>
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <Field label="Tracking number">
              <Input required value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} placeholder="TRK-1001" />
            </Field>
            <Field label="Destination">
              <Input required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            </Field>
            <Field label="Sender name">
              <Input required value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} />
            </Field>
            <Field label="Receiver name">
              <Input required value={form.receiverName} onChange={(e) => setForm({ ...form, receiverName: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create delivery"}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Track a shipment</h2>
          <div className="flex gap-2">
            <Input value={trackQuery} onChange={(e) => setTrackQuery(e.target.value)} placeholder="Tracking number" />
            <Button variant="secondary" onClick={track} disabled={!trackQuery}>
              Track
            </Button>
          </div>
          {trackResult && (
            <div className="mt-3 text-sm">
              <Badge tone={statusTone[trackResult.status]}>{trackResult.status}</Badge>{" "}
              {trackResult.tracking_number} → {trackResult.destination}
            </div>
          )}
        </Card>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select className="w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {DELIVERY_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      {deliveries.data && deliveries.data.length === 0 ? (
        <EmptyState message="No deliveries match this filter." />
      ) : (
        <Table head={["Tracking", "Sender", "Receiver", "Destination", "Status", "Created", "Update status"]}>
          {(deliveries.data ?? []).map((d) => (
            <tr key={d.id}>
              <Td className="font-medium">{d.tracking_number}</Td>
              <Td>{d.sender_name}</Td>
              <Td>{d.receiver_name}</Td>
              <Td>{d.destination}</Td>
              <Td><Badge tone={statusTone[d.status]}>{d.status}</Badge></Td>
              <Td className="text-xs text-muted-foreground">{formatDate(d.created_at)}</Td>
              <Td>
                <Select
                  className="w-44"
                  value={d.status}
                  onChange={(e) => changeStatus.mutate({ id: d.id, status: e.target.value as DeliveryStatus })}
                >
                  {DELIVERY_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
