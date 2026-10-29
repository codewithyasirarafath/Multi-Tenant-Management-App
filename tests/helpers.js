import crypto from "crypto";
import request from "supertest";
import { createApp } from "../app.js";

// Each test file runs in its own isolated worker (vitest isolate: true),
// so every file gets its own app instance and rate-limit counters.
export const app = createApp();

export const PASSWORD = "Str0ngT3st!Pass";
export const tokenTag = () => crypto.randomBytes(4).toString("hex");
export const uniqueEmail = (prefix = "user") =>
  `${prefix}.${tokenTag()}@test.local`;
export const uniqueMobile = () =>
  `+1999${crypto.randomInt(1_000_000_000, 10_000_000_000)}`; // +1999 + 10 digits (schema allows digits only)

// Register + login; the login response carries memberships/membershipCodes.
export async function registerAndLogin(email = uniqueEmail()) {
  await request(app)
    .post("/api/v1/auth/register")
    .send({
      email,
      password: PASSWORD,
      firstName: "Test",
      lastName: "User",
      mobile: uniqueMobile(),
    })
    .expect((res) => {
      if (![200, 201, 409].includes(res.status)) {
        throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
    });

  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);

  return {
    email,
    token: res.body.accessToken,
    userId: res.body.user.id,
    orgId: res.body.memberships?.[0]?.org_id ?? null,
    refreshToken: res.body.refreshToken,
  };
}

// Full bootstrap: user + their own org (creator becomes org_admin).
export async function bootstrapUser(prefix) {
  const user = await registerAndLogin(uniqueEmail(prefix));
  const res = await request(app)
    .post("/api/v1/organizations")
    .set("Authorization", `Bearer ${user.token}`)
    .send({
      name: `Test Org ${tokenTag()}`,
      slug: `test-org-${tokenTag()}`,
    })
    .expect(201);
  return { ...user, orgId: res.body.id };
}

export const auth = (token) => ({
  Authorization: `Bearer ${token}`,
});
