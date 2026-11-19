import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// public/openapi.json is hand-written (no codegen dependency). This test is
// what keeps it honest: every exported handler in app/api has an operation in
// the spec and vice versa, every $ref resolves, and the routes documented as
// returning 429 are exactly the routes that call the rate limiter.

const ROOT = process.cwd();
const spec = JSON.parse(readFileSync(join(ROOT, "public/openapi.json"), "utf8")) as {
  openapi: string;
  paths: Record<string, Record<string, { operationId: string; responses: Record<string, unknown> }>>;
  components: Record<string, Record<string, unknown>>;
};

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

const routes = routeFiles(join(ROOT, "app/api")).map((file) => {
  const source = readFileSync(file, "utf8");
  const dir = relative(join(ROOT, "app"), file).split(sep).slice(0, -1).join("/");
  const path = "/" + dir.replace(/\[([^\]]+)\]/g, "{$1}");
  const methods = [...source.matchAll(/export (?:const|async function) (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) =>
    m[1]!.toLowerCase(),
  );
  return { path, methods, rateLimited: source.includes("enforceRateLimit(") };
});

const implemented = routes.flatMap((r) => r.methods.map((m) => `${m.toUpperCase()} ${r.path}`)).sort();
const documented = Object.entries(spec.paths)
  .flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`))
  .sort();

describe("OpenAPI spec matches the code", () => {
  it("is OpenAPI 3.1", () => {
    expect(spec.openapi).toBe("3.1.0");
  });

  it("documents every implemented handler and nothing else", () => {
    expect(implemented.length).toBeGreaterThan(0);
    expect(documented).toEqual(implemented);
  });

  it("operationIds are unique and every operation documents its responses", () => {
    const ops = Object.values(spec.paths).flatMap((p) => Object.values(p));
    const ids = ops.map((o) => o.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const op of ops) expect(Object.keys(op.responses).length).toBeGreaterThan(0);
  });

  it("every $ref resolves", () => {
    const refs = [...JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/([^/]+)\/([^"]+)"/g)];
    expect(refs.length).toBeGreaterThan(0);
    for (const [, section, name] of refs) {
      expect(spec.components[section!]?.[name!], `${section}/${name}`).toBeDefined();
    }
  });

  it("429 is documented exactly on the routes that enforce a rate limit", () => {
    const limitedInCode = routes.filter((r) => r.rateLimited).map((r) => r.path).sort();
    const limitedInSpec = Object.entries(spec.paths)
      .filter(([, ops]) => Object.values(ops).some((o) => "429" in o.responses))
      .map(([path]) => path)
      .sort();
    expect(limitedInSpec).toEqual(limitedInCode);
    expect(limitedInCode).toEqual(["/api/answer", "/api/compare/narrative", "/api/support/tickets", "/api/transcribe"]);
  });

  it("every route is wrapped by the request logger", () => {
    for (const file of routeFiles(join(ROOT, "app/api"))) {
      expect(readFileSync(file, "utf8"), file).toContain("withRequestLog(");
    }
  });
});
