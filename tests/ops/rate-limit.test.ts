import { describe, expect, it } from "vitest";
import {
  bucketKey,
  checkRateLimit,
  clientIp,
  memoryRateLimitStore,
  RATE_LIMITS,
  type RateLimitRule,
  type RateLimitStore,
} from "../../lib/ops/rate-limit";

const SECRET = "test-secret";
const PER_IP: RateLimitRule = { name: "t-ip", windowSeconds: 600, limit: 3, scope: "ip" };
const GLOBAL: RateLimitRule = { name: "t-global", windowSeconds: 86400, limit: 5, scope: "global" };

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("bucketKey", () => {
  it("never contains the raw IP", () => {
    const key = bucketKey(PER_IP, "203.0.113.7", SECRET);
    expect(key).not.toContain("203.0.113.7");
    expect(key).toMatch(/^ip:t-ip:[0-9a-f]{32}$/);
  });
  it("is stable per (rule, ip) and differs across IPs, rules and secrets", () => {
    const a = bucketKey(PER_IP, "1.1.1.1", SECRET);
    expect(bucketKey(PER_IP, "1.1.1.1", SECRET)).toBe(a);
    expect(bucketKey(PER_IP, "1.1.1.2", SECRET)).not.toBe(a);
    expect(bucketKey({ ...PER_IP, name: "other" }, "1.1.1.1", SECRET)).not.toBe(a);
    expect(bucketKey(PER_IP, "1.1.1.1", "another-secret")).not.toBe(a);
  });
  it("global rules share one key regardless of IP", () => {
    expect(bucketKey(GLOBAL, "1.1.1.1", SECRET)).toBe(bucketKey(GLOBAL, "9.9.9.9", SECRET));
  });
});

describe("checkRateLimit", () => {
  const at = (iso: string) => () => new Date(iso);

  it("allows up to the limit, then blocks with a Retry-After to the window end", async () => {
    const now = new Date("2026-11-17T10:03:00Z"); // window 10:00–10:10
    const store = memoryRateLimitStore(() => now);
    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimit(store, [PER_IP], "1.1.1.1", SECRET, now)).toEqual({ allowed: true, degraded: false });
    }
    expect(await checkRateLimit(store, [PER_IP], "1.1.1.1", SECRET, now)).toEqual({
      allowed: false,
      rule: "t-ip",
      retryAfterSeconds: 420,
    });
  });

  it("limits each client separately", async () => {
    const store = memoryRateLimitStore(at("2026-11-17T10:00:00Z"));
    for (let i = 0; i < 3; i++) await checkRateLimit(store, [PER_IP], "1.1.1.1", SECRET);
    expect((await checkRateLimit(store, [PER_IP], "1.1.1.1", SECRET)).allowed).toBe(false);
    expect((await checkRateLimit(store, [PER_IP], "2.2.2.2", SECRET)).allowed).toBe(true);
  });

  it("a new window starts a fresh count", async () => {
    let now = new Date("2026-11-17T10:00:00Z");
    const store = memoryRateLimitStore(() => now);
    for (let i = 0; i < 4; i++) await checkRateLimit(store, [PER_IP], "1.1.1.1", SECRET, now);
    now = new Date("2026-11-17T10:10:00Z");
    expect((await checkRateLimit(store, [PER_IP], "1.1.1.1", SECRET, now)).allowed).toBe(true);
  });

  it("the global budget blocks everyone once spent", async () => {
    const store = memoryRateLimitStore(at("2026-11-17T10:00:00Z"));
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit(store, [GLOBAL], `10.0.0.${i}`, SECRET)).allowed).toBe(true);
    }
    const blocked = await checkRateLimit(store, [GLOBAL], "10.0.0.99", SECRET);
    expect(blocked).toMatchObject({ allowed: false, rule: "t-global" });
  });

  it("a client blocked per-IP does not drain the shared budget", async () => {
    const store = memoryRateLimitStore(at("2026-11-17T10:00:00Z"));
    for (let i = 0; i < 10; i++) await checkRateLimit(store, [PER_IP, GLOBAL], "1.1.1.1", SECRET);
    // 3 allowed calls counted against the global budget of 5; 2 remain for others.
    expect((await checkRateLimit(store, [PER_IP, GLOBAL], "2.2.2.2", SECRET)).allowed).toBe(true);
    expect((await checkRateLimit(store, [PER_IP, GLOBAL], "3.3.3.3", SECRET)).allowed).toBe(true);
    expect(await checkRateLimit(store, [PER_IP, GLOBAL], "4.4.4.4", SECRET)).toMatchObject({
      allowed: false,
      rule: "t-global",
    });
  });

  it("fails open (allowed, degraded) when the store is down", async () => {
    const broken: RateLimitStore = {
      hit: async () => {
        throw new Error("RATE_LIMIT_STORE_FAILED: PGRST202");
      },
    };
    expect(await checkRateLimit(broken, [PER_IP], "1.1.1.1", SECRET)).toEqual({ allowed: true, degraded: true });
  });

  it("every model-spending route has a per-IP limit and the shared daily budget", () => {
    for (const rules of Object.values(RATE_LIMITS)) {
      expect(rules.some((r) => r.scope === "ip")).toBe(true);
      expect(rules.some((r) => r.scope === "global" && r.windowSeconds === 86400)).toBe(true);
      // The per-IP rule runs first so a blocked client stops before the budget.
      expect(rules[0]!.scope).toBe("ip");
    }
  });
});
