import type { NextConfig } from 'next';

// One id per build, baked into both the server and the page. When they
// differ, the page is from an older build and reloads itself (lib/store.ts),
// as LifeOS does - so a phone never runs yesterday's code against today's API.
const BUILD_ID = process.env.MEALS_BUILD_ID ?? String(Date.now());

const nextConfig: NextConfig = {
  // node-sqlite3-wasm loads a .wasm file relative to its own package path.
  // Bundling rewrites that path and the file goes missing at runtime.
  serverExternalPackages: ['node-sqlite3-wasm'],
  env: { NEXT_PUBLIC_MEALS_BUILD: BUILD_ID },
};

export default nextConfig;
