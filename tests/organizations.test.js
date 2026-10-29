import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, bootstrapUser, registerAndLogin, uniqueEmail, tokenTag, auth } from "./helpers.js";

describe("Organizations", () => {
  it("creates an org and grants the creator org_admin membership", async () => {
    const user = await bootstrapUser("org");
    expect(user.orgId).toBeTruthy();

    // Creator can now access their org (this was previously a dead-end)
    const res = await request(app)
      .get(`/api/v1/organizations/${user.orgId}/entities`)
      .set(auth(user.token));
    expect(res.status).toBe(200);
  });

  it("lists organizations", async () => {
    const user = await bootstrapUser("orglist");
    const res = await request(app)
      .get("/api/v1/organizations")
      .set(auth(user.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("gets a single organization", async () => {
    const user = await bootstrapUser("orgget");
    const res = await request(app)
      .get(`/api/v1/organizations/${user.orgId}`)
      .set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.orgId);
    expect(res.body.org_code).toBeGreaterThanOrEqual(100);
  });

  it("auto-assigns org_code when not provided", async () => {
    const user = await registerAndLogin(uniqueEmail("orgcode"));
    const res = await request(app)
      .post("/api/v1/organizations")
      .set(auth(user.token))
      .send({ name: "No Code Org", slug: `no-code-${tokenTag()}` });
    expect(res.status).toBe(201);
    expect(res.body.org_code).toBeGreaterThanOrEqual(100);
  });

  it("rejects duplicate slug with 409", async () => {
    const user = await bootstrapUser("orgslug");
    const slug = `dup-slug-${tokenTag()}`;
    await request(app)
      .post("/api/v1/organizations")
      .set(auth(user.token))
      .send({ name: "First", slug })
      .expect(201);
    const res = await request(app)
      .post("/api/v1/organizations")
      .set(auth(user.token))
      .send({ name: "Second", slug });
    expect(res.status).toBe(409);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/organizations");
    expect(res.status).toBe(401);
  });
});
