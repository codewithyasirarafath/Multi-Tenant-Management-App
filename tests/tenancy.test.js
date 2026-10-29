// THE GOLDEN RULE: a user must never read or mutate another org's data.
// Every tenant-scoped module is probed cross-org; all must refuse.
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app, bootstrapUser, tokenTag, auth } from "./helpers.js";

describe("Tenant isolation (golden rule)", () => {
  let orgA; // owns the data
  let orgB; // tries to touch org A's data

  beforeAll(async () => {
    orgA = await bootstrapUser("tenant-a");
    orgB = await bootstrapUser("tenant-b");

    // Seed one delivery, one customer, one invoice in org A
    const delivery = await request(app)
      .post(`/api/v1/organizations/${orgA.orgId}/deliveries`)
      .set(auth(orgA.token))
      .send({
        trackingNumber: `TRK-${tokenTag()}`,
        senderName: "A",
        receiverName: "B",
        destination: "Secret City",
      });
    orgA.deliveryId = delivery.body.id;
    orgA.trackingNumber = delivery.body.tracking_number;

    const customer = await request(app)
      .post(`/api/v1/organizations/${orgA.orgId}/customers`)
      .set(auth(orgA.token))
      .send({ name: "Secret Customer", email: `c.${tokenTag()}@test.local` });
    orgA.customerId = customer.body.id;

    const invoice = await request(app)
      .post(`/api/v1/organizations/${orgA.orgId}/invoicing`)
      .set(auth(orgA.token))
      .send({
        invoiceNumber: `INV-${tokenTag()}`,
        customerId: orgA.customerId,
        subtotal: 10,
        tax: 1,
        total: 11,
      });
    orgA.invoiceId = invoice.body.id;
  });

  const crossOrgGets = [
    ["deliveries", () => `/deliveries`],
    ["deliveries (by id)", () => `/deliveries/${orgA.deliveryId}`],
    ["delivery tracking", () => `/deliveries/track/${orgA.trackingNumber}`],
    ["entities", () => `/entities`],
    ["inventory", () => `/inventory`],
    ["customers", () => `/customers`],
    ["invoices", () => `/invoicing`],
    ["invoice by id", () => `/invoicing/${orgA.invoiceId}`],
    ["notifications", () => `/notifications`],
    ["alerts", () => `/notifications/alerts`],
    ["webhooks", () => `/webhooks`],
    ["roles", () => `/roles`],
  ];

  for (const [name, path] of crossOrgGets) {
    it(`blocks org B from org A ${name}`, async () => {
      const res = await request(app)
        .get(`/api/v1/organizations/${orgA.orgId}${path()}`)
        .set(auth(orgB.token));
      expect([403, 404]).toContain(res.status);
    });
  }

  it("blocks org B from mutating org A's delivery status", async () => {
    const res = await request(app)
      .patch(`/api/v1/organizations/${orgA.orgId}/deliveries/${orgA.deliveryId}/status`)
      .set(auth(orgB.token))
      .send({ status: "delivered" });
    expect([403, 404]).toContain(res.status);
  });

  it("blocks org B from creating data inside org A", async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${orgA.orgId}/customers`)
      .set(auth(orgB.token))
      .send({ name: "Intruder" });
    expect(res.status).toBe(403);
  });

  it("blocks org B from deleting org A's delivery", async () => {
    const res = await request(app)
      .delete(`/api/v1/organizations/${orgA.orgId}/deliveries/${orgA.deliveryId}`)
      .set(auth(orgB.token));
    expect([403, 404]).toContain(res.status);
  });

  it("org A still accesses its own data normally", async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${orgA.orgId}/deliveries`)
      .set(auth(orgA.token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});
