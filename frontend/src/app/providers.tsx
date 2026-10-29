import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/shared/context/AuthContext";
import { OrgProvider } from "@/shared/context/OrgContext";
import { I18nProvider } from "@/shared/i18n/I18nProvider";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { queryClient } from "@/shared/lib/queryClient";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <OrgProvider>{children}</OrgProvider>
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
