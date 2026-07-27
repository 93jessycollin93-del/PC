/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizePackageImports: ["@cybernetic/ui-components"],
  },
  headers: async () => [
    {
      source: "/manifest.json",
      headers: [
        {
          key: "Content-Type",
          value: "application/manifest+json",
        },
      ],
    },
  ],
  rewrites: async () => ({
    beforeFiles: [
      {
        source: "/api/:path*",
        destination: `${process.env.API_GATEWAY_URL || "http://localhost:3001"}/api/:path*`,
      },
    ],
  }),
};

module.exports = nextConfig;
