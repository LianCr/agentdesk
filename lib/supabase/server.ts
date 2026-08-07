import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client factory. Uses the secret key
// (SUPABASE_SECRET_KEY, sb_secret_*). The secret key bypasses RLS and must
// never reach a browser, a log line, or an error message.

let envLoaded = false;

function loadEnv(): void {
  if (envLoaded) return;
  if (existsSync(".env")) process.loadEnvFile(".env");
  envLoaded = true;
}

export function createServiceClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createServiceClient is server-only and must never run in a browser");
  }
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("SUPABASE_URL is not set (add it to .env)");
  if (!key) {
    throw new Error("SUPABASE_SECRET_KEY is not set (add the sb_secret_* key to .env)");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function supabaseUrl(): string {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is not set (add it to .env)");
  return url;
}
