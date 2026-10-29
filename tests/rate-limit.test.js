import { describe, it, expect } from "vitest";
import request from "supertest";

// Set a low auth rate limit BEFORE importing the app (dynamic import so the
// assignment executes first — ESM import declarations are hoisted).
process.env.AUTH_RATE_LIMIT = "3";
const { app, uniqueEmail, uniqueMobile } = await import("./helpers.js");

describe("Rate limiting", () => {
  it("returns 429 after the auth rate limit is exhausted", async () => {
    const email = uniqueEmail("ratelimit");
    const mobile = uniqueMobile();

    // authRateLimiter is configured with max 3 in this file's process.
    const attempts = [];
    for (let i = 0; i < 6; i++) {
      attempts.push(
        request(app)
          .post("/api/v1/auth/login")
          .send({ email, password: "wrong-on-purpose" }),
      );
    }
    const responses = await Promise.all(attempts);
    const statuses = responses.map((r) => r.status);

    // Most are 401 (invalid credentials); once exhausted, 429s appear.
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });

  it("blocks unauthenticated org-scoped access", async () => {
    const res = await request(app).get(
      "/api/v1/organizations/00000000-0000-0000-0000-000000000000/deliveries",
    );
    expect(res.status).toBe(401);
  });
});
