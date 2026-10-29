import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { useOrg } from "@/shared/context/OrgContext";
import {
  Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Table, Td,
} from "@/shared/components/ui";
import type { Customer } from "@/shared/types";

export default function CustomersPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", address: "" });

  const customers = useQuery({
    queryKey: ["customers", orgId],
    queryFn: () => api<Customer[]>(`/organizations/${orgId}/customers?limit=100`),
    enabled: Boolean(orgId),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Customer>(`/organizations/${orgId}/customers`, { method: "POST", body }),
    onSuccess: () => {
      setForm({ name: "", email: "", mobile: "", address: "" });
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Create failed"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate({
      name: form.name,
      email: form.email || undefined,
      mobile: form.mobile || undefined,
      address: form.address || undefined,
    });
  };

  if (!orgId) {
    return (
      <>
        <PageHeader title="Customers" />
        <EmptyState message="Select or create an organization first." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Customers" subtitle="People and businesses you deliver to" />
      <ErrorBanner message={error} />

      <Card className="mb-4">
        <h2 className="mb-3 font-medium">New customer</h2>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-4">
          <Field label="Name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Mobile">
            <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Add customer"}
            </Button>
          </div>
        </form>
      </Card>

      {customers.data && customers.data.length === 0 ? (
        <EmptyState message="No customers yet." />
      ) : (
        <Table head={["Name", "Email", "Mobile", "Address"]}>
          {(customers.data ?? []).map((c) => (
            <tr key={c.id}>
              <Td className="font-medium">{c.name}</Td>
              <Td>{c.email ?? "—"}</Td>
              <Td>{c.mobile ?? "—"}</Td>
              <Td>{c.address ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
