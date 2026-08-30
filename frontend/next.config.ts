import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const parsedApiUrl = new URL(apiUrl);
const websocketUrl = apiUrl.replace(/^http/, "ws");
const scriptPolicy =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; ${scriptPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: ${apiUrl}; font-src 'self' data:; connect-src 'self' ${apiUrl} ${websocketUrl}; object-src blob:; frame-src blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.123"],
  images: {
    remotePatterns: [
      {
        protocol: parsedApiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: parsedApiUrl.hostname,
        port: parsedApiUrl.port,
        pathname: "/doctors/**",
      },
    ],
  },

  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
