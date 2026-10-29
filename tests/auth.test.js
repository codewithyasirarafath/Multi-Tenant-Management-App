import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, registerAndLogin, uniqueEmail, uniqueMobile, PASSWORD, auth } from "./helpers.js";

describe("Auth flow", () => {
  it("registers a new user", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: uniqueEmail("auth"),
      password: PASSWORD,
      firstName: "Auth",
      lastName: "Test",
      mobile: uniqueMobile(),
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.user.email).toBeTruthy();
    expect(res.body.accessToken).toBeTruthy();
  });

  it("rejects duplicate registration with 409", async () => {
    const email = uniqueEmail("dup");
    await registerAndLogin(email);
    const res = await request(app).post("/api/v1/auth/register").send({
      email,
      password: PASSWORD,
      firstName: "Dup",
      lastName: "Test",
      mobile: uniqueMobile(),
    });
    expect(res.status).toBe(409);
  });

  it("logs in with valid credentials and returns membership shape", async () => {
    const user = await registerAndLogin();
    const res = await request(app).post("/api/v1/auth/login").send({
      email: user.email,
      password: PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(Array.isArray(res.body.memberships)).toBe(true);
    expect(Array.isArray(res.body.membershipCodes)).toBe(true);
  });

  it("rejects wrong password with 401", async () => {
    const user = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rejects weak/malformed payload with 422", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "not-an-email", password: "x" });
    expect([400, 422]).toContain(res.status);
  });

  it("returns current user for /auth/me", async () => {
    const user = await registerAndLogin();
    const res = await request(app).get("/api/v1/auth/me").set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it("rejects /auth/me without token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("rotates refresh token and revokes old one", async () => {
    const user = await registerAndLogin();
    const first = await request(app)
      .post("/api/v1/auth/token/refresh")
      .send({ refreshToken: user.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();

    // Old token must be revoked (single-use rotation)
    const replay = await request(app)
      .post("/api/v1/auth/token/refresh")
      .send({ refreshToken: user.refreshToken });
    expect([401, 400]).toContain(replay.status);
  });

  it("logs out and invalidates the refresh token", async () => {
    const user = await registerAndLogin();
    const out = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken: user.refreshToken });
    expect([200, 204]).toContain(out.status);
    const replay = await request(app)
      .post("/api/v1/auth/token/refresh")
      .send({ refreshToken: user.refreshToken });
    expect([401, 400]).toContain(replay.status);
  });
});
