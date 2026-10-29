import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/shared/layout/Layout";
import ProtectedRoute from "@/shared/layout/ProtectedRoute";
import LoginPage from "@/features/auth/LoginPage";
import RegisterPage from "@/features/auth/RegisterPage";
import DashboardPage from "@/features/dashboard/DashboardPage";
import DeliveriesPage from "@/features/deliveries/DeliveriesPage";
import InventoryPage from "@/features/inventory/InventoryPage";
import CustomersPage from "@/features/customers/CustomersPage";
import InvoicingPage from "@/features/invoicing/InvoicingPage";
import NotificationsPage from "@/features/notifications/NotificationsPage";
import WebhooksPage from "@/features/webhooks/WebhooksPage";
import AiChatPage from "@/features/ai-chat/AiChatPage";
import ApiKeysPage from "@/features/api-keys/ApiKeysPage";
import AdminPage from "@/features/admin/AdminPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="invoicing" element={<InvoicingPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="ai-chat" element={<AiChatPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
