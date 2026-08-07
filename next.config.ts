import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Presentation layer only — all retrieval/answer logic lives in lib/ and
  // runs server-side. No public env vars are defined (no NEXT_PUBLIC_*).
};

export default nextConfig;
