import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/shared/context/AuthContext";
import type { Membership } from "@/shared/types";

interface OrgState {
  membership: Membership | null;
  orgId: string | null;
  orgName: string | null;
  orgCode: number | null;
  memberships: Membership[];
  selectOrg: (orgId: string) => void;
}

const OrgContext = createContext<OrgState | null>(null);

const SELECTED_ORG_KEY = "selectedOrgId";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { memberships } = useAuth();
  const [selected, setSelected] = useState<string | null>(
    () => localStorage.getItem(SELECTED_ORG_KEY),
  );

  useEffect(() => {
    if (selected && !memberships.some((m) => m.org_id === selected)) {
      setSelected(null);
    }
  }, [memberships, selected]);

  const selectOrg = (orgId: string) => {
    setSelected(orgId);
    localStorage.setItem(SELECTED_ORG_KEY, orgId);
  };

  const membership = useMemo(
    () => memberships.find((m) => m.org_id === selected) ?? memberships[0] ?? null,
    [memberships, selected],
  );

  const value = useMemo(
    () => ({
      membership,
      orgId: membership?.org_id ?? null,
      orgName: membership?.org_name ?? null,
      orgCode: membership?.org_code ?? null,
      memberships,
      selectOrg,
    }),
    [membership, memberships],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgState {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
