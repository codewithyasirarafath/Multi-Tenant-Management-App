import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { useAuth } from "@/shared/context/AuthContext";
import { useOrg } from "@/shared/context/OrgContext";
import {
  Badge, Button, Card, ErrorBanner, Field, Input, PageHeader, Select, Table, Td,
} from "@/shared/components/ui";
import type { Entity, Membership, OrgUser, Organization, Role } from "@/shared/types";

export default function AdminPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [entityForm, setEntityForm] = useState({ name: "", code: "" });
  const [userForm, setUserForm] = useState({ firstName: "", lastName: "", email: "", mobile: "" });
  const [orgForm, setOrgForm] = useState({ name: "", slug: "" });
  const [assignForm, setAssignForm] = useState({ userId: "", roleId: "" });

  const { memberships } = useAuth();

  const myOrgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api<Organization[]>("/organizations"),
  });

  const entities = useQuery({
    queryKey: ["entities", orgId],
    queryFn: () => api<Entity[]>(`/organizations/${orgId}/entities`),
    enabled: Boolean(orgId),
  });

  const users = useQuery({
    queryKey: ["users", orgId],
    queryFn: () => api<OrgUser[]>(`/organizations/${orgId}/users`),
    enabled: Boolean(orgId),
  });

  const roles = useQuery({
    queryKey: ["roles", orgId],
    queryFn: () => api<Role[]>(`/organizations/${orgId}/roles`),
    enabled: Boolean(orgId),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["entities", orgId] });
    queryClient.invalidateQueries({ queryKey: ["users", orgId] });
    queryClient.invalidateQueries({ queryKey: ["roles", orgId] });
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
  };

  const createOrg = useMutation({
    mutationFn: (body: { name: string; slug: string }) =>
      api<Organization>("/organizations", { method: "POST", body }),
    onSuccess: () => {
      setOrgForm({ name: "", slug: "" });
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Create failed"),
  });

  const createEntity = useMutation({
    mutationFn: (body: { name: string; code: string }) =>
      api<Entity>(`/organizations/${orgId}/entities`, { method: "POST", body }),
    onSuccess: () => {
      setEntityForm({ name: "", code: "" });
      setError(null);
      invalidateAll();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Create failed"),
  });

  const createUser = useMutation({
    mutationFn: (body: { firstName: string; lastName: string; email: string; mobile: string }) =>
      api<OrgUser>(`/organizations/${orgId}/users`, { method: "POST", body }),
    onSuccess: () => {
      setUserForm({ firstName: "", lastName: "", email: "", mobile: "" });
      setError(null);
      invalidateAll();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Create failed"),
  });

  const assignMembership = useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: { orgId: string; roleId: string } }) =>
      api<Membership>(`/organizations/${orgId}/users/${userId}/memberships`, { method: "POST", body }),
    onSuccess: () => {
      setAssignForm({ userId: "", roleId: "" });
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Assign failed"),
  });

  const onOrgSubmit = (e: FormEvent) => {
    e.preventDefault();
    createOrg.mutate(orgForm);
  };

  if (!orgId && memberships.length === 0) {
    return (
      <>
        <PageHeader title="Admin" subtitle="Create your first organization" />
        <ErrorBanner message={error} />
        <Card className="max-w-md">
          <h2 className="mb-3 font-medium">New organization</h2>
          <form onSubmit={onOrgSubmit} className="space-y-3">
            <Field label="Organization name">
              <Input required value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} />
            </Field>
            <Field label="Slug (lowercase, hyphens)">
              <Input required pattern="[a-z0-9-]+" value={orgForm.slug} onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value })} placeholder="acme-logistics" />
            </Field>
            <Button type="submit" disabled={createOrg.isPending}>
              {createOrg.isPending ? "Creating…" : "Create organization"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            You automatically become this organization's admin.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Admin" subtitle="Organization, entities, users, roles and memberships" />
      <ErrorBanner message={error} />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Create organization</h2>
          <form onSubmit={onOrgSubmit} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input required value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} />
            </Field>
            <Field label="Slug">
              <Input required pattern="[a-z0-9-]+" value={orgForm.slug} onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" disabled={createOrg.isPending}>
                Create organization
              </Button>
            </div>
          </form>
          <div className="mt-3 text-xs text-muted-foreground">
            Your orgs: {(myOrgs.data ?? []).map((o) => `${o.name} (${o.org_code})`).join(", ") || "—"}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Create entity (branch/warehouse)</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createEntity.mutate(entityForm);
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field label="Entity name">
              <Input required value={entityForm.name} onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })} />
            </Field>
            <Field label="Code">
              <Input required value={entityForm.code} onChange={(e) => setEntityForm({ ...entityForm, code: e.target.value })} placeholder="WH-002" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" disabled={createEntity.isPending}>
                Create entity
              </Button>
            </div>
          </form>
          <ul className="mt-3 space-y-1 text-sm">
            {(entities.data ?? []).map((ent) => (
              <li key={ent.id}>
                <Badge tone="info">{ent.ent_code}</Badge> {ent.name} <span className="text-muted-foreground">({ent.code})</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 font-medium">Users in this organization</h2>
        {users.data && users.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users yet.</p>
        ) : (
          <Table head={["Name", "Email", "Mobile", "Active"]}>
            {(users.data ?? []).map((u) => (
              <tr key={u.id}>
                <Td className="font-medium">{u.first_name} {u.last_name}</Td>
                <Td>{u.email}</Td>
                <Td>{u.mobile}</Td>
                <Td>{u.is_active ? <Badge tone="success">active</Badge> : <Badge>inactive</Badge>}</Td>
              </tr>
            ))}
          </Table>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createUser.mutate(userForm);
          }}
          className="mt-4 grid gap-3 sm:grid-cols-5"
        >
          <Field label="First name">
            <Input required value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input required value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input required type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
          </Field>
          <Field label="Mobile (digits only)">
            <Input required value={userForm.mobile} onChange={(e) => setUserForm({ ...userForm, mobile: e.target.value })} placeholder="+14155551234" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" disabled={createUser.isPending}>
              Add user
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-medium">Assign role</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (assignForm.userId && assignForm.roleId) {
              assignMembership.mutate({
                userId: assignForm.userId,
                body: { orgId: orgId as string, roleId: assignForm.roleId },
              });
            }
          }}
          className="grid gap-3 sm:grid-cols-3"
        >
          <Field label="User">
            <Select required value={assignForm.userId} onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}>
              <option value="">— select user —</option>
              {(users.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>
              ))}
            </Select>
          </Field>
          <Field label="Role">
            <Select required value={assignForm.roleId} onChange={(e) => setAssignForm({ ...assignForm, roleId: e.target.value })}>
              <option value="">— select role —</option>
              {(roles.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.org_id ? "" : " (system)"}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" disabled={assignMembership.isPending}>
              Assign
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Available roles: {(roles.data ?? []).map((r) => r.name).join(", ") || "—"}
        </p>
      </Card>
    </>
  );
}
