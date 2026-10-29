export type DeliveryStatus =
  | "pending"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface Membership {
  membership_id: string;
  org_id: string;
  ent_id: string | null;
  org_code: number;
  org_name: string;
  org_slug: string;
  ent_code: number | null;
  entity_name: string | null;
  entity_code: string | null;
  role_id: string;
  role_name: string;
  is_active: boolean;
}

export interface AuthResponse {
  user: User;
  memberships: Membership[];
  membershipCodes: number[];
  accessToken: string;
  refreshToken: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  org_code: number;
  is_active: boolean;
  created_at: string;
}

export interface Entity {
  id: string;
  org_id: string;
  name: string;
  code: string;
  ent_code: number;
  is_active: boolean;
}

export interface OrgUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  is_active: boolean;
}

export interface Role {
  id: string;
  org_id: string | null;
  name: string;
  description: string | null;
}

export interface Delivery {
  id: string;
  org_id: string;
  ent_id: string | null;
  tracking_number: string;
  sender_name: string;
  receiver_name: string;
  destination: string;
  status: DeliveryStatus;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  org_id: string;
  name: string;
  sku: string;
  unit: string;
  sale_price: string;
  cost_price: string;
  track_inventory: boolean;
}

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  address: string | null;
}

export interface Invoice {
  id: string;
  org_id: string;
  invoice_number: string;
  customer_id: string | null;
  delivery_id: string | null;
  subtotal: string;
  tax: string;
  total: string;
  status: "pending" | "paid" | "overdue" | "cancelled" | "void";
  due_date: string | null;
  paid_at: string | null;
  customer_name?: string | null;
  delivery_tracking?: string | null;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: string;
  payment_method: string | null;
  transaction_id: string | null;
  status: string;
  paid_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  org_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  org_id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
}

export interface Webhook {
  id: string;
  org_id: string;
  url: string;
  events: string[];
  is_active: boolean;
}

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  "pending",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
];
