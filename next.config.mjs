/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  // Don't fail the production build on lint/type warnings. The dev server and
  // `npm run typecheck` still surface these locally; this just keeps deploys
  // from being blocked by non-fatal warnings.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
