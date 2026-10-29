import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { useOrg } from "@/shared/context/OrgContext";
import {
  Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Table, Td,
} from "@/shared/components/ui";
import type { Product } from "@/shared/types";
import { formatMoney } from "@/shared/lib/utils";

export default function InventoryPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unit: "piece",
    costPrice: "",
    salePrice: "",
  });

  const products = useQuery({
    queryKey: ["products", orgId],
    queryFn: () => api<Product[]>(`/organizations/${orgId}/inventory?limit=100`),
    enabled: Boolean(orgId),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Product>(`/organizations/${orgId}/inventory`, { method: "POST", body }),
    onSuccess: () => {
      setForm({ name: "", sku: "", unit: "piece", costPrice: "", salePrice: "" });
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["products", orgId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Create failed"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate({
      name: form.name,
      sku: form.sku,
      unit: form.unit || undefined,
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      salePrice: form.salePrice ? Number(form.salePrice) : undefined,
    });
  };

  if (!orgId) {
    return (
      <>
        <PageHeader title="Inventory" />
        <EmptyState message="Select or create an organization first." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Inventory" subtitle="Products and stock" />
      <ErrorBanner message={error} />

      <Card className="mb-4">
        <h2 className="mb-3 font-medium">New product</h2>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-5">
          <Field label="Name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="SKU">
            <Input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <Field label="Unit">
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </Field>
          <Field label="Cost price">
            <Input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
          </Field>
          <Field label="Sale price">
            <Input type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
          </Field>
          <div className="sm:col-span-5">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Add product"}
            </Button>
          </div>
        </form>
      </Card>

      {products.data && products.data.length === 0 ? (
        <EmptyState message="No products yet." />
      ) : (
        <Table head={["SKU", "Name", "Unit", "Cost", "Sale", "Tracked"]}>
          {(products.data ?? []).map((p) => (
            <tr key={p.id}>
              <Td className="font-medium">{p.sku}</Td>
              <Td>{p.name}</Td>
              <Td>{p.unit}</Td>
              <Td>{formatMoney(p.cost_price)}</Td>
              <Td>{formatMoney(p.sale_price)}</Td>
              <Td>{p.track_inventory ? "Yes" : "No"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
