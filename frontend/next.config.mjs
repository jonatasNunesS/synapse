/** @type {import('next').NextConfig} */
import { readFileSync } from "fs";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://backend:8000";
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
);

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
