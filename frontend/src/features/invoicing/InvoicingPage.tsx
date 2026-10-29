import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { useOrg } from "@/shared/context/OrgContext";
import {
  Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Select, Table, Td,
} from "@/shared/components/ui";
import type { Customer, Invoice, Payment } from "@/shared/types";
import { formatDate, formatMoney } from "@/shared/lib/utils";

const invoiceTone: Record<Invoice["status"], "default" | "success" | "warning" | "danger"> = {
  pending: "warning",
  paid: "success",
  overdue: "danger",
  cancelled: "default",
  void: "default",
};

export default function InvoicingPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [form, setForm] = useState({ invoiceNumber: "", customerId: "", subtotal: "", tax: "", total: "" });

  const invoices = useQuery({
    queryKey: ["invoices", orgId],
    queryFn: () => api<Invoice[]>(`/organizations/${orgId}/invoicing?limit=100`),
    enabled: Boolean(orgId),
  });

  const customers = useQuery({
    queryKey: ["customers", orgId],
    queryFn: () => api<Customer[]>(`/organizations/${orgId}/customers?limit=100`),
    enabled: Boolean(orgId),
  });

  const invalidateInvoices = () => queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Invoice>(`/organizations/${orgId}/invoicing`, { method: "POST", body }),
    onSuccess: () => {
      setForm({ invoiceNumber: "", customerId: "", subtotal: "", tax: "", total: "" });
      setError(null);
      invalidateInvoices();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Create failed"),
  });

  const pay = useMutation({
    mutationFn: ({ invoiceId, body }: { invoiceId: string; body: Record<string, unknown> }) =>
      api<Payment>(`/organizations/${orgId}/invoicing/${invoiceId}/payments`, { method: "POST", body }),
    onSuccess: () => {
      setPayFor(null);
      setPayAmount("");
      setError(null);
      invalidateInvoices();
      queryClient.invalidateQueries({ queryKey: ["payments", orgId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Payment failed"),
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate({
      invoiceNumber: form.invoiceNumber,
      customerId: form.customerId || undefined,
      subtotal: Number(form.subtotal || 0),
      tax: Number(form.tax || 0),
      total: Number(form.total || 0),
    });
  };

  if (!orgId) {
    return (
      <>
        <PageHeader title="Invoicing" />
        <EmptyState message="Select or create an organization first." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Invoicing" subtitle="Invoices and payments" />
      <ErrorBanner message={error} />

      <Card className="mb-4">
        <h2 className="mb-3 font-medium">New invoice</h2>
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-5">
          <Field label="Invoice number">
            <Input required value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="INV-1001" />
          </Field>
          <Field label="Customer">
            <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">— none —</option>
              {(customers.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Subtotal">
            <Input type="number" min="0" step="0.01" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
          </Field>
          <Field label="Tax">
            <Input type="number" min="0" step="0.01" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} />
          </Field>
          <Field label="Total">
            <Input type="number" min="0" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
          </Field>
          <div className="sm:col-span-5">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create invoice"}
            </Button>
          </div>
        </form>
      </Card>

      {invoices.data && invoices.data.length === 0 ? (
        <EmptyState message="No invoices yet." />
      ) : (
        <Table head={["Invoice", "Customer", "Total", "Status", "Due", "Actions"]}>
          {(invoices.data ?? []).map((inv) => {
            const paymentRow = payFor === inv.id;
            return (
              <tr key={inv.id}>
                <Td className="font-medium">{inv.invoice_number}</Td>
                <Td>{inv.customer_name ?? "—"}</Td>
                <Td>{formatMoney(inv.total)}</Td>
                <Td><Badge tone={invoiceTone[inv.status]}>{inv.status}</Badge></Td>
                <Td className="text-xs text-muted-foreground">{formatDate(inv.due_date)}</Td>
                <Td>
                  {paymentRow ? (
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-24"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Amount"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                      <Button
                        onClick={() =>
                          pay.mutate({
                            invoiceId: inv.id,
                            body: { amount: Number(payAmount), paymentMethod: "card" },
                          })
                        }
                        disabled={pay.isPending || !payAmount}
                      >
                        Record
                      </Button>
                      <Button variant="ghost" onClick={() => setPayFor(null)}>Cancel</Button>
                    </div>
                  ) : (
                    inv.status !== "paid" && (
                      <Button variant="secondary" onClick={() => { setPayFor(inv.id); setPayAmount(inv.total); }}>
                        Record payment
                      </Button>
                    )
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
