import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/context/AuthContext";
import { Button, Card, ErrorBanner, Field, Input } from "@/shared/components/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Create account</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          You can create your own organization after registering.
        </p>
        <ErrorBanner message={error} />
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input required value={form.firstName} onChange={set("firstName")} />
            </Field>
            <Field label="Last name">
              <Input required value={form.lastName} onChange={set("lastName")} />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Mobile (digits, e.g. +14155551234)">
            <Input required value={form.mobile} onChange={set("mobile")} placeholder="+14155551234" />
          </Field>
          <Field label="Password (min 8 characters)">
            <Input type="password" required minLength={8} value={form.password} onChange={set("password")} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Register"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link to="/login" className="font-medium text-primary underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
