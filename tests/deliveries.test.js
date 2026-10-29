import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app, bootstrapUser, tokenTag, auth } from "./helpers.js";

describe("Deliveries", () => {
  let user;

  beforeAll(async () => {
    user = await bootstrapUser("dlv");
  });

  const makeDelivery = (trackingNumber, status = "pending") => ({
    trackingNumber,
    senderName: "Sender Co",
    receiverName: "Receiver Co",
    destination: "Test City",
    status,
  });

  it("creates a delivery", async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${user.orgId}/deliveries`)
      .set(auth(user.token))
      .send(makeDelivery(`TRK-${tokenTag()}`));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.org_id).toBe(user.orgId);
  });

  it("lists deliveries scoped to the org", async () => {
    await request(app)
      .post(`/api/v1/organizations/${user.orgId}/deliveries`)
      .set(auth(user.token))
      .send(makeDelivery(`TRK-${tokenTag()}`))
      .expect(201);

    const res = await request(app)
      .get(`/api/v1/organizations/${user.orgId}/deliveries`)
      .set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("tracks by tracking number", async () => {
    const trackingNumber = `TRK-${tokenTag()}`;
    await request(app)
      .post(`/api/v1/organizations/${user.orgId}/deliveries`)
      .set(auth(user.token))
      .send(makeDelivery(trackingNumber))
      .expect(201);

    const res = await request(app)
      .get(`/api/v1/organizations/${user.orgId}/deliveries/track/${trackingNumber}`)
      .set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.tracking_number).toBe(trackingNumber);
  });

  it("transitions status pending -> in_transit -> delivered", async () => {
    const created = await request(app)
      .post(`/api/v1/organizations/${user.orgId}/deliveries`)
      .set(auth(user.token))
      .send(makeDelivery(`TRK-${tokenTag()}`))
      .expect(201);

    const id = created.body.id;
    for (const status of ["in_transit", "out_for_delivery", "delivered"]) {
      const res = await request(app)
        .patch(`/api/v1/organizations/${user.orgId}/deliveries/${id}/status`)
        .set(auth(user.token))
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it("rejects invalid status values", async () => {
    const created = await request(app)
      .post(`/api/v1/organizations/${user.orgId}/deliveries`)
      .set(auth(user.token))
      .send(makeDelivery(`TRK-${tokenTag()}`))
      .expect(201);

    const res = await request(app)
      .patch(`/api/v1/organizations/${user.orgId}/deliveries/${created.body.id}/status`)
      .set(auth(user.token))
      .send({ status: "teleported" });
    expect([400, 422]).toContain(res.status);
  });

  it("rejects duplicate tracking number within the org", async () => {
    const trackingNumber = `TRK-${tokenTag()}`;
    await request(app)
      .post(`/api/v1/organizations/${user.orgId}/deliveries`)
      .set(auth(user.token))
      .send(makeDelivery(trackingNumber))
      .expect(201);

    const res = await request(app)
      .post(`/api/v1/organizations/${user.orgId}/deliveries`)
      .set(auth(user.token))
      .send(makeDelivery(trackingNumber));
    expect(res.status).toBe(409);
  });

  it("paginates with limit/offset", async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${user.orgId}/deliveries?limit=2&offset=0`)
      .set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(2);
  });
});
